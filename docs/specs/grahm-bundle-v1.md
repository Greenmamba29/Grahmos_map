# Grahm Bundle v1 — Normative Specification

**Status:** DRAFT. Not frozen. Epic 1 deliverables 1.2, 1.3, 1.4, 1.6.
**Machine-readable companion:** [`grahm-bundle-v1.schema.json`](grahm-bundle-v1.schema.json) (JSON Schema 2020-12, validated).
**Conformance keywords:** MUST / MUST NOT / SHOULD / MAY per RFC 2119.

---

## 1. Scope and design position

A **Grahm Bundle** (`.grahm`) is a fully pinned, offline-verifiable description of a deployable continuity unit: what capabilities it provides, what hardware it needs, what data it carries, what services realise it, how its integrity is proven, how it rolls back, and what continuity grade it must achieve.

Three positions distinguish this from a container manifest, a Helm chart, or a package:

1. **A bundle declares capabilities, not just software.** `cap:routing.pedestrian.indoor@1` is the contract; whether Valhalla or something else satisfies it is an implementation detail the resolver handles.
2. **A bundle declares its own qualification requirement.** The artefact carries the standard it must be held to, scoped to hardware class.
3. **A bundle is verifiable with no network at any point.** Not "degrades gracefully offline" — *verifiable offline*, including freshness and authorisation.

**Non-goals for v1:** multi-node scheduling, autoscaling, service mesh, multi-tenancy, binary delta updates. A bundle describes one deployment on one machine (or one tightly coupled cluster at ORB-3).

---

## 2. Distribution model — offline is the primary path

> **Design decision.** The primary distribution form is an **`oci-layout` directory**, optionally tarred, delivered by any means including physical media. A registry is an optimisation, not a requirement.

This inverts the usual registry-first assumption for a concrete reason: an air-gapped hospital receives a USB drive, not a `docker pull`. Any design where the offline path is the fallback will have an offline path that is tested last and works worst.

```
hospital.grahm/                     ← oci-layout directory
├── oci-layout
├── index.json                      ← entry point; refers to the bundle manifest
└── blobs/sha256/
    ├── <bundle-manifest>           ← OCI image manifest, artifactType = grahm bundle
    ├── <bundle-config>             ← the Grahm Bundle document (this schema)
    ├── <signature-manifest>        ← subject → bundle manifest
    ├── <sbom-manifest>             ← subject → bundle manifest
    ├── <qualification-manifest>    ← subject → bundle manifest
    └── <dataset blobs…>            ← tiles, routing tiles, indexes, models
```

### 2.1 OCI mapping

