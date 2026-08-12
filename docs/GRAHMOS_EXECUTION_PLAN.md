# GrahmOS Continuity Control Plane — Engineering Execution Plan

**Status:** Plan of record, v1 draft. No production code in this document.
**Audience:** engineering lead starting Epic 1 immediately.
**Companion artifacts:** [`specs/grahm-bundle-v1.md`](specs/grahm-bundle-v1.md), [`specs/grahm-bundle-v1.schema.json`](specs/grahm-bundle-v1.schema.json), [`agents/AGENTS.md`](agents/AGENTS.md), [`upstream/OPEN_SOURCE_REGISTRY.md`](upstream/OPEN_SOURCE_REGISTRY.md)

---

## Executive summary

1. Build **Epic 1 (Grahm Bundle v1 schema) first**, because every other epic — resolver, install, facility truth, qualification — is a consumer of it, and it is the only P0 that can be finished without any upstream integration risk. Its schema and JSON Schema draft ship in this commit.
2. Build **Epic 5's chaos harness second, not last.** "Prove it works with the cable pulled" must gate every merge from the first running service onward. Qualification as a final phase produces a demo; qualification as a merge gate produces a product.
3. **The memo's core premise does not survive contact with the accessible repositories.** Across the nine public `Grahmos*` repos I could read, there is *zero* occurrence of Sahana, Valhalla, TerraNova, OSRM, Nominatim, CAP, IndoorGML, or indoor routing. The engines are *selected*, not *integrated*. Epic 3 is therefore the long pole, not a proof-of-assembly.
4. Ship the bundle as an **`oci-layout` directory on removable media first, registry second.** An air-gapped hospital receives a USB drive, not a `docker pull`. OCI/ORAS is correct plumbing; registry-first sequencing is not.
5. Use **keyed Cosign + TUF metadata, never keyless/Fulcio.** Verified: Sigstore offline verification still needs a locally provisioned `trusted_root.json` that goes stale with no offline refresh path — which defeats the entire thesis. Keys plus TUF expiry give you offline freshness and rollback defence with no network at verification time.
6. **`gpos-by-grahmos` already contains ~70% of the *shape* of Facility Truth**: a deterministic kernel with separation-of-duties, threshold approvals, a tamper-evident hash-chained audit log, and offline outbox/sync — implemented and tested. Adapt it. Do not design Epic 4's governance core from zero.
7. Treat existing repo documentation as **specification, not inventory.** `PACK_VERIFICATION_HARDENING.md` describes a complete minisign/TOFU verification pipeline whose source files do not exist on the default branch. This gap has already caused one false "done."
8. The highest-severity risk is not staleness — it is **confident presentation of stale data**. That makes Answer Receipts and query-time expiry release gates, not P1 features.

---

## 0. Source handling, evidence, and what I could not see

### 0.1 The archive

**I do not have the archive.** `c:\Users\suppo\Downloads\Kimi_Agent_Google Maps Ingestion Build.zip` is a Windows path; this plan was produced on a Linux VM with no access to that filesystem. I searched the entire mounted filesystem for it and it is not present.

Instead of proceeding from the memo alone, I surveyed what *is* reachable: 124 public repositories under the `Greenmamba29` GitHub account, of which I deep-read nine. That survey is the empirical basis for §0.3. **Where this plan says "the accessible repos," it means those nine — not the archive.**

Questions the archive would still answer, in priority order:

| # | Question | What it would change |
|---|---|---|
| 1 | What is **TerraNova** concretely — a repo, a vendor, or an internal name for the MapLibre/PMTiles/Meilisearch layer? | Whether Epic 3 has two integrations or three |
| 2 | Does a Google-Maps-style **ingestion pipeline** already exist (OSM extract → tiles → geocode index → routing tiles)? | Could remove the single largest data-engineering task in Epic 3 |
| 3 | Are there **existing schemas** for facility/floorplan data? | Epic 4 data model may already be half-specified |
| 4 | Is there a **deployment script or ORB image** already in use at a site? | Epic 2's `apply` backend choice (Docker vs. systemd) |
| 5 | Which **hardware** is actually in the field today? | ORB class definitions become descriptive rather than speculative |

### 0.2 Verification of the memo's third-party claims

I verified every third-party technical assertion in the memo. Three of them need correction or qualification, and the corrections are load-bearing.

