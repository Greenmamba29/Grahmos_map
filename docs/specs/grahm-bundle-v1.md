# Grahm Bundle v1 — Normative Specification

**Status:** DRAFT. Not frozen — see §11 for the questions blocking freeze.
**Machine-readable companion:** [`grahm-bundle-v1.schema.json`](grahm-bundle-v1.schema.json) (JSON Schema 2020-12).
**Conformance harness:** [`conformance/check_schema.py`](conformance/check_schema.py) — validates the schema and exercises 27 negative fixtures.
**Conformance keywords:** MUST / MUST NOT / SHOULD / MAY per RFC 2119.

> **Schema validity is necessary but not sufficient for conformance.** §9 states exactly which rules the schema enforces and which the linter must. A reader who treats "the JSON validates" as "the bundle conforms" will ship a non-conformant bundle.

---

## 1. Scope and design position

A **Grahm Bundle** (`.grahm`) is a fully pinned, offline-verifiable description of a deployable continuity unit: what capabilities it provides, what hardware it needs, what data it carries, what services realise it, how its integrity is proven, how it rolls back, and what continuity grade it must achieve.

Three positions distinguish this from a container manifest, a Helm chart, or a package:

1. **A bundle declares capabilities, not just software.** `cap:routing.pedestrian.indoor@1` is the contract; whether Valhalla or something else satisfies it is an implementation detail the resolver handles.
2. **A bundle declares its own qualification requirement**, scoped to hardware class, and cannot select itself out of the mandatory test floor (B-903).
3. **A bundle is verifiable with no network at any point.** Not "degrades gracefully offline" — *verifiable offline*, which is why the trust anchor is carried in-band (B-704) rather than referenced.

**Non-goals for v1:** multi-node scheduling, autoscaling, service mesh, multi-tenancy, binary delta updates. A bundle describes one deployment on one machine.

> **Known inconsistency, recorded rather than hidden:** `ORB-3` ("multiple nodes + mesh + failover") is a valid `uptime_class` while multi-node scheduling is a stated non-goal. For v1 an ORB-3 host is treated as a *single logical deployment target* whose redundancy is supplied by the hardware profile, not orchestrated by the bundle. If ORB-3 is intended to mean bundle-managed failover, that is a v2 scope change and must be decided before freeze.

---

## 2. Distribution model — offline is the primary path

> **Design decision.** The primary distribution form is an **`oci-layout` directory**, optionally tarred, delivered by any means including physical media. A registry is an optimisation, not a requirement.

An air-gapped hospital receives a USB drive, not a `docker pull`. Any design where the offline path is the fallback will have an offline path that is tested last and works worst.

```
hospital.grahm/                     ← oci-layout directory
├── oci-layout
├── index.json                      ← the SIGNED INSTALL INDEX (see §2.3)
└── blobs/sha256/
    ├── <bundle-manifest>           ← artifactType = grahm bundle
    ├── <bundle-config>             ← the Grahm Bundle document (this schema)
    ├── <trust-anchor>              ← in-band keys + expiry (B-704)
    ├── <tuf-metadata>              ← root/targets/snapshot/timestamp
    ├── <signature-manifest>        ← subject → bundle manifest
    ├── <sbom-manifest>             ← subject → bundle manifest
    ├── <qualification-manifest>    ← subject → bundle manifest (post-install; see §2.3)
    └── <dataset blobs…>            ← tiles, routing tiles, indexes, models
```

### 2.1 OCI mapping