Built on **OCI Image Spec v1.1** and **OCI Distribution Spec v1.1**, which promoted `artifactType` and `subject` to top-level manifest fields and standardised the referrers API. ([OCI v1.1 release](https://opencontainers.org/posts/blog/2024-03-13-image-and-distribution-1-1/))

| Grahm concept | OCI representation |
|---|---|
| Bundle | Image manifest with `artifactType: application/vnd.grahmos.bundle.v1+json` |
| Bundle document | Manifest `config` blob, media type `application/vnd.grahmos.bundle.config.v1+json` |
| Dataset | Layer blob with a `application/vnd.grahmos.dataset.*` media type |
| Signature | Separate manifest, `subject` → bundle manifest digest |
| SBOM | Separate manifest, `subject` → bundle manifest digest |
| Qualification report | Separate manifest, `subject` → bundle manifest digest |

**Media type registry (v1):**

```
application/vnd.grahmos.bundle.v1+json              artifactType of the bundle manifest
application/vnd.grahmos.bundle.config.v1+json       the bundle document
application/vnd.grahmos.dataset.tiles.pmtiles       vector tile dataset
application/vnd.grahmos.dataset.routing.valhalla    prebuilt routing tiles
application/vnd.grahmos.dataset.index.search        prebuilt search index
application/vnd.grahmos.dataset.facility.v1+json    facility truth export
application/vnd.grahmos.signature.v1                keyed signature bundle
application/vnd.grahmos.sbom.v1                     SBOM referrer
application/vnd.grahmos.qualification.v1+json       continuity qualification report
```

`[VERIFY: whether IANA registration of these types is pursued, and under what name — this is coupled to the trademark workstream and should be settled before the spec freezes.]`

### 2.2 Referrers — and why install must not depend on them

Registries that implement OCI Distribution v1.1 answer `GET /v2/<repo>/referrers/<digest>`. Registries that do not must be handled via the **referrers tag-schema fallback** defined in the same spec, and clients pushing a `subject` are required to verify referrers support or fall back.

**Rule B-706 (normative):** the bundle carries its own signed index of its referrers inside the bundle document. **Install MUST NOT depend on a live referrers query.** Referrers are a *discovery* convenience online; offline they do not exist, and a cross-registry copy can drop them.

---

## 3. Capability identifiers

```
cap:<domain>.<function>[.<qualifier>]@<major>
```

`<major>` is the compatibility boundary. `provides` declares an exact semver; `requires` declares a range.

**Vocabulary v1** — every identifier here MUST have a named consumer in the Runtime or in a bundle, or it is cut before freeze:

| Capability | Meaning |
|---|---|
| `cap:routing.pedestrian@1` | Outdoor pedestrian routing |
| `cap:routing.pedestrian.indoor@1` | Indoor/multi-floor routing over the facility graph |
| `cap:routing.vehicle@1` | Vehicle routing |
| `cap:map.tiles.vector@1` | Vector tile service + style |
| `cap:search.fulltext.offline@1` | Full-text search with no network |
| `cap:geocode.forward@1` | Place name → coordinate |
| `cap:incident.registry@1` | Durable append-only incident capture |
| `cap:alert.cap.ingest@1` | CAP v1.2 alert ingestion |
| `cap:alert.cap.emit@1` | CAP v1.2 alert emission (authority-gated) |
| `cap:facility.truth@1` | Facility fact store with lifecycle, provenance, expiry |
| `cap:identity.offline.verify@1` | Offline credential verification |
| `cap:position.estimate@1` | Position estimate with confidence |

**Rule B-204:** adding a capability to the vocabulary requires naming its consumer and its functional probe in the same change. A capability with no probe cannot be health-checked, and a capability that cannot be health-checked cannot be qualified.

---

## 4. Canonicalisation and digests

**Rule B-701.** All digests over the bundle document are computed over **RFC 8785 JSON Canonicalization Scheme** bytes.

**Rule B-707.** Verifiers **MUST** verify signatures over the **stored bytes**, never over a reparsed-and-reserialised object. A verifier that reparses before verifying will pass today and fail after any serialiser upgrade, and the failure will look like key compromise.

This is not theoretical: the existing `Grahmos` repository contains a branch named `hardening/verify-bytes-binding`, which suggests this exact class of bug has already been encountered once.

---

## 5. Signing, freshness, and authorisation

Three distinct questions, three distinct mechanisms. Conflating them is the usual mistake.

| Question | Mechanism | Why |
|---|---|---|
| Is this intact? | SHA-256 digests | Detects corruption |
| Is this authorised? | **Keyed Cosign signature**, role-separated | Detects unauthorised authorship |
| Is this current, and not a replayed old version? | **TUF metadata** with expiry and version rules | Digests and signatures say nothing about freshness. A correctly signed, intact, *year-old* bundle is the attack |

### 5.1 Rule B-703 — keyless signing is non-conformant

Cosign's keyless (Fulcio) mode is disqualified for GrahmOS. Offline verification of keyless signatures requires a locally provisioned `trusted_root.json`, and Sigstore's own documentation states: *"The contents of this file will change without notification. By not using TUF, you will need to build your own mechanism to keep your airgapped copy of this file up-to-date."* ([cosign README](https://github.com/sigstore/cosign))

A trust anchor that silently goes stale in an air-gapped hospital is exactly the failure mode this system exists to eliminate. **Keyed mode only**, with the trust anchor shipped in-band and carrying its own explicit expiry (`integrity.tuf`).

### 5.2 Rule B-702 — role separation of signing keys

| Role | Held by | Signs |
|---|---|---|
| `bundle_author` | Vendor | The bundle document and its datasets |
| `facility_authority` | **Customer** | Facility fact approvals |
| `qualification_authority` | Whoever the commercial model designates | Continuity qualification reports |

A single key filling both `bundle_author` and `facility_authority` is non-conformant. Beyond the security argument, conflating them makes the vendor the attesting party for the accuracy of the customer's floorplans.

### 5.3 Anti-rollback

**Rule B-101.** The runtime rejects a bundle whose `metadata.version` is lower than the highest version previously installed under the same `metadata.name` (`E_ROLLBACK`), unless an explicit, signed, audit-logged rollback is requested and permitted by `rollback.dataCompat`.

TUF's role separation — Root, Targets, Snapshot, Timestamp, with online keys restricted to the low-trust roles — supplies the metadata layer, together with its rollback and freeze protections. ([TUF roles](https://theupdateframework.io/docs/metadata/), [TUF security](https://theupdateframework.io/docs/security/))

---

## 6. Error codes (normative)

A verifier **MUST** report the specific code. "Invalid bundle" is non-conformant: an operator in a basement needs to know whether to find a different USB stick or call security.

| Code | Meaning |
|---|---|
| `E_SCHEMA` | Document fails the JSON Schema; cite the failing rule ID |
| `E_DIGEST_MISMATCH` | Content digest does not match the manifest |
| `E_UNTRUSTED_SIGNER` | Signature valid, signer not in the trust anchor for that role |
| `E_SIGNATURE_INVALID` | Signature does not verify |
| `E_ROLLBACK` | Version lower than the highest previously installed |
| `E_STALE_METADATA` | TUF timestamp/snapshot expired |
| `E_UNPINNED_REFERENCE` | A tag or floating range survived into the bundle |
| `E_HARDWARE_UNSATISFIED` | Hardware requirement not met (raised at **plan**, before fetch) |
| `E_DATASET_MISSING` | A `referenced` dataset is absent |
| `E_CLOCK_IMPLAUSIBLE` | System clock fails plausibility checks; trust decisions suspended |
| `E_GRADE_BELOW_MINIMUM` | Qualification grade below `qualification.minimumGrade` |
| `E_CYCLE` | Cyclic `dependsOn` graph |

`E_CLOCK_IMPLAUSIBLE` deserves emphasis. Every expiry, TTL, credential lifetime, and TUF freshness check in this system keys off a clock that, on a disconnected ORB, nothing authoritative is setting. A skewed clock does not fail loudly — it silently converts every time-based trust decision into a wrong answer. Treat clock plausibility as a first-class precondition, not a diagnostic.

---

## 7. Conformance and the test corpus

**Rule B-902:** an implementation claims conformance only by passing the full corpus.

The corpus (Epic 1 deliverable 1.5) contains ≥40 fixtures. Every invalid fixture is annotated with **the exact rule ID it violates**, and the linter must cite that ID. A linter that says "invalid" without a rule ID cannot be used by an operator and cannot be regression-tested.

**Build the corpus before the linter.** A linter written first encodes its own bugs as reference behaviour.

Fixture classes required at minimum:

| Class | Examples |
|---|---|
| Valid, minimal | Only required fields |
| Valid, full | Every optional field exercised |
| Pinning | Tag instead of digest (`E_UNPINNED_REFERENCE`); floating semver range |
| Capability | Malformed `cap:` id; `providedBy` naming a nonexistent component; provided capability with no probe |
| Probe quality | Liveness-style probe (status assertion only) — **must be rejected**, per B-202 |
| Integrity | Keyless mode; missing `canonicalization`; single key in two roles |
| Freshness | Expired TUF; `revocation_epoch` decreasing |
| Hardware | `16GB` decimal units; unknown ORB class |
| Graph | Cyclic `dependsOn` |
| Qualification | Grade unqualified by hardware class (B-902); `enforcement: advisory` with a grade claim |
| Round-trip | Same document with reordered keys, differing whitespace, and NFC/NFD unicode variants — **all three must produce the identical digest** |

---

## 8. Worked example (illustrative, not a fixture)

```json
{
  "apiVersion": "grahmos.io/bundle/v1",
  "kind": "Bundle",
  "metadata": {
    "name": "hospital",
    "version": "1.4.7",
    "title": "Hospital Continuity Bundle",
    "vendor": "GrahmOS",
    "created": "2026-08-12T00:00:00Z"
  },
  "capabilities": {
    "provides": [
      {
        "capability": "cap:routing.pedestrian.indoor@1",
        "version": "1.0.0",
        "providedBy": "valhalla",
        "probe": {
          "kind": "functional",
          "request": { "method": "POST", "path": "/route" },
          "expect": {
            "status": 200,
            "jsonPath": "$.distance_m",
            "withinTolerance": { "goldenValue": 94.0, "tolerancePercent": 5 }
          }
        }
      }
    ],
    "requires": [
      { "capability": "cap:facility.truth@1", "range": ">=1.0.0 <2.0.0" }
    ]
  },
  "hardware": {
    "uptime_class": "ORB-2",
    "ram": "16GiB",
    "storage": "80GiB",
    "networking": ["wifi", "ethernet"],
    "accelerator": { "required": false }
  },
  "policies": {
    "offline": { "wan_required": false, "max_offline_days": 90 },
    "degradation": { "answerPolicy": "degraded_with_receipt", "refusalAllowed": true }
  },
  "integrity": {
    "canonicalization": "RFC8785",
    "signatures": [
      { "role": "bundle_author", "keyId": "grahmos-release-2026", "algorithm": "ed25519", "mode": "keyed" }
    ],
    "revocation_epoch": 3
  },
  "qualification": {
    "requiredTests": ["Q-01", "Q-08", "Q-12", "Q-16"],
    "minimumGrade": "A",
    "enforcement": "enforcing",
    "hardwareClassMatrix": [
      { "uptime_class": "ORB-2", "minimumGrade": "A" },
      { "uptime_class": "ORB-1", "minimumGrade": "B" }
    ]
  }
}
```

Note `hardwareClassMatrix`: the same bundle is graded A on ORB-2 and B on ORB-1. A grade that is not scoped to hardware is not a grade.

---

## 9. Open questions blocking freeze

| # | Question | Recommended default |
|---|---|---|
| 1 | Multi-arch OCI index from day one? | amd64-only; record as a known migration |
| 2 | SBOM format — CycloneDX or SPDX? | `[VERIFY]` — pick one; supporting both doubles the verification surface for no gain |
| 3 | Is `minimumGrade` enforcing? | Enforcing, with signed audit-logged override |
| 4 | Inline vs. referenced datasets — both? | Both, per `data.datasets[].delivery`. A 40 GB tile set must not be re-shipped for a config change |
| 5 | IANA registration of `vnd.grahmos.*`? | Defer until trademark clearance completes |
| 6 | Multiple concurrent bundles on one ORB? | One active bundle set with additive capability merging |