| Memo claim | Verdict | Evidence |
|---|---|---|
| OCI artifacts carry arbitrary types; ORAS gives generic push/pull; referrers link signatures/SBOMs | **Confirmed, and now better than the memo assumes** | OCI Image + Distribution Spec v1.1 (released 2024-03-13) promoted `artifactType` and `subject` to top-level manifest fields and standardised `GET /v2/<repo>/referrers/<digest>`, plus a **referrers tag-schema fallback** for registries that don't implement it. ([OCI announcement](https://opencontainers.org/posts/blog/2024-03-13-image-and-distribution-1-1/), [distribution-spec v1.1](https://github.com/opencontainers/distribution-spec/blob/v1.1.0/spec.md)) |
| TUF separates Root/Targets/Snapshot/Timestamp and defends against rollback and key compromise | **Confirmed** | [TUF roles & metadata](https://theupdateframework.io/docs/metadata/), [TUF security](https://theupdateframework.io/docs/security/), [TUF spec](https://theupdateframework.github.io/specification/latest/index.html) |
| Sigstore/Cosign signs arbitrary blobs; bundles verifiable without contacting the transparency service | **Confirmed but materially qualified — this changes the design** | Cosign supports offline bundle verification, but *keyless* offline verification requires a locally provisioned `trusted_root.json`. Cosign's own docs: "The contents of this file will change without notification. By not using TUF, you will need to build your own mechanism to keep your airgapped copy of this file up-to-date." ([cosign README](https://github.com/sigstore/cosign), [issue #4454](https://github.com/sigstore/cosign/issues/4454)) |
| Wi-Fi RTT ≈ 1–2 m via multilateration on compatible Android hardware | **Confirmed verbatim, with a sharp caveat** | Android: "If you measure the distance to three or more access points, you can use a multilateration algorithm… The result is typically accurate within 1-2 meters." Requires `is80211mcResponder()` / `is80211azNtbResponder()` APs. Where unavailable, **one-sided RTT "can add hundreds of meters to the estimate."** ([Android Wi-Fi RTT](https://developer.android.com/develop/connectivity/wifi/wifi-rtt)) |
| OGC IndoorGML 2.0 Part 1 published August 2025 | **Substantially confirmed — but with a correction that demotes the epic** | Document publication date is 2025-06-26; the OGC *announcement* is 2025-08-28. Critically: **Part 1 is a UML conceptual model only. Part 2 (the GML/JSON/SQL encodings) is still in progress.** There is no stable normative encoding to export against today. ([OGC 22-045r5](https://docs.ogc.org/is/22-045r5/22-045r5.html), [OGC announcement](https://www.ogc.org/announcement/ogc-publishes-indoorgml-2-0-part-1-conceptual-model-standard/), [IndoorGML-SWG](https://github.com/opengeospatial/IndoorGML-SWG)) |
| CAP is a network-independent all-hazard format with geo targeting, multilingual messaging, update/cancel | **Confirmed** | CAP v1.2, OASIS Standard approved 2010-07-01, also adopted as ITU-T X.1303 bis. ([CAP v1.2](https://docs.oasis-open.org/emergency/cap/v1.2/os/CAP-v1.2-os.html), [OASIS](https://www.oasis-open.org/standard/cap/)) |
| NIST zero-trust: network location alone must not grant trust | **Confirmed verbatim** | SP 800-207 tenet 2: "Network location alone does not imply trust." ([NIST SP 800-207](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-207.pdf)) |

**Three consequences that change the plan:**

- **Sigstore.** Keyless signing presumes OIDC reachability at sign time and trusted-root freshness at verify time. Neither holds. → **Use keyed Cosign; get freshness and anti-rollback from TUF, whose expiry model works with zero network.** (§Epic 1, §Supply chain)
- **IndoorGML.** Without Part 2, "export IndoorGML" is not a thing you can conformance-test. → **Demote from "interchange target" to "conceptual alignment target."** Align the internal facility model's *concepts* (cell space, connectivity, dual graph) to Part 1's UML so that a Part 2 encoder is a later serialisation task, not a remodelling task. Prioritise *import* (IFC/DXF/OSM/IMDF) over *export*.
- **Wi-Fi RTT.** The 1–2 m figure is real but conditional on 802.11mc/az-capable APs *and* on knowing where those APs physically are. AP coordinates are surveyed facility data. → **Positioning depends on Facility Truth (Epic 4), not the other way round.** Positioning cannot be scheduled before Epic 4's data model exists.

### 0.3 Reconciliation: memo vs. accessible repositories

The memo's framing is: *"We are no longer missing another major 'Sahana' or 'Valhalla' layer. The architecture now has the right engines."* On the accessible evidence, this is an inventory of **decisions**, not of **integrations**.

| Memo asserts | Accessible repo evidence | Verdict |
|---|---|---|
| Sahana, Valhalla, TerraNova, maps, search, databases, adapters are "already-selected capability engines" | Zero source references to Sahana, Valhalla, TerraNova, OSRM, or Nominatim in `Greenmamba29/Grahmos` or the other eight repos | **Contradicts.** Selected ≠ present |
| `.grahm` "still needs a formal schema" | No `.grahm` artefact, format, or schema anywhere. Nearest neighbours: a Dexie `ContentPack` row type (`id/name/version/signature/installedAt`), a JSON update manifest with per-file SHA-256, and an RSA-SHA256 detached signature via shell | **Confirms the gap**, and confirms it is larger than "needs a schema" — there is no artefact at all |
| Secure supply chain is P1 ("BORROW + integrate") | `PACK_VERIFICATION_HARDENING.md` describes a finished minisign/TOFU/OPFS pipeline; none of the named source files exist on the default branch. What *is* real: Ed25519 verify via tweetnacl, RSA-SHA256 manifest signing in shell, no cosign/TUF/SBOM in code | **Confirms, and raises severity.** The gap is bigger than documented |
| Offline identity unsolved | Real DPoP proof validation, mTLS-via-nginx headers, and HS512 JWT exist in `apps/edge-api`. A ~900-line RBAC module exists in `packages/auth` but is not wired and its build is skipped | **Confirms**, but there is more salvageable auth substrate than the memo implies |
| Facility Truth must be built | Absent. No floorplans, IFC, exits-as-data, provenance, or expiry anywhere | **Confirms** |
| Failure qualification must be built | Health-check shell scripts exist; PWA "offline" validation instructs a human to toggle DevTools. **No automated test severs the network** | **Confirms** |
| Indoor positioning is the biggest gap | Absent | **Confirms** |
| CAP gateway needed | Absent. `infra/prometheus/rules/grahmos-alerts.yml` is service-health alerting, not emergency alerting | **Confirms** |

**Two findings that *moot* or *reshape* memo items:**

- **Facility Truth has a working precedent in-house.** `gpos-by-grahmos` implements a deterministic governance kernel (`backend/kernel.py`) with separation-of-duties, sequenced threshold approvals, an immutable hash-chained audit log, evidence lineage, and an offline outbox with sync — verified by its own test suite, with LLM output constrained to *proposals only* that the kernel validates. That is the exact governance shape Epic 4 needs, applied to a different domain. **Adapt it; do not redesign it.** This is the single highest-leverage discovery in the survey.
- **Search and offline shell are further along than "gap list" implies.** `apps/pwa-shell` (Next.js + MapLibre + Workbox service worker) plus `apps/edge-api` (Meilisearch or SQLite FTS behind DPoP/mTLS/JWT) is a real, if demo-grade, vertical slice. Epic 3 should *wrap* this, not replace it.

**One finding that adds unplanned work:** `docker-compose.prod.yml` builds `./packages/edge-api`, a path that does not exist; two divergent edge APIs exist (`apps/edge-api` and `edge/edge-api`); and 25+ declared git submodules are not checked out. Epic 3 inherits a consolidation task the memo does not budget for.

### 0.4 Assumptions (labelled, and used throughout)

| ID | Assumption | Why it matters | How to falsify cheaply |
|---|---|---|---|
| **A1** | **TerraNova** = the internal maps/search/tiles layer, i.e. MapLibre + PMTiles + Meilisearch/SQLite-FTS as already present in `Grahmos`. No public repo by that name exists. | Determines Epic 3 scope | Answer the clarifying question in §10 |
| **A2** | Team shape is **3–6 engineers**, not 30. Every sizing below assumes small-team sequencing with one person able to hold a whole epic. | Drives "one spec owner, no design-by-committee" | Confirm headcount |
| **A3** | First target customer is a **single mid-size hospital or campus**, single building or small cluster, ORB-1/ORB-2 class hardware. | Drives ORB class priority and demo choice | Confirm pilot site |
| **A4** | Hardware is **commodity x86-64 mini-PC**, not yet fixed to a SKU. | Bundles must express hardware requirements abstractly, not by SKU | Confirm procurement |
| **A5** | Deployments are **air-gapped or intermittently connected**, and physical media (USB) is an acceptable delivery channel. | Justifies `oci-layout`-first over registry-first | Confirm site network policy |
| **A6** | No requirement yet to support **ARM** ORBs. | Affects whether bundles must be multi-arch OCI indexes from day one | Confirm hardware roadmap |

---

## Epic 1 — Grahm Bundle v1 specification + OCI/ORAS packaging

> **Start here.** Zero upstream integration risk, unblocks everything else.

### Objective

A normative, versioned, machine-checkable description of a deployable continuity unit, plus a distribution format that works identically from a registry and from a USB stick, with integrity and authorisation verifiable with no network at any point.

### Concrete deliverables

| # | Deliverable | Form |
|---|---|---|
| 1.1 | `grahm-bundle/v1` JSON Schema (Draft 2020-12) | `specs/grahm-bundle-v1.schema.json` — **shipped in this commit** |
| 1.2 | Normative prose spec: semantics, media types, canonicalisation, conformance | `specs/grahm-bundle-v1.md` — **shipped in this commit** |
| 1.3 | Capability vocabulary v1 — the controlled list of `cap:` identifiers with versioning rules | Section of 1.2, extracted later into the registry |
| 1.4 | OCI layout mapping: how a `.grahm` becomes an OCI image manifest + referrers graph | Section of 1.2 |
| 1.5 | Conformance corpus: ≥40 fixtures, valid and invalid, each invalid one annotated with the exact rule it violates | `spec/testdata/` |
| 1.6 | `grahm-bundle-lint` behavioural specification (not the implementation) | Section of 1.2 |

### Interfaces and data contracts

Top-level shape (full field list in the schema):

```
apiVersion: grahmos.io/bundle/v1
kind: Bundle
metadata:      name, version(semver), title, vendor, description, created, license
capabilities:  provides[], requires[]          # cap: identifiers + semver ranges
hardware:      uptime_class, ram, storage, cpu, accelerator, networking, power
data:          datasets[]  { id, mediaType, digest, size, freshness, facilityRef }
services:      components[] { id, image(digest-pinned), ports, health, resources,
                              dependsOn, restartPolicy, degradedMode }
policies:      offline{}, degradation{}, retention{}, breakGlass{}
integrity:     digests{}, signatures[], sbom[], tuf{}
rollback:      supersedes[], dataCompat{}, hooks{}
qualification: requiredTests[], minimumGrade, hardwareClassMatrix[]
```

**Capability identifier grammar** — the single most important contract in the system, because the resolver, the health checks, and the qualification report all key off it:

```
cap:<domain>.<function>[.<qualifier>]@<major>
  cap:routing.pedestrian.indoor@1
  cap:routing.vehicle@1
  cap:map.tiles.vector@1
  cap:search.fulltext.offline@1
  cap:geocode.forward@1
  cap:incident.registry@1
  cap:alert.cap.ingest@1
  cap:alert.cap.emit@1
  cap:facility.truth@1
  cap:identity.offline.verify@1
  cap:position.estimate@1
```

Rules: `@major` is the compatibility boundary; `provides` declares an exact version, `requires` declares a semver range; **all ranges must resolve to a pinned digest at build time** — a bundle contains no floating references.

### Build vs. borrow vs. adapt

| Component | Decision | Rationale |
|---|---|---|
| Bundle schema and semantics | **BUILD** | This is the proprietary core. Nothing off-the-shelf expresses capability + hardware class + freshness + qualification grade together |
| Artefact manifest, descriptors, digests | **BORROW — OCI Image Spec v1.1** | `artifactType` + `subject` are exactly the primitive needed; verified standardised since 2024-03 |
| Artefact linking / discovery | **BORROW — OCI referrers API + tag-schema fallback** | Fallback matters: many private/local registries lag |
| Transport | **BORROW — ORAS** (Apache-2.0) | Generic OCI push/pull; also produces `oci-layout` directories for offline |
| Local/offline registry | **BORROW — `zot`** (Apache-2.0) | OCI-native, small, runs on an ORB |
| Signing | **BORROW — Cosign, keyed mode only** (Apache-2.0) | See §0.2; keyless is disqualified by the offline requirement |
| Update metadata / freshness / anti-rollback | **BORROW — TUF via `go-tuf`** (Apache-2.0) | Expiry-based freshness is the only anti-freeze mechanism that works with no network |
| SBOM format | **BORROW** — CycloneDX *or* SPDX, `[VERIFY: pick one at spec sign-off]` | Do not invent |
| JSON canonicalisation | **BORROW — RFC 8785 JCS** | Digest stability is a correctness requirement, not a nicety |

**Explicitly rejected:** inventing a manifest format; a bespoke transport; the deprecated `oras.artifact.manifest` (superseded by OCI 1.1 `subject`/`artifactType`).

### Dependencies and ordering

None. This epic is the root of the graph. It requires only a decision-maker who can say no.

### Acceptance tests

| ID | Test | Pass criterion |
|---|---|---|
| A1.1 | Round-trip: author → OCI push → pull → verify | Byte-identical bundle digest |
| A1.2 | **Air-gap round-trip**: build on host A → `oci-layout` tar → USB → import on network-namespaced host B with no route to anywhere | Verifies and reports identical digest with zero packets emitted |
| A1.3 | Digest stability under key reordering, whitespace change, and unicode normalisation | Digest unchanged (JCS working) |
| A1.4 | Referrers discovery on a registry **without** referrers API support | Falls back to tag schema; finds all signatures and SBOMs |
| A1.5 | Lint over the invalid corpus | Every fixture rejected, each citing the specific rule ID — no generic "invalid" |
| A1.6 | Rollback attack: present bundle v1.4.6 to a runtime that has seen v1.4.7 | Rejected, reason `E_ROLLBACK` |
| A1.7 | Expired TUF timestamp with valid signatures | Rejected, reason `E_STALE_METADATA` |
| A1.8 | Unauthorised signer with structurally valid signature | Rejected, reason `E_UNTRUSTED_SIGNER` |

### Failure modes

| Failure | Severity | Mitigation |
|---|---|---|
| Digest instability from JSON reserialisation | **High** — silently breaks all signatures | JCS + verify over *stored bytes*, never over reparsed objects. (The repo's own `hardening/verify-bytes-binding` branch name suggests this was already encountered once) |
| Registry drops referrers during cross-registry copy | High | The bundle carries its own signed index of its referrers. Install **never** depends on a live referrers query |
| Trusted root staleness in air-gap | **High** | Ship trusted root in-band, versioned, with its own expiry; treat expiry as a loud warning, not a silent pass |
| Media-type collision with a future OCI/vendor type | Medium | Register `application/vnd.grahmos.*` types in the spec; `[VERIFY: whether IANA registration is pursued]` |
| Schema becomes a dumping ground | Medium | Named spec owner with veto; every field must have a consumer named in Epic 2 or it is rejected |
| Bundle size becomes unmanageable (map tiles + models) | Medium | Datasets are separate OCI blobs with independent digests, deduplicated across bundles; the manifest is small |

### Open questions

- Multi-arch OCI index from day one, or amd64-only? (Depends on **A6**.) Cheap now, expensive to retrofit.
- Does a bundle carry data, or reference an externally delivered dataset by digest? Recommendation: **both**, with `data.datasets[].delivery: inline|referenced`, because a 40 GB tile set should not be re-shipped for a config change.
- Is `qualification.minimumGrade` advisory or enforcing at install time? Recommendation: **enforcing, with a signed, logged override** — anything weaker makes the grade cosmetic.

---

## Epic 2 — Grahm Runtime + `grahm install`

### Objective

A single static binary that turns a verified bundle into a running, health-proven, qualification-attested deployment on a cold machine, deterministically and reversibly.

### The pipeline, with the memo's diagram made executable

```
  .grahm  ──▶  VERIFY ──▶ RESOLVE ──▶ PLAN ──▶ APPLY ──▶ HEALTH ──▶ QUALIFY ──▶ READY
                 │           │          │        │         │           │
              signature   hardware   signed   staged    capability   severed-
              + TUF       + software  human-   then      probes,     network
              + digests   + state     readable atomic    not port    suite
                          inventory   artefact activate  checks
                 │           │          │        │         │           │
                 └───────────┴──────────┴────────┴─────────┴───────────┘
                        every stage emits an audit record into the
                        same hash-chained log; any stage can refuse
```

**Two design decisions that differ from the memo's implied architecture:**

1. **`verify`, `resolve`, and `plan` must run with no daemon and no container runtime.** They are pure functions over (bundle, inventory, state). A hospital IT department that forbids Docker must still be able to run `grahm plan` and read the output. The container runtime is an *apply backend*, pluggable: `docker` | `podman` | `systemd` | `nspawn`. The existing Electron installer's hard Docker dependency is a constraint to relax, not inherit.
2. **`plan` emits a signed artefact before any mutation.** Change control in a hospital is not optional. `grahm plan -o plan.json` produces something a facilities director can read, approve, and archive — and `grahm install --plan plan.json` refuses to deviate from it.

### Concrete deliverables

| # | Deliverable |
|---|---|
| 2.1 | `grahm` CLI: `verify`, `inspect`, `plan`, `install`, `status`, `qualify`, `rollback`, `export`, `import`, `inventory` |
| 2.2 | `HardwareInventory` and `SoftwareInventory` schemas + collectors |
| 2.3 | `DeploymentPlan` schema + deterministic planner |
| 2.4 | Apply backends: `systemd` and `docker` for v1; interface documented for others |
| 2.5 | Capability health-probe contract |
| 2.6 | State store: what is installed, at what digest, with what plan, since when — hash-chained |
| 2.7 | Rollback executor with data-compatibility gating |

### Interfaces and data contracts

```
HardwareInventory   { cpu{arch,cores,flags}, ram_bytes, storage[{mount,bytes_free,type}],
                      accelerators[], networking[{iface,type,up}], power{ups_present,battery_pct},
                      clock{source,skew_estimate_s}, uptime_class_detected }

DeploymentPlan      { plan_id, bundle_digest, generated_at, generated_by,
                      inventory_digest, steps[], rollback_steps[],
                      estimated_bytes, estimated_downtime_class, risk_class,
                      refusals[]  # what could NOT be satisfied and why
                      signature }

PlanStep            { id, action: fetch|stage|migrate|activate|deactivate|prune,
                      target, preconditions[], postconditions[],
                      rollback_ref, reversible: bool }

CapabilityProbe     { capability, probe_kind: functional,
                      input, expected, timeout_ms, run_when: post_apply|periodic }
```

**Health checks must be capability probes, not liveness checks.** `cap:routing.pedestrian.indoor@1` is healthy when *routing between two known fixture points returns a path of plausible length* — not when port 8002 accepts a TCP connection. A service that is listening and returning empty routes is the exact failure the product exists to prevent.

`refusals[]` is a first-class output. A plan that cannot satisfy `cap:position.estimate@1` because no surveyed APs exist must say so, in the plan, before install — not fail silently at runtime.

### Build vs. borrow vs. adapt

| Component | Decision | Rationale |
|---|---|---|
| Resolver / planner | **BUILD** | Proprietary core. See constraint below |
| Constraint solving | **BUILD, deliberately simple** | v1 uses semver-range intersection over a pinned set, **not** a SAT solver. Bundles are fully pinned at build time, so install-time solving is validation, not search. A SAT solver here is unjustified complexity and a determinism risk |
| OCI pull / layout | **BORROW — ORAS Go library** | |
| Signature / TUF verification | **BORROW — `sigstore-go` / `go-tuf`** | |
| Apply backends | **ADAPT** | Thin adapters over `systemd` and the container runtime; own no orchestration |
| Container orchestration | **REJECT — do not adopt Kubernetes/Nomad** | Consistent with the memo's "no new major subsystem." A single-node ORB does not need a scheduler, and a scheduler's control plane is one more thing that fails when the network does |

**Language recommendation: Go.** Single static binary, no runtime dependency on a cold machine, and the entire borrowed toolchain (ORAS, cosign/sigstore-go, go-tuf, zot) is Go. This is a deviation from the repos' TypeScript default and should be a conscious, recorded decision.

### Dependencies and ordering

Requires Epic 1 §1.1, §1.2, §1.4 frozen. Can begin `inventory` and `plan` work against a draft schema; must not begin `verify` until the integrity section is frozen.

### Acceptance tests

| ID | Test | Pass criterion |
|---|---|---|
| A2.1 | Cold-machine install from USB, no network route | Reaches READY; zero egress packets (verified by netns counter) |
| A2.2 | Determinism: same (bundle, inventory, state) → plan, 100× | Byte-identical plan digest every time |
| A2.3 | Hardware refusal: bundle needs ORB-2, machine is ORB-0 | Refuses at `plan`, before any byte is fetched, with a readable reason |
| A2.4 | Kill `apply` at each step boundary, then re-run | Converges to either full previous state or full new state — never a third state |
| A2.5 | Kill `apply` mid-write with power cut (simulated) | No torn state; staged content discarded; previous version still serving |
| A2.6 | Rollback across a data-schema change with declared incompatibility | Refuses, names the incompatible migration |
| A2.7 | Deceptive health: routing service up but returns empty routes | Capability probe **fails**; deployment does not reach READY |
| A2.8 | Clock skewed 90 days forward | Refuses with `E_CLOCK_IMPLAUSIBLE`; does not silently treat valid signatures as expired |

### Failure modes

| Failure | Severity | Mitigation |
|---|---|---|
| Partial apply leaves a hybrid state | **Critical** | Two-phase stage-then-activate; activation is an atomic pointer/symlink swap; A2.4 and A2.5 are merge gates |
| Health passes, capability is useless | **Critical** | Functional capability probes (A2.7) |
| Clock skew breaks all signature/expiry logic offline | **High** — the classic offline killer | Explicit clock plausibility check; monotonic counters where possible; skew is a first-class inventory field and a qualification test |
| Resolver nondeterminism (map iteration order, locale, filesystem order) | High | A2.2 at 100×; sorted iteration everywhere; no wall-clock in plan generation except a recorded field |
| Docker unavailable/forbidden at site | Medium | Pluggable apply backend; systemd backend in v1 |
| Runtime becomes a general orchestrator | Medium — scope creep | Written non-goal: single-node, single-bundle-set, no scheduling, no autoscaling |

### Open questions

- **Concurrent bundles on one ORB**: does `hospital.grahm` coexist with `campus.grahm`? Recommendation: v1 supports **one active bundle set with additive capability merging**; multi-tenant isolation deferred. Decide now — it is a schema-visible choice.
- **Delta updates.** A 40 GB tile refresh over sneakernet needs deltas. Recommendation: v1 ships whole-dataset replacement with content-addressed dedup; defer binary deltas. Record as known future work so the dataset schema leaves room.

---

## Epic 3 — One bundle running Sahana + Valhalla + TerraNova

> **This is the long pole.** Per §0.3 these engines are *chosen*, not integrated. Plan accordingly.

### Objective

A single `hospital.grahm` that installs and brings to READY an incident registry, an offline routing engine, and the map/search/tile layer, coordinated only by the Grahm Runtime, on one machine, with the network severed.

### The integration reality, stated plainly

| Engine | License (verified) | Actual integration cost |
|---|---|---|
| **Sahana Eden** — `sahana/eden` | **MIT** | Python on **web2py**, which is **LGPLv3** (verified). Brings its own DB abstraction (PyDAL), own auth, own UI. Active: v6.1 tagged 2026-01-13 with Python 3.13 fixes. **This is a whole application, not a library.** |
| **Valhalla** — `valhalla/valhalla` | **MIT** | C++. Requires a **tile build** from OSM extracts — heavy, must run in CI, never on the ORB. Runtime integration itself is clean (HTTP service + tile directory). Active. |
| **TerraNova** | Unknown | **No public repo found.** Under **A1** this is the MapLibre + PMTiles + Meilisearch/SQLite-FTS stack already partly present in `Grahmos`. |

**Recommendation, offered as alternatives because this is genuinely underdetermined:**

| Option | Description | Trade-off |
|---|---|---|
| **3-A — Eden as black-box service** *(recommended)* | Run Eden unmodified behind a `cap:incident.registry@1` adapter. Never fork. | Lowest integration risk and keeps upstream compatibility. Costs: a whole web2py stack in the bundle, larger ORB footprint, an LGPLv3 component to track, and Eden's UX is not yours |
| **3-B — Thin incident store** | Implement `cap:incident.registry@1` over SQLite with the GPOS audit-chain pattern; keep Eden as an optional export target | Far smaller and fully controlled; loses Eden's humanitarian domain model and its credibility with EM stakeholders |
| **3-C — Both, adapter-selected** | The capability contract admits either provider; bundles choose | Highest optionality; costs a stable contract you must actually honour on both sides |

**Insist on this regardless of option:** the `cap:incident.registry@1` contract must be defined and testable **before** either implementation is wired. If the adapter is designed against Eden's internals, you have forked Eden by accident.

Add an explicit **gate** after the adapter contract exists: does Eden earn its footprint on ORB-1 hardware? Measure, then decide. The memo's "we already have the engines" framing should not survive an unfavourable measurement.

### Concrete deliverables

| # | Deliverable |
|---|---|
| 3.1 | Three capability adapter contracts: `incident.registry@1`, `routing.pedestrian@1` (+`.indoor`), `map.tiles.vector@1` / `search.fulltext.offline@1` |
| 3.2 | Offline data pipeline: OSM extract → Valhalla tiles → PMTiles → search index → **content-addressed datasets with declared freshness** |
| 3.3 | `hospital.grahm` reference bundle |
| 3.4 | Monorepo consolidation: resolve the two divergent edge APIs, fix the broken `docker-compose.prod.yml` path, check out or delete the 25+ dangling submodules |
| 3.5 | Capability probe fixtures per adapter (the "known two points" route, a known search term, a known tile) |

### Interfaces and data contracts

```
cap:incident.registry@1
  POST   /incidents            {type, severity, location{}, reporter{credential}, at, evidence[]}
                              -> {incident_id, accepted_at, receipt}
  GET    /incidents?since=     -> paged, monotonic cursor, survives restart
  POST   /incidents/{id}/notes
  Invariants: append-only; every write is locally durable before ACK;
              no write path requires the WAN

cap:routing.pedestrian.indoor@1
  POST   /route  {from{lat,lon,floor}, to{...}, profile, avoid[hazard_ids],
                  as_of}                      # as_of enables reproducible routes
        -> {path[], distance_m, duration_s, floors_traversed[],
            facility_revision, confidence, degraded: bool, refusal?}
  Invariant: MUST be able to return a refusal. "No verified safe route available"
             is a valid, first-class response — never a fabricated path

cap:map.tiles.vector@1     GET /tiles/{z}/{x}/{y}  + /style.json  + /tilejson.json
cap:search.fulltext.offline@1
  GET /search?q=&near=&limit=  -> {results[{id,title,kind,location,facility_revision,
                                            verified_at, confidence}], receipt}
```

Note that `facility_revision`, `verified_at`, and `confidence` appear in *routing and search responses*, not only in the facility store. Provenance that stops at the data layer cannot produce an Answer Receipt.

### Build vs. borrow vs. adapt

| Component | Decision |
|---|---|
| Routing engine | **BORROW — Valhalla (MIT)**, unmodified, service-in-bundle |
| Incident registry | **ADAPT — Eden behind an adapter** (option 3-A), with a measured gate |
| Tiles | **BORROW — PMTiles (BSD-3 impls; spec public domain/CC0)** — single-file, range-read, ideal for offline |
| Map client | **BORROW — MapLibre GL JS (BSD-3-Clause)** |
| Search | **ADAPT — existing Meilisearch / SQLite-FTS path in `apps/edge-api`** |
| Adapters, contracts, data pipeline, bundle | **BUILD** |
| Anything new and large | **REJECT** — consistent with the memo. No new major subsystem is warranted here |

### Dependencies and ordering

Requires Epic 1 (schema) and Epic 2 (`plan`/`apply`/probes). Epic 4's Facility Truth data model is required for *indoor* routing to mean anything, but *outdoor pedestrian* routing can land first and prove the pipeline. Sequence: outdoor route → contracts → Eden gate → indoor once Epic 4 lands.

### Acceptance tests

| ID | Test | Pass criterion |
|---|---|---|
| A3.1 | `grahm install hospital.grahm` on a clean ORB-1 with WAN severed at boot | All three capabilities reach READY |
| A3.2 | Route between two fixture points | Path returned; length within tolerance of a golden value |
| A3.3 | Search for a fixture term | Known result, with `verified_at` and `confidence` populated |
| A3.4 | File an incident, hard-restart the ORB, query it | Incident present, cursor monotonic |
| A3.5 | Kill the routing service only | Map and search stay READY; routing reports degraded; the app **says so** rather than showing a stale route |
| A3.6 | Delete the tile dataset | Health degrades honestly; no blank map presented as a valid map |
| A3.7 | Whole-bundle cold boot on ORB-1 | Time-to-READY within a declared budget `[VERIFY: budget set at spec sign-off]` |

### Failure modes

| Failure | Severity | Mitigation |
|---|---|---|
| Eden's footprint or startup time makes ORB-1 infeasible | **High** | Measured gate before commitment; option 3-B held in reserve |
| Valhalla tile builds attempted on the ORB | High | Tiles are build-time artefacts, shipped as datasets. Enforce in the bundle lint |
| Adapters leak engine internals, creating an accidental fork | High | Contract-first; contract tests run against a stub provider *and* the real one |
| Dataset freshness silently diverges from facility revision | **High** — this is the core safety risk | `facilityRef` on datasets; freshness is checked at query time, not ingest |
| Monorepo debt (dual edge APIs, broken paths, dangling submodules) consumes the epic | Medium | 3.4 is scheduled work, not incidental cleanup |

### Open questions

- **A1 (TerraNova)** must be answered before final scoping.
- Does the pilot site's map need OSM-derived *outdoor* data at all, or is it purely indoor? Materially changes pipeline size.
- Which language does the PWA talk to — the runtime, or the services directly? Recommendation: services directly for data-plane; runtime for status/receipts, so that a runtime restart never blackouts the map.

---

## Epic 4 — Grahm Facility Truth + offline identity/authority

### Objective

Make GrahmOS able to state, offline, *which operational facts are trusted, by whom, as of when, and for how much longer* — and to prove who is asking and what they may do, with the identity provider unreachable.

### Part A — Facility Truth

**Adapt the GPOS kernel** (`gpos-by-grahmos/backend/kernel.py`): deterministic state machine, separation of duties, sequenced threshold approvals, immutable hash-chained audit log, evidence lineage, offline outbox. Same shape, new domain.

**Lifecycle.** The memo's `DRAFT → FIELD_VERIFIED → APPROVED → ACTIVE → SUPERSEDED` is missing the two states that carry the safety argument:

```
  DRAFT ──▶ FIELD_VERIFIED ──▶ APPROVED ──▶ ACTIVE ──▶ SUPERSEDED
                                               │
                                               ├──▶ EXPIRED   (verified_at + ttl < now)
                                               └──▶ REVOKED   (explicit withdrawal)
```

**Two invariants that are the whole point:**

1. **Expiry is evaluated at query time, never at ingest.** A fact does not become stale when someone runs a job; it becomes stale when the clock passes its TTL. Any design where a background process must run for expiry to take effect will, in an air-gapped hospital, fail exactly when it matters.
2. **An expired fact is demoted, never deleted.** "Exit A was open as of 43 days ago" is more useful than silence — *provided it is presented as what it is*. Deleting it produces a map with a hole; presenting it unmarked produces the memo's sealed-exit scenario.

**Core record:**

```
FacilityFact {
  id, facility_id, revision, kind: exit|room|corridor|stair|hazard|ap|asset,
  geometry, attributes{},
  state: DRAFT|FIELD_VERIFIED|APPROVED|ACTIVE|SUPERSEDED|EXPIRED|REVOKED,
  confidence: verified|reported|inferred|stale|unknown,
  source: {kind: ifc|dxf|osm|imdf|field_survey|manual, ref, imported_at},
  survey: {surveyed_at, surveyed_by, method, evidence_refs[]},
  verification: {verified_at, verified_by, credential_id, ttl_days, expires_at},
  approval: {approved_by, approved_at, role, quorum_met, signatures[]},
  supersedes, superseded_by,
  audit_chain_head            # links into the same hash chain as every other write
}
```

`ttl_days` is **per fact kind**, not global: a fire exit's door status decays much faster than a corridor's geometry. That policy table is a deliverable and it is a safety artefact — it should be reviewed by the facilities director, not chosen by an engineer.

### Part B — Offline identity and authority

The hard constraint: **you cannot do online revocation offline.** Every workable design is a combination of four mechanisms, and the plan should say so rather than pretend one primitive solves it.

| Mechanism | What it buys | What it costs |
|---|---|---|
| **Short-lived credentials**, refreshed opportunistically whenever connectivity exists | Bounded damage from a compromised credential | People get locked out during long outages — must be tuned against outage duration, not convenience |
| **Monotonic revocation epoch** carried in bundle + facility feed | A local authority can invalidate a whole generation without contacting anyone | Coarse; bumping the epoch is disruptive |
| **Signed deny-list** distributed with facility updates | Targeted revocation that propagates by sneakernet | Only as fresh as the last delivery |
| **Break-glass** | Someone can always act in an emergency | Must be tamper-evident and reconciled afterwards, or it is just a backdoor |

**Credential contents** (per the memo, plus what it omits):

```
device_identity, user_identity, role, scope{facility_ids[], capabilities[]},
issued_at, expires_at, issuer, revocation_epoch,
break_glass_authority: none|request|grant,
assurance_level,                 # how was this identity proven?
offline_grace_seconds,           # how long past expiry may it be honoured, and by whose policy?
signature
```

`offline_grace_seconds` is the field the memo is missing and the one that will be argued about most: it is where "fail secure" and "fail available" collide, and in a burning building the right answer is not obvious. Make it explicit, per-role, and signed by the issuer — so the trade-off is a recorded policy decision rather than an accident of implementation.

**Credential format — genuinely underdetermined, presented as alternatives:**

| Option | Fit | Maturity | Offline behaviour | Integration cost |
|---|---|---|---|---|
| **X.509 + CRL shipped in-bundle** | Good | Very high | Excellent; every platform verifies X.509 | Low. Awkward for rich scopes; CRL size grows |
| **COSE/CWT** (compact, binary) | Very good for badges/NFC/QR and constrained devices | High | Excellent; small enough for a QR code | Medium; fewer off-the-shelf libraries in JS |
| **W3C Verifiable Credentials + status list** | Best semantic fit for role/scope/issuer | Medium; ecosystem still moving | Good, but status lists assume periodic refresh | Highest |

**Recommendation:** X.509 for *device* identity (mTLS already exists in `apps/edge-api`), COSE/CWT for *user* credentials that must fit on a badge or QR code. Revisit VCs when the ecosystem settles. **Do not** build a bespoke JWT dialect — that is inventing a credential format, which the memo rightly warns against elsewhere.

**Break-glass must be:** quorum-of-two where staffing allows, time-boxed with a hard expiry, scope-limited, unable to alter the audit chain, and productive of an audit entry hash-chained into the *same* log as every other write. A break-glass action that is not visible afterwards is indistinguishable from a compromise.

### Build vs. borrow vs. adapt

| Component | Decision |
|---|---|
| Facility Truth state machine, lifecycle, TTL policy | **ADAPT the GPOS kernel pattern** — proven in-house, same shape |
| Audit chain | **ADAPT — GPOS hash-chain** |
| Crypto primitives | **BORROW** — no bespoke crypto, ever |
| Credential format | **BORROW — X.509 / COSE-CWT** |
| Authority contracts, epochs, break-glass, grace policy | **BUILD** — proprietary and irreducibly domain-specific |
| Full IdP | **REJECT** — do not build one; integrate opportunistically when online |

### Dependencies and ordering

Facility Truth's data model must precede indoor routing (Epic 3 indoor) and all of positioning. Offline identity must precede any write path exposed beyond the LAN, and precedes CAP *emission* (only credentialed roles may emit an alert).

### Acceptance tests

| ID | Test | Pass criterion |
|---|---|---|
| A4.1 | Approve a fact without the required quorum | Rejected; audit entry recorded |
| A4.2 | Advance the clock past a fact's TTL, then query | Returned as `EXPIRED`/`stale`, still present, and the consuming answer changes wording |
| A4.3 | Tamper with any audit record | Chain verification fails and names the first broken link |
| A4.4 | Present a credential revoked by epoch bump | Denied offline, no network |
| A4.5 | Present a credential expired by `offline_grace_seconds + 1` | Denied; within grace → allowed and logged as a grace-use |
| A4.6 | Break-glass action | Succeeds, is time-boxed, appears in the audit chain, and surfaces in the next reconciliation report |
| A4.7 | **The sealed-exit scenario**: mark Exit A sealed 7 months ago; ask for nearest exit | Never routes through Exit A; if no alternative is verified, returns a refusal |
| A4.8 | Import the same IFC twice | Idempotent; no revision churn |

**A4.7 is the epic's definition of done.** If it does not pass, nothing else in this epic matters.

### Failure modes

| Failure | Severity | Mitigation |
|---|---|---|
| Stale data presented confidently | **Critical — the product's core safety risk** | A4.7 as a release gate; query-time expiry; refusal as a first-class response |
| Approval theatre — one person holds all roles | High | SoD enforced in the kernel, not in UI; A4.1 |
| Break-glass becomes the normal path | High | Rate-limit, time-box, and put grace/break-glass counts on the qualification report where an auditor sees them |
| Credential lockout during a long outage | High — a safety risk in the *other* direction | Per-role `offline_grace_seconds`; explicit signed policy; tested in both directions |
| TTL policy set by engineers rather than facilities | Medium | The TTL table is a signed, reviewed artefact owned by the customer |
| Clock manipulation to extend credentials or freshness | High | Clock plausibility checks (shared with Epic 2); skew is a qualification test |

### Open questions

- Who is the **issuing authority** at a single-hospital pilot — the vendor, or the hospital? Determines whether the root is customer-held. Strong recommendation: **customer-held signing for facility approvals, vendor-held for bundle authorship.** Conflating them makes the vendor liable for the accuracy of the customer's floorplans.
- Is there an existing badge/credential system on site to piggyback on? Materially changes Part B's cost.

---

## Epic 5 — Grahm Qualification

> **Sequenced second, not fifth.** The harness must gate merges from the first running service.

### Objective

An automated, auditable suite that proves continuity by *actually* severing connectivity below the application, and emits a signed, comparable report.

### Concrete deliverables

| # | Deliverable |
|---|---|
| 5.1 | Chaos harness operating on network namespaces / firewall rules / systemd units — **not application mocks** |
| 5.2 | Normative test matrix with stable test IDs |
| 5.3 | Grading rubric (normative — otherwise the grade is marketing) |
| 5.4 | Signed `ContinuityQualificationReport`, attached to the bundle digest via OCI referrers |
| 5.5 | **Negative-control bundle**: a deliberately broken bundle that MUST fail. If it passes, the suite is broken |
| 5.6 | CI integration: qualification runs on every merge to the bundle or runtime |

### The test matrix

The memo's list, plus five conditions it omits that are the ones that actually bite:

| ID | Condition | Expected |
|---|---|---|
| Q-01 | WAN interface down | PASS — all capabilities serve |
| Q-02 | Cloud endpoints unreachable (routed to blackhole) | PASS |
| Q-03 | DNS returns NXDOMAIN | PASS |
| **Q-04** | **DNS returns wrong answers (hijack, not outage)** | PASS — a *lying* resolver is a different and nastier failure than a dead one |
| Q-05 | Edge node unavailable | PASS degraded, honestly reported |
| Q-06 | Power restart | PASS — READY within budget, no data loss |
| **Q-07** | **Power cut mid-write** | PASS — no torn state |
| **Q-08** | **NTP skew / clock jump (±90 days)** | PASS — refuses implausible clocks rather than silently mis-evaluating expiry. *The single most under-tested offline failure* |
| Q-09 | Stale update presented | REJECT `E_STALE_METADATA` |
| Q-10 | Corrupt pack | REJECT `E_DIGEST_MISMATCH` |
| Q-11 | Unauthorised pack | REJECT `E_UNTRUSTED_SIGNER` |
| **Q-12** | **Downgrade/rollback attack** | REJECT `E_ROLLBACK` |
| Q-13 | Local routing | PASS |
| Q-14 | Local search | PASS |
| Q-15 | Incident capture + persistence across restart | PASS |
| **Q-16** | **Expired facility data** | PASS *as degraded* — the answer's wording must change. Fails if the answer is unchanged |
| **Q-17** | **Expired credential / revoked epoch** | Denied offline |
| Q-18 | Partial service failure (each service killed in turn) | Remaining capabilities honest about what is lost |
| Q-19 | Storage full | Graceful refusal, no corruption |
| Q-20 | Cold boot time to READY | Within declared budget for the hardware class |

**Q-08 and Q-16 are the two most valuable tests here.** Q-08 because clock skew silently invalidates every trust decision in a disconnected system, and Q-16 because it is the only test that mechanically enforces the memo's central safety argument.

### The report — and one correction to the memo

The memo's sample report grades a bundle. **A grade must be scoped to (bundle, hardware class, site), not to a bundle alone.** `hospital.grahm 1.4.7` earning an A on ORB-2 says nothing about its behaviour on ORB-0 with one flaky AP.

```
GRAHM CONTINUITY QUALIFICATION
  bundle:         hospital.grahm @ sha256:…
  hardware_class: ORB-2   (detected: ORB-2)
  site:           <site_id>          harness_version: <v>
  clock_source:   <rtc|gps|ntp>      run_at: <ts>

  Q-01 WAN independence ............ PASS
  Q-08 clock skew tolerance ........ PASS
  Q-12 rollback resistance ......... PASS
  Q-16 stale-data honesty .......... PASS   (answer degraded as required)
  …
  grace_uses: 0     break_glass_uses: 0
  Continuity Grade: A     (rubric v1)
  signature: …    attached to bundle digest via OCI referrers
```

**Grading rubric (normative sketch — must be fixed at spec sign-off):**

| Grade | Criteria |
|---|---|
| **A** | All REJECT tests reject; all PASS tests pass; Q-16 degrades correctly; cold boot within budget |
| **B** | All REJECT tests reject; ≤2 PASS tests degrade gracefully with honest reporting |
| **C** | All REJECT tests reject; degradation present but reporting incomplete |
| **F** | **Any** REJECT test fails to reject, **or** Q-16 fails. No partial credit — a system that accepts an unauthorised bundle or lies about stale data has no grade |

The asymmetry is deliberate: integrity and honesty failures are disqualifying, availability failures are gradeable.

### Build vs. borrow vs. adapt

| Component | Decision |
|---|---|
| Test matrix, rubric, report schema | **BUILD** — this is the commercial artefact |
| Fault injection | **BORROW** — Linux netns, `nftables`, `tc`, cgroup freezing, systemd. No chaos-engineering platform is warranted for a single node |
| Report signing | **BORROW** — same Cosign path as Epic 1 |
| Existing shell health-check scripts | **ADAPT** — real coverage exists in `scripts/` and `edge/ops/`; harvest the assertions, discard the pre-recorded log files |

### Acceptance tests (tests for the tests)

| ID | Test | Pass criterion |
|---|---|---|
| A5.1 | Run against the negative-control bundle | Grade F, with the specific failing test IDs named |
| A5.2 | Verify severance is real | Packet counter on the severed interface is zero for the duration |
| A5.3 | Re-run the identical suite twice | Identical grade; flake rate under a declared threshold |
| A5.4 | Report tamper | Signature verification fails |
| A5.5 | Run on a hardware class below the bundle's declared minimum | Reports class mismatch rather than a misleading grade |

### Failure modes

| Failure | Severity | Mitigation |
|---|---|---|
| The suite tests the mock, not the system | **Critical — it invalidates the entire commercial claim** | Fault injection strictly below the application; A5.2 packet-counter proof; A5.1 negative control |
| Grade inflation under commercial pressure | High | Rubric is versioned and signed; grades cite `rubric v<n>`; F is non-negotiable on integrity and honesty |
| Flaky tests erode trust in the gate | High | A5.3; quarantine lane; a flaky test is a bug in the test or the system, never an accepted condition |
| Suite becomes slow enough that people skip it | Medium | Fast lane on every merge, full matrix nightly and pre-release |

### Open questions

- Is the report intended to be **third-party auditable**? If yes, the rubric and harness must be publishable, which constrains how proprietary they can be. This is a commercial decision with a direct engineering consequence, and it should be made before the rubric is written.
- Should the grade appear **in-product** to end users, or only to operators and auditors?

---

## Lower-priority items

### Indoor positioning — `GrahmPositioningInterface`

```
PositionEstimate {
  position{lat, lon, floor}, frame: facility|wgs84,
  confidence: {horizontal_radius_m, level: 0.95},   # a metric, not a vibe
  method: wifi_rtt|uwb|ble|qr|nfc|inertial|manual,
  contributing_sources[], estimated_at, facility_revision
}
```

- **Manual selection is always present, never a fallback tier.** A "You are here" QR/NFC anchor and a tap-the-map control are always available and always outrank a low-confidence estimate. During an emergency, a person pointing at where they are is high-quality data.
- **`confidence` must be a documented statistical quantity** (e.g. 95% horizontal radius in metres). A 0–1 score that means nothing consistent is worse than no score, because it will be rendered as certainty.
- **Depends on Epic 4.** Wi-Fi RTT multilateration needs surveyed AP coordinates, which are facility facts with provenance and expiry — an AP that moved is a silently wrong position. Schedule accordingly.
- Verified constraint: without 802.11mc/az responders, one-sided RTT error is on the order of *hundreds of metres*. The interface must refuse to emit a position rather than emit one that bad.

### CAP as canonical alert input/output

- **Ingest first, emit later.** Ingest is low-risk and immediately useful; emission puts you in the public-warning path and requires Epic 4's authority model.
- CAP v1.2 (verified) is XML; validate against the schema; treat `expires` as authoritative and **never render an expired CAP alert as active** — the same query-time-expiry rule as facility data.
- Map `msgType` Update/Cancel and `references` into the Grahm Alert Contract's supersession chain; do not flatten it.
- Emission is gated on a credential with `cap:alert.cap.emit@1` scope. `[VERIFY: whether the pilot site has any authority to emit public warnings at all]` — likely not, which supports ingest-first.

### IndoorGML as an interchange target

**Demoted, per §0.2.** Part 2 encodings are not published, so there is nothing to conformance-test against.

- **Now:** align the internal facility model's *concepts* to Part 1's UML (cell space, boundary, connectivity, primal/dual graph, navigation extension) so a future encoder is serialisation work, not remodelling.
- **Now:** build *importers* — IFC, DXF, OSM, IMDF — because those are where real floorplans live.
- **When Part 2 publishes:** write the encoder. Track [`opengeospatial/IndoorGML-SWG`](https://github.com/opengeospatial/IndoorGML-SWG).
- The memo's goal — "don't lock the product to our importer implementation" — is achieved by the conceptual alignment, not by an export that cannot yet be validated.

### Secure bundle/update supply chain

Covered in Epic 1. The design in one line: **keyed Cosign for authorisation + TUF for freshness and anti-rollback + SBOM per bundle + trusted root shipped in-band with its own expiry.** Keyless is disqualified (§0.2).

### Offline answer provenance — "Answer Receipts"

The most distinctive user-visible feature, and the mechanical enforcement of the safety argument.

```
AnswerReceipt {
  claim, answer_kind: answer|degraded_answer|refusal,
  sources[{kind, id, facility_revision, verified_at, confidence}],
  engines[{capability, provider, version, bundle_digest}],
  freshness{oldest_source_age_s, policy_threshold_s, breached: bool},
  degradation{wan: up|down, services_degraded[]},
  generated_at
}
```

- **`refusal` is a first-class `answer_kind`.** "No verified safe route available" must be as easy to produce as an answer, and must be produced automatically when the sources fail the freshness policy — not left to a UI decision.
- The receipt is generated by the runtime from the capability responses, **not** composed by the UI. A UI-composed receipt is a UI that can be persuaded to lie.
- This is also the natural place for the LLM boundary, and the GPOS precedent applies directly: **models propose, the kernel decides.** No model output reaches a user without a receipt derived from verified capability responses.

### ORB hardware classes

Define as **testable profiles**, each with a qualification baseline, not as a marketing ladder.

| Class | Shape | Qualification baseline |
|---|---|---|
| ORB-0 | Single device | Q-01…Q-04, Q-13…Q-16 |
| ORB-1 | Mini PC + SSD + LAN/Wi-Fi | + Q-06, Q-19, Q-20 |
| ORB-2 | Redundant storage + UPS + dual networking | + Q-07, Q-05 |
| ORB-3 | Multiple nodes + mesh + failover | + node-loss failover |
| ORB-X | Rugged / vehicle / remote | + environmental `[VERIFY: env spec]` |

A class is only real once the harness can *detect* it and the rubric can *grade against* it. Until then it is a label.

### Global Capability Registry

**Defer, deliberately.** The capability vocabulary from Epic 1 is the seed and costs nothing extra. A registry service before there are multiple bundles and multiple providers is infrastructure in search of a use. Note: `GrahmOS_SmartDirectory` is a SaaS-listing and lead CRM schema; it is **not** a capability registry and should not be bent into one.

### Upstream compatibility automation

- Nightly builds against upstream HEAD for Valhalla and Eden, running **contract tests only** — not the full e2e suite. The signal you want is "did the capability contract break," not "did anything change."
- Pin exact upstream digests in bundles; upstream drift never reaches a deployment implicitly.
- Pair with the upstream contribution policy (§9) so that fixes go up rather than accumulating as local patches.

---

## 6. Dependency graph

```
                    ┌─────────────────────────────────────┐
                    │ EPIC 1  Bundle v1 spec + OCI/ORAS   │  ◀── START HERE
                    │  schema · media types · capability  │      (no upstream risk)
                    │  vocabulary · signing · conformance │
                    └──────────────┬──────────────────────┘
                                   │ freezes the contract everything reads
              ┌────────────────────┼────────────────────────┐
              ▼                    ▼                        ▼
   ┌──────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
   │ EPIC 2  Runtime  │  │ EPIC 5  Qualification│  │ Supply chain (P1)    │
   │ verify · resolve │  │ harness FIRST, then  │  │ keyed cosign + TUF   │
   │ plan · apply     │◀─┤ matrix · rubric      │  │ + SBOM + in-band root│
   │ health probes    │  │ gates every merge    │  └──────────────────────┘
   └────────┬─────────┘  └──────────┬───────────┘
            │                       │ (continuous gate, not a phase)
            ▼                       │
   ┌──────────────────────────────┐ │
   │ EPIC 3  One bundle:          │ │
   │ Eden + Valhalla + TerraNova  │◀┘
   │ adapters · data pipeline     │
   │ + monorepo consolidation     │
   └────────┬─────────────────────┘
            │  outdoor routing can land before Epic 4
            │  indoor routing CANNOT
            ▼
   ┌──────────────────────────────┐
   │ EPIC 4  Facility Truth       │
   │ + offline identity/authority │
   │ (adapt the GPOS kernel)      │
   └────────┬─────────────────────┘
            │
   ┌────────┴──────────┬──────────────────┬─────────────────┐
   ▼                   ▼                  ▼                 ▼
 Indoor routing   Positioning (P1)   Answer Receipts   CAP emit (P1)
 (needs facility  (needs surveyed    (needs sources    (needs authority
  graph)           AP coordinates)    with provenance)   model)
                                            │
                                            ▼
                                   CAP ingest can start
                                   earlier — no auth needed
```

**Ordered sequence with the gating condition for each step:**

| # | Step | Unblocked by | Gate to exit |
|---|---|---|---|
| 1 | Bundle schema + capability vocabulary frozen | — | Conformance corpus passes; spec owner signs off |
| 2 | Chaos harness skeleton + `verify` | 1 | A5.2 proves severance is real |
| 3 | `inventory` + `plan` (deterministic, no apply) | 1 | A2.2 determinism at 100× |
| 4 | `apply` + capability probes | 2, 3 | A2.4, A2.5, A2.7 |
| 5 | Capability contracts for the three adapters | 1 | Contract tests pass against stubs |
| 6 | Data pipeline (OSM → tiles → routing tiles → index) | 5 | Golden-value route and search |
| 7 | Eden footprint gate | 5 | Measured decision recorded |
| 8 | `hospital.grahm` reaches READY offline | 4, 6, 7 | A3.1 |
| 9 | Facility Truth kernel + lifecycle + TTL policy | 1 | **A4.7 sealed-exit test** |
| 10 | Offline credentials + epochs + break-glass | 9 | A4.4, A4.5, A4.6 |
| 11 | Indoor routing on the facility graph | 9 | Indoor golden route |
| 12 | Answer Receipts wired end to end | 9, 8 | Q-16 degrades correctly |
| 13 | Full qualification matrix + rubric + signed report | 4, 8, 12 | A5.1 negative control fails as designed |
| 14 | Positioning, CAP, IndoorGML alignment | 9, 13 | — |

**Deviation from the memo, and why:** the memo orders Qualification fifth. Steps 2 and 13 split it: the *harness* is second, the *full matrix and rubric* are thirteenth. Building the harness after the system means every prior epic was merged without offline proof, and retrofitting offline behaviour is far more expensive than requiring it.

---

## 7. Smallest credible demo — "The Unplugged Floor"

**One building. One ORB-1. One `hospital.grahm`. One witness who physically pulls the cable.**

Under ninety seconds, on a phone in airplane mode with no SIM, with the ORB's WAN uplink physically disconnected by someone in the room:

| # | Action | What it proves | Epic |
|---|---|---|---|
| 1 | Witness unplugs the WAN cable. Harness shows the packet counter at zero. | The severance is real, not simulated | 5 |
| 2 | Search "nearest AED" → result appears | Offline search works | 3 |
| 3 | Result carries a receipt: *"Local facility map · Verified 18h ago · Routing engine local"* | Provenance, not just an answer | 4 + Receipts |
| 4 | Request a route → walking path across two floors | Offline indoor routing | 3 + 4 |
| 5 | File an incident. Power-cycle the ORB. Query it → still there | Durable local writes across restart | 2 + 3 |
| 6 | Attempt to install a tampered bundle → refused, with a readable reason | Integrity is enforced, not claimed | 1 + 2 |
| 7 | **Set Exit A's verification date 7 months back and mark it sealed. Ask again.** The route changes; the wording becomes *"Facility data last verified 43 days ago. Confirm conditions before proceeding."* And when nothing is verified: *"No verified safe route available."* | **The product thesis.** The system degrades instead of lying | 4 + 5 |
| 8 | Harness prints a signed Continuity Qualification report on the spot | The claim is auditable | 5 |

**Step 7 is the demo.** Steps 1–6 show an offline system; plenty of things are offline systems. Step 7 shows a system that knows the difference between what it knows and what it used to know — which is the thing nobody else is selling.

**Scope discipline:** no positioning, no CAP, no IndoorGML, no multi-node, no mesh, one facility, one floor pair, one bundle. Every one of those additions makes the demo longer and none makes it more convincing.

---

## 8. Staffing and effort shape

Sizing is expressed as *scope, invasiveness, and risk* — not calendar time (**A2**: 3–6 engineers).

| Epic | Roles needed | Invasiveness | Dominant risk |
|---|---|---|---|
| **1 — Bundle spec** | 1 spec owner with veto; 1 reviewer | Greenfield; touches nothing existing | Scope creep in the schema |
| **2 — Runtime** | 1–2 systems engineers (Go); ops review | Greenfield binary; new language for this org | Determinism and partial-apply correctness |
| **3 — One bundle** | 1 integration engineer + 1 data engineer; part-time C++/Python familiarity | **Most invasive** — touches every existing repo, plus consolidation debt | Eden footprint; tile pipeline volume; monorepo debt |
| **4 — Facility Truth + identity** | 1 engineer adapting the GPOS kernel + 1 security-literate reviewer; **customer facilities stakeholder required** | New subsystem; deep contracts into Epic 3 | Getting the TTL and grace policies wrong in either direction |
| **5 — Qualification** | 1 engineer with Linux networking depth | Cross-cutting; needs privileged test infrastructure | Suite that tests the mock |

**Sequencing constraints that matter more than headcount:**
- Epic 1 is a **single-owner** artefact. Design-by-committee produces a schema with no consumers.
- Epic 4 cannot be done without a **customer-side facilities stakeholder**. The TTL table is a safety artefact, not an engineering preference.
- Epic 5 needs **privileged infrastructure** (netns, nftables, power-cut simulation). Procure or provision that before it is needed, or the epic stalls on access rather than on work.

---

## 9. Non-technical workstreams (run in parallel, starting now)

The memo is right that these must start before the architecture spreads across twenty repos. It is already spread across more than twenty.

| Workstream | Immediate action | Engineering coupling |
|---|---|---|
| **Trademark** | Clear and file the marks that carry the category: Grahm Bundle, Grahm Runtime, Grahm Qualification, Grahm Facility Truth, ORB. Decide which names are *marks* and which are *spec terms* — a spec term you want others to adopt cannot also be an enforced mark | Names are baked into media types (`application/vnd.grahmos.*`) and capability IDs. Renaming after Epic 1 is a breaking change |
| **Patent / prior-art** | Prior-art search **before** filing, specifically on: capability-resolved offline deployment bundles, continuity grading, and provenance-scored offline answers. Note: public repos already state **"Patents pending"** and publish an enterprise price band — verify those public disclosures against filing strategy | An unsearched claim area can force a redesign after implementation |
| **License inventory** | Verified findings in [`upstream/OPEN_SOURCE_REGISTRY.md`](upstream/OPEN_SOURCE_REGISTRY.md). Headline: engines are permissive (Valhalla MIT, Eden MIT, PMTiles BSD-3, MapLibre BSD-3, ORAS/cosign/go-tuf/zot Apache-2.0), **but Sahana Eden runs on web2py, which is LGPLv3** — the one real copyleft exposure found. Its own license text expressly permits releasing applications under any license and redistributing web2py alongside them, so the exposure is manageable, but it must be tracked, and modifications to web2py itself carry obligations | Determines whether Eden ships as a separate process (clean) or is linked in (not clean). Reinforces option **3-A**, black-box service |
| **Security threat model** | STRIDE over: bundle authorship, distribution media, install, offline credential, break-glass, facility approval, answer generation. Explicitly include the **insider with physical access**, which is the realistic ORB threat | Directly produces Epic 5 test IDs and Epic 4 invariants |
| **Upstream contribution policy** | Written policy: contribute fixes upstream by default; never fork silently; pin digests; a local patch requires a filed upstream issue | Prevents the divergence that upstream compatibility automation exists to catch |
| **Commercial packaging** | Decide early whether the **qualification report is third-party auditable** — it changes how much of the rubric and harness can stay proprietary. Also settle bundle-vs-seat-vs-site pricing, because it determines whether multi-bundle-per-ORB is a v1 requirement | Both are schema-visible in Epics 1 and 5 |

**A flag worth raising:** an evacuation-routing product carries a safety-critical liability profile the memo does not address. Not a legal question (out of scope), but an engineering one: there must be a documented **failure-to-safe** behaviour, and the qualification report is the natural evidence artefact for it. Design it as evidence from the start rather than retrofitting it when someone asks.

---

## 10. Risk register

Severity: **S1** catastrophic (harm or total loss of trust) · **S2** major · **S3** moderate.

| # | Risk | Sev | Likelihood | Mitigation | Owner |
|---|---|---|---|---|---|
| **R1** | **Confident presentation of stale data.** The memo's sealed-exit scenario. Offline resilience makes wrong information *more* durable, and a confident UI converts staleness into harm | **S1** | High without deliberate design | Query-time expiry; demote-never-delete; refusal as a first-class answer kind; receipts generated by the runtime, not the UI; **A4.7 and Q-16 as release gates** | Epic 4 |
| **R2** | Qualification suite tests mocks instead of the system, so the entire commercial claim is unfounded | **S1** | Medium | Fault injection below the application; packet-counter proof (A5.2); negative-control bundle (A5.1) | Epic 5 |
| **R3** | Clock skew silently invalidates every offline trust decision — expiry, signatures, TTLs, credentials all key off time that nothing authoritative is setting | **S1** | **High and under-appreciated** | Clock plausibility checks in the runtime; skew as an inventory field; Q-08 as a graded test; monotonic counters where feasible | Epics 2, 4, 5 |
| **R4** | Credential lockout during a long outage — failing secure becomes a safety failure in the other direction | **S1** | Medium | Per-role `offline_grace_seconds` as signed policy; break-glass with quorum and audit; tested in both directions (A4.5, A4.6) | Epic 4 |
| **R5** | Documentation–reality gap. The org has already shipped a document describing a complete verification pipeline whose code does not exist. Planning on top of such documents produces plans that are wrong at the foundation | **S2** | **Observed, not hypothetical** | Docs describing unbuilt work are labelled specifications; "done" requires a passing acceptance test ID, never a markdown file | All |
| **R6** | Sahana Eden's footprint (web2py stack) makes ORB-1 infeasible, discovered after integration | **S2** | Medium | Measured gate before commitment; option 3-B held in reserve; contract-first so the swap is cheap | Epic 3 |
| **R7** | Trusted-root staleness in air-gap. Verified: Sigstore's trusted root changes without notice and has no offline refresh path | **S2** | High if keyless is used | Keyed cosign only; TUF for freshness; root shipped in-band with explicit expiry and a loud warning | Epic 1 |
| **R8** | Digest instability breaks every signature silently after a serialisation change | **S2** | Medium | RFC 8785 JCS; verify over stored bytes; A1.3 | Epic 1 |
| **R9** | Positioning ships with unusable accuracy where APs lack 802.11mc/az — verified error on the order of hundreds of metres with one-sided RTT | **S2** | High at unsurveyed sites | Interface refuses to emit rather than emitting a bad estimate; manual selection always present and always outranking low confidence | Positioning |
| **R10** | Monorepo debt (two divergent edge APIs, broken prod compose path, 25+ dangling submodules) silently consumes Epic 3 | **S3** | High | Scheduled as deliverable 3.4, not treated as incidental | Epic 3 |
| **R11** | IndoorGML export built against an unpublished encoding, then rebuilt when Part 2 lands | **S3** | Medium | Conceptual alignment now, encoder later; import prioritised | IndoorGML |
| **R12** | Names embedded in media types and capability IDs before trademark clearance | **S3** | Medium | Clear marks before Epic 1 sign-off — the cheapest it will ever be | Non-technical |
| **R13** | Grade inflation under commercial pressure hollows out the qualification claim | **S2** | Medium | Versioned signed rubric; F non-negotiable on integrity and honesty failures; consider third-party auditability | Epic 5 |

---

## 11. P0 disposition — every memo P0 accounted for

| Memo P0 | Disposition |
|---|---|
| Grahm Bundle Specification | **Scheduled — Epic 1.** Schema and spec drafts shipped in this commit |
| Grahm Runtime / Resolver | **Scheduled — Epic 2.** Two deviations recorded: no-daemon verify/resolve/plan; signed plan artefact before mutation |
| Offline identity & authority | **Scheduled — Epic 4 Part B.** Credential format presented as alternatives; X.509 + COSE/CWT recommended |
| Facility Truth System | **Scheduled — Epic 4 Part A.** Adapting the GPOS kernel; two lifecycle states added; A4.7 is the definition of done |
| Failure Qualification | **Scheduled — Epic 5, resequenced to second.** Five test conditions added beyond the memo's list |

| Memo P1/P2 | Disposition |
|---|---|
| Indoor positioning | Scheduled after Epic 4 (dependency established, not assumed) |
| Emergency standards gateway | CAP **ingest** scheduled early; CAP **emit** gated on Epic 4. IndoorGML **demoted** with stated reason |
| Secure bundle/update supply chain | **Folded into Epic 1** — not separable from the bundle spec; keyless Sigstore rejected with evidence |
| Offline answer provenance | Scheduled; elevated in importance — it is the enforcement mechanism for R1, not a UX feature |
| Power/network hardware profile | Scheduled as ORB classes, redefined as testable profiles with qualification baselines |
| Global Capability Registry | **Explicitly deferred.** Capability vocabulary seeded free in Epic 1; a registry service is premature |
| Upstream compatibility automation | Scheduled as contract-test-only nightly builds, paired with the contribution policy |

---

## 12. Open questions

**The one clarifying question, because it changes Epic 3's scope by roughly a third:**

> **What is TerraNova, concretely?** A repository, a vendor product, or an internal name for the MapLibre + PMTiles + Meilisearch/SQLite-FTS layer already partly present in `Greenmamba29/Grahmos`? No public repository by that name was findable. Under assumption **A1** I have planned it as the latter; if it is a distinct third engine, Epic 3 gains an integration, a license entry, and a capability contract.

Proceeding on **A1** in the meantime — nothing in Epics 1, 2, 4, or 5 depends on the answer.

**Remaining open questions, by epic:**

| Epic | Question | Default if unanswered |
|---|---|---|
| 1 | Multi-arch OCI index from day one? | amd64-only (**A6**), documented as a known migration |
| 1 | SBOM format: CycloneDX or SPDX? | `[VERIFY: decide at spec sign-off]` |
| 1 | Is `minimumGrade` enforcing at install? | Enforcing, with a signed logged override |
| 2 | Multiple concurrent bundles per ORB? | One active bundle set, additive capabilities |
| 2 | Binary delta updates for large datasets? | Whole-dataset replacement with content-addressed dedup |
| 3 | Does the pilot need outdoor OSM data, or indoor only? | Both, sized for one campus |
| 4 | Who holds the facility-approval signing key — vendor or customer? | **Customer.** Vendor holds bundle-authorship keys only |
| 4 | Existing badge system to piggyback on? | None; issue GrahmOS credentials |
| 5 | Is the qualification report third-party auditable? | Assume yes; write the rubric to be publishable |
| 5 | Does the grade surface to end users? | Operators and auditors only |

---

## 13. What a competent engineering lead does first

1. Read [`specs/grahm-bundle-v1.md`](specs/grahm-bundle-v1.md) and [`specs/grahm-bundle-v1.schema.json`](specs/grahm-bundle-v1.schema.json). Name **one** owner for the schema, with veto.
2. Answer the TerraNova question (§12) and confirm **A2/A3/A4** (team, pilot site, hardware).
3. Freeze the capability vocabulary. Every identifier must have a named consumer in Epic 2 or 3, or it is cut.
4. Build the conformance corpus **before** the linter. Fixtures are the spec's test suite; a linter written first will encode its own bugs as behaviour.
5. In parallel, stand up the Epic 5 harness skeleton and prove severance is real (A5.2) against *anything* — even a hello-world service. That capability, once it exists, gates everything that follows.
6. Start the trademark clearance (§9) this week, before names are baked into media types.