Built on **OCI Image Spec v1.1** and **OCI Distribution Spec v1.1**, which promoted `artifactType` and `subject` to top-level manifest fields and standardised the referrers API. ([OCI v1.1 release](https://opencontainers.org/posts/blog/2024-03-13-image-and-distribution-1-1/))

| Grahm concept | OCI representation |
|---|---|
| Bundle | Image manifest, `artifactType: application/vnd.grahmos.bundle.v1+json` |
| Bundle document | Manifest `config` blob |
| Dataset | Layer blob, `application/vnd.grahmos.dataset.*` |
| Trust anchor | Blob, `application/vnd.grahmos.trustanchor.v1+json` |
| Signature / SBOM / qualification report | Separate manifests, `subject` → bundle manifest digest |

**Media type registry (v1):**

```
application/vnd.grahmos.bundle.v1+json              artifactType of the bundle manifest
application/vnd.grahmos.bundle.config.v1+json       the bundle document
application/vnd.grahmos.trustanchor.v1+json         in-band trust anchor (keys + expiry)
application/vnd.grahmos.tuf.v1+json                 TUF metadata set
application/vnd.grahmos.dataset.tiles.pmtiles       vector tile dataset
application/vnd.grahmos.dataset.routing.valhalla    prebuilt routing tiles
application/vnd.grahmos.dataset.index.search        prebuilt search index
application/vnd.grahmos.dataset.facility.v1+json    facility truth export
application/vnd.grahmos.attestation.build.v1+json   dataset build attestation (B-405)
application/vnd.grahmos.revocation.v1+json          facility-authority revocation feed (B-707)
application/vnd.grahmos.signature.v1                keyed signature bundle
application/vnd.grahmos.sbom.v1                     SBOM referrer
application/vnd.grahmos.qualification.v1+json       continuity qualification report
```

`[VERIFY: whether IANA registration of these types is pursued, and under what name — coupled to the trademark workstream, and it should be settled before freeze.]`

### 2.2 Referrers — and why install must not depend on them

Registries implementing OCI Distribution v1.1 answer `GET /v2/<repo>/referrers/<digest>`. Registries that do not must be handled through the **referrers tag-schema fallback** defined in the same spec.

**Rule B-705:** install **MUST NOT** depend on a live referrers query. Offline they do not exist, and a cross-registry copy can drop them.

### 2.3 The signed install index — resolving the self-reference

A naive reading of B-705 is circular: a bundle document cannot contain the digest of a signature computed over that same document.

**The resolution:** the delivered artefact is an **OCI image index** whose members are the bundle manifest *and* its referrers. The `bundle_author` signature is over the **index**, not over a document containing its own signature's digest. `integrity.referrerIndex` in the bundle document records `indexDigest` and the expected member list, so a verifier can confirm nothing was added or removed — but the trust root for the set is the index signature.

```
   signed install index  ──┬──▶ bundle manifest ──▶ bundle document (config)
   (bundle_author sig)     ├──▶ signature manifest      │
                           ├──▶ SBOM manifest           └─ integrity.referrerIndex
                           ├──▶ trust anchor blob          records expected members
                           └──▶ TUF metadata blob
```

**Rule B-705a:** the **qualification report is explicitly NOT a member of the signed install index.** It is produced *after* installation, on the target hardware, and attached by referrers afterwards. A qualification report shipped inside the bundle would be a grade earned on someone else's hardware, which §Epic 5 of the execution plan establishes as meaningless.

---

## 3. Capability identifiers

```
cap:<domain>.<function>[.<qualifier>]@<major>
```

`<major>` is the compatibility boundary. `provides` declares an exact semver; `requires` declares a comparator range with no wildcards (B-203).

### 3.1 Rule B-205 — qualifiers do not subsume

`cap:routing.pedestrian.indoor@1` does **not** satisfy a requirement for `cap:routing.pedestrian@1`. They are distinct identifiers. A provider satisfying both **MUST declare both** in `provides`.

This is stated explicitly because it is the resolver's core matching rule and the alternative is silent divergence: one implementation satisfies an outdoor requirement with an indoor-only engine, another refuses, and neither reports anything unusual.

### 3.2 Vocabulary v1

Per **B-204**, every entry names a consumer and carries a functional probe, or it is not in the vocabulary.

| Capability | Consumer | Status |
|---|---|---|
| `cap:routing.pedestrian@1` | Outdoor routing; execution plan sequence step 8 | In v1 |
| `cap:routing.pedestrian.indoor@1` | Indoor/multi-floor routing; sequence step 11 | In v1 |
| `cap:map.tiles.vector@1` | Map client | In v1 |
| `cap:search.fulltext.offline@1` | Search | In v1 |
| `cap:incident.registry@1` | Incident capture (Eden or thin store) | In v1 |
| `cap:facility.truth@1` | Facility fact store | In v1 |
| `cap:identity.offline.verify@1` | Credential verification | In v1 |
| `cap:alert.cap.ingest@1` | CAP v1.2 ingestion | In v1 |
| `cap:alert.cap.emit@1` | CAP emission, authority-gated | In v1 |
| `cap:position.estimate@1` | Positioning | In v1 |
| ~~`cap:geocode.forward@1`~~ | **No named consumer, no adapter, no probe** | **Cut** — readmit with a consumer |
| ~~`cap:routing.vehicle@1`~~ | **No named consumer, no adapter, no probe** | **Cut** — readmit with a consumer |

The two cut entries were in an earlier draft and violated B-204 on the day B-204 was written. They are recorded here rather than deleted so that readmitting them is a decision rather than an oversight.

### 3.3 Rule B-207 — permission scopes are not capability identifiers

Credential scopes reuse the capability namespace but **MUST** carry an action verb:

```
cap:facility.truth@1#read
cap:facility.truth@1#propose
cap:facility.truth@1#approve
cap:facility.truth@1#revoke
cap:alert.cap.emit@1#emit
cap:incident.registry@1#write
```

Without verbs, "may read facility facts" and "may approve a fire exit as verified" are the same token. In a system whose safety argument rests on who attested what, that is not an acceptable granularity.

---

## 4. Canonicalisation and digests

**Rule B-701.** Digests over the bundle document are computed over **RFC 8785 JSON Canonicalization Scheme** bytes.

**Rule B-707a.** Verifiers **MUST** verify signatures over the **stored bytes**, never over a reparsed-and-reserialised object. A verifier that reparses before verifying passes today and fails after any serialiser upgrade — and the failure will look like key compromise.

### 4.1 Unicode normalisation is explicitly out of scope

RFC 8785 §3.2.2.1 states: *"Although the Unicode standard offers the possibility of rearranging certain character sequences, referred to as 'Unicode Normalization', JCS-compliant string processing does not take this into consideration. That is, all components involved in a scheme depending on JCS MUST preserve Unicode string data 'as is'."* ([RFC 8785](https://www.rfc-editor.org/rfc/rfc8785))

**Consequence, and a correction to an earlier draft of this spec:** NFC and NFD inputs are different strings and **MUST** produce different digests. An earlier draft required them to produce the *same* digest, which no conformant JCS implementation can do; implementing it would have meant adding a normalisation pass that disagrees with every JCS library — precisely the digest-instability failure this rule exists to prevent.

**Rule B-708:** the linter **SHOULD** warn when bundle string data is not already in NFC, so authors notice the ambiguity at build time rather than discovering it as a signature failure in the field.

---

## 5. Signing, freshness, and authorisation

Three distinct questions, three distinct mechanisms. Conflating them is the usual mistake.

| Question | Mechanism | Why |
|---|---|---|
| Is this intact? | SHA-256 digests | Detects corruption |
| Is this authorised? | **Keyed Cosign signature**, role-separated | Detects unauthorised authorship |
| Is this current? | **TUF metadata** with expiry and version rules | A correctly signed, intact, *year-old* bundle is the attack |

### 5.1 Rule B-703 — keyless signing is non-conformant

Cosign's keyless (Fulcio) mode is disqualified. Offline verification of keyless signatures requires a locally provisioned `trusted_root.json`, and Sigstore's own documentation states: *"The contents of this file will change without notification. By not using TUF, you will need to build your own mechanism to keep your airgapped copy of this file up-to-date."* ([cosign README](https://github.com/sigstore/cosign))

A trust anchor that silently goes stale in an air-gapped hospital is exactly the failure this system exists to eliminate.

### 5.2 Rule B-704 — the trust anchor ships in-band, as a blob

`integrity.trustAnchor` carries `keys[]` with actual public key material, an expiry, and the digest of the corresponding blob. A digest alone would not let an offline verifier resolve `signatures[].keyId` to anything.

### 5.3 Rule B-702 — role separation, and B-702a — a required role

| Role | Held by | Signs |
|---|---|---|
| `bundle_author` | Vendor | Bundle document, datasets, install index |
| `facility_authority` | **Customer** | Facility approvals, revocation feed |
| `qualification_authority` | Per commercial model | Continuity qualification reports |

**B-702a:** at least one `bundle_author` signature is required. Role separation that does not also mandate *which* role must be present is not separation — without this rule a bundle signed only by the qualification authority is conformant, and that key can author bundles.

Conflating `bundle_author` and `facility_authority` also makes the vendor the attesting party for the accuracy of the customer's floorplans.

### 5.4 Rule B-706 — key rotation

`trustAnchor.keys[].supersedesKeyId` forms a rotation chain, so an offline ORB can follow rotation from a root it already trusts. Compromise of a `bundle_author` key otherwise has no recovery path that does not require physically visiting every air-gapped site — see risk R14 in the execution plan.

### 5.5 Rule B-707 — revocation authority

`integrity.revocation_epoch_floor` is a **floor only**. The live epoch is carried in a `facility_authority`-signed revocation feed (`application/vnd.grahmos.revocation.v1+json`), because revoking a compromised staff credential is a customer act. If the epoch lived only in the vendor-signed bundle, a customer could not revoke a credential offline without the vendor issuing a new bundle.

### 5.6 Anti-rollback

**Rule B-101.** The runtime rejects a bundle whose `metadata.version` is lower than the highest previously installed under the same `metadata.name` (`E_ROLLBACK`), unless an explicit, signed, audit-logged rollback is permitted by `rollback.dataCompat`.

**Rule B-102.** The high-watermark and the revocation epoch floor are the runtime's anti-rollback state. Both **MUST** be stored such that a wipe or re-image is *detectable* — otherwise re-imaging an ORB silently resets rollback protection to zero. `[VERIFY: mechanism — TPM monotonic counter, signed state attestation, or facility-authority-countersigned checkpoint. Underdetermined; see execution plan R15.]`

---

## 6. Error codes (normative)

A verifier **MUST** report the specific code and, where the failure is a schema or lint rule, the rule ID. "Invalid bundle" is non-conformant: an operator in a basement needs to know whether to find a different USB stick or call security.

| Code | Meaning |
|---|---|
| `E_SCHEMA` | Fails schema or lint; MUST cite the rule ID |
| `E_DIGEST_MISMATCH` | Content digest does not match |
| `E_UNTRUSTED_SIGNER` | Signature valid, signer not in the trust anchor for that role |
| `E_SIGNATURE_INVALID` | Signature does not verify |
| `E_ROLLBACK` | Version lower than the highest previously installed |
| `E_STALE_METADATA` | TUF timestamp/snapshot expired |
| `E_TRUST_ANCHOR_EXPIRED` | In-band anchor past `expires` |
| `E_UNPINNED_REFERENCE` | A tag or wildcard range survived into the bundle |
| `E_HARDWARE_UNSATISFIED` | Hardware requirement unmet; raised at **plan**, before fetch |
| `E_DATASET_MISSING` | A `referenced` dataset is absent |
| `E_ATTESTATION_MISSING` | Dataset lacks a verifiable build attestation (B-405) |
| `E_CLOCK_IMPLAUSIBLE` | Clock fails plausibility; see §6.1 |
| `E_GRADE_BELOW_MINIMUM` | Grade below the applicable minimum |
| `E_CYCLE` | Cyclic `dependsOn` graph |
| `E_STATE_RESET` | Anti-rollback state absent or reset (B-102) |

**Query-time codes** — these are where the safety argument lives, and an earlier draft omitted them entirely:

| Code | Meaning |
|---|---|
| `E_FACT_EXPIRED` | Fact past TTL; returned as data with degraded confidence, never silently |
| `E_CREDENTIAL_EXPIRED` | Beyond effective grace |
| `E_CREDENTIAL_REVOKED` | Below the current revocation epoch |
| `E_REVISION_SKEW` | Dataset facility revision behind the fact store (B-406) |
| `E_NO_VERIFIED_ANSWER` | Refusal: no answer meets the freshness/verification policy |
| `E_STORAGE_FULL` | Write refused; no corruption |

### 6.1 Clock behaviour — what `E_CLOCK_IMPLAUSIBLE` actually does

An earlier draft said "trust decisions suspended" without saying what a suspended trust decision returns to a person asking for the nearest exit. Both naive readings are wrong: refusing everything turns a clock write into a denial of service during an emergency, and answering without evaluating expiry is exactly the failure the product exists to prevent.

**Rule B-709 — degraded-honest mode.** On clock implausibility the deployment:

1. Continues serving answers. It does not refuse wholesale.
2. Sets `clock_untrusted: true` on **every** Answer Receipt.
3. Downgrades every expiry-dependent claim to `confidence: unknown` — a fact whose freshness cannot be evaluated is not "fresh."
4. Denies any operation requiring credential validity beyond a grace window, since that check is unevaluable.
5. Raises a persistent operator alarm.

**Rule B-710 — anti-rewind.** The dangerous direction is *backward*, not forward. Setting the clock back un-expires facts, un-expires credentials, extends grace, and revalidates TUF metadata. The runtime **MUST** persist a monotonic high-watermark of the latest observed trusted time and treat any regression beyond a bounded tolerance as implausible. `[VERIFY: tolerance value and monotonic source — an RTC on a box with physical access is attacker-controlled, and §9 of the execution plan names the insider with physical access as the realistic threat.]`

---

## 7. Query-time freshness and revision skew

These two rules carry the product's central safety claim and belong in the artefact spec, not only in the plan.

**Rule B-402a — age derives from `source_as_of`, never `generated_at`.** Rebuilding tiles over a three-year-old OSM extract produces a dataset generated one minute ago from data three years stale. Computing age from `generated_at` launders staleness into freshness with no attacker required.

**Rule B-406 — revision skew must be detected, not merely recorded.** `facilityRef.revision` is baked in at build time; the fact store advances when the customer approves a survey. The runtime **MUST** compare them at query time. Where a dataset's revision is behind the fact store, that dataset **MUST NOT** be the sole basis for a safety-relevant answer, and the receipt **MUST** report `revision_skew`.

Without B-406 the sealed-exit scenario survives the entire Facility Truth system: Exit A is sealed at revision 12, the routing tiles were built at revision 7 and still contain the corridor, and the route is computed on revision-7 geometry while the fact store correctly knows better.

**Rule B-407 — the receipt reports the minimum.** Where an answer draws on multiple sources, the reported `facility_revision` and freshness **MUST** be the *minimum* (oldest, lowest-revision) across contributing sources, not the maximum and not the first.

---

## 8. `grahm-bundle-lint` behavioural specification

*(Deliverable 1.6. Referenced but absent from an earlier draft.)*

The linter runs after schema validation and enforces every rule in §9 marked *linter*. It **MUST**:

1. Emit one finding per violated rule, each carrying `{rule_id, json_pointer, message, severity}`.
2. Use `E_SCHEMA` with the rule ID for structural findings, and the specific error code otherwise.
3. Exit non-zero on any `error`-severity finding; `warning` severity (e.g. B-708 non-NFC strings) does not fail the build.
4. Be deterministic: identical input yields byte-identical findings in a stable order.
5. Never fetch anything from the network. The linter is the first thing that must work offline.

---

## 9. Rule registry

Every rule ID, in one place, with where it is enforced. **Rules marked *linter* are not enforced by the JSON Schema** — some because they are cross-references or graph properties JSON Schema cannot express, others because they are runtime behaviour.

| Rule | Requirement | Enforced by |
|---|---|---|
| B-001 | Conformance is claimed only by passing the full corpus | Process |
| B-101 | Reject version below installed high-watermark | Runtime |
| B-102 | Anti-rollback state must be reset-detectable | Runtime |
| B-201 | `providedBy` names a real component | **Linter** (cross-reference) |
| B-202 | Every provided capability has a functional probe | Schema |
| B-202a | Probe asserts on the response body, not status alone | Schema |
| B-202b | JSONPath is RFC 9535 | **Linter** |
| B-203 | No wildcard/floating ranges | Schema |
| B-203a | `optional` requires `degradedWithout` | Schema |
| B-204 | Vocabulary entries name a consumer and a probe | Process |
| B-205 | Qualifiers do not subsume | Runtime (resolver) |
| B-206 | Periodic probes declare a bounded interval | Schema |
| B-207 | Credential scopes carry action verbs | **Linter** / runtime |
| B-301 | Hardware refusal at plan time | Runtime |
| B-302 | `ram`/`storage` are host minimums ≥ sum of component resources | **Linter** (arithmetic) |
| B-303 | `networking: none` is exclusive | **Linter** |
| B-304 | UPS health, not mere presence, for ORB-2+ | Runtime |
| B-306 | ORB ordering; ORB-X is not ordinal | Runtime |
| B-401 | Missing referenced dataset → plan refusal | Runtime |
| B-402 | Freshness evaluated at query time | Runtime |
| B-402a | Age from `source_as_of` | Schema (presence) + runtime (use) |
| B-403 | Heavy datasets are built ahead of time | Schema (presence) + **linter** |
| B-404 | Dataset source licence recorded | Schema |
| B-405 | Verifiable build attestation | Schema (presence) + runtime (verify) |
| B-406 | Revision skew detected at query time | Runtime |
| B-407 | Receipts report the minimum across sources | Runtime |
| B-501 | Digest-pinned images | Schema |
| B-502 | Acyclic `dependsOn` | **Linter** (graph) |
| B-503 | Degraded mode is never silent | Schema |
| B-504 | Encryption at rest for incident/credential/audit data | Schema (declaration) + runtime |
| B-601 | `wan_required` caps grade at C | Runtime (grading) |
| B-602 | No answer without a receipt | Runtime |
| B-603 | Refusal cannot be disabled | Schema |
| B-604 | Break-glass is audit-chained | Schema (declaration) + runtime |
| B-605 | Exceeding `max_offline_days` sets `envelope_exceeded` on receipts | Runtime |
| B-606 | Site-side grace ceiling | Schema + runtime |
| B-607 | Break-glass quorum ≥ 2 | Schema |
| B-608 | Break-glass may not write facility verification | Schema (declaration) + runtime |
| B-701 | RFC 8785 canonicalisation | Schema (declaration) |
| B-702 | Signing-role separation | **Linter** (keyId uniqueness across roles) |
| B-702a | A `bundle_author` signature is required | Schema |
| B-703 | Keyed mode only | Schema |
| B-704 | Trust anchor in-band with key material | Schema |
| B-705 | Install does not depend on live referrers | Runtime |
| B-705a | Qualification report is not a member of the signed index | Runtime |
| B-706 | Key rotation chain | Schema (field) + runtime |
| B-707 | Revocation epoch floor; live epoch in the facility feed | Schema + runtime |
| B-707a | Verify over stored bytes | Runtime |
| B-708 | Warn on non-NFC strings | **Linter** (warning) |
| B-709 | Degraded-honest mode on clock implausibility | Runtime |
| B-710 | Anti-rewind high-watermark | Runtime |
| B-801 | Refuse incompatible rollback by name | Runtime |
| B-901 | Grade enforced pre-activation | Schema (declaration) + runtime |
| B-902 | Grades are scoped to hardware class | Schema |
| B-903 | Mandatory test floor | Schema |
| B-904 | Advisory bundles may not claim above C | Schema |
| B-905 | Matrix takes precedence over `minimumGrade` | Runtime |

**Rule ID collision fixed:** an earlier draft used `B-902` for both "conformance requires passing the corpus" and "grades are hardware-scoped." The former is now **B-001**.

---

## 10. Conformance corpus

**Rule B-001:** an implementation claims conformance only by passing the full corpus. Build the corpus **before** the linter — a linter written first encodes its own bugs as reference behaviour.

[`conformance/check_schema.py`](conformance/check_schema.py) is the seed: it validates the schema and exercises 27 negative fixtures, all currently rejected. The full corpus extends it with the *linter*-enforced rules, which that harness deliberately does not test — those fixtures will pass schema validation and must still be rejected.

| Class | Covered by the seed harness | Still required |
|---|---|---|
| Pinning, probe quality, integrity, freshness, hardware units, qualification floor, break-glass | Yes (27 fixtures) | — |
| Cross-reference (B-201), graph (B-502), arithmetic (B-302), key uniqueness (B-702), exclusivity (B-303) | No — outside JSON Schema | Linter fixtures |
| Round-trip digest stability under key reordering and whitespace change | No | Digest fixtures |
| NFC vs NFD producing **different** digests (§4.1) | No | Digest fixtures |

---

## 11. Open questions blocking freeze

| # | Question | Recommended default |
|---|---|---|
| 1 | Multi-arch OCI index from day one? | amd64-only; record as a known migration |
| 2 | SBOM format — CycloneDX or SPDX? | `[VERIFY]` — pick one; both doubles the verification surface for no gain |
| 3 | Anti-rollback state anchoring mechanism (B-102) | `[VERIFY]` — genuinely underdetermined; TPM counter, signed checkpoint, or countersigned attestation |
| 4 | Clock-rewind tolerance (B-710) | `[VERIFY]` — must be set with the pilot site's actual clock discipline in view |
| 5 | ORB-3 semantics against the single-machine non-goal (§1) | Single logical target in v1; bundle-managed failover is v2 |
| 6 | IANA registration of `vnd.grahmos.*` | Defer until trademark clearance completes |
| 7 | Multiple concurrent bundles on one ORB? | One active bundle set with additive capability merging |
| 8 | Is `answerPolicy: strict` ever right for a hospital? | Underdetermined and consequential in both directions; decide with the customer, not in engineering |
