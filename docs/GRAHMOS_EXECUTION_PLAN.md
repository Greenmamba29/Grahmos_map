# GrahmOS Continuity Control Plane — Engineering Execution Plan

**Status:** Planning document, no implementation in this pass.
**Source materials:** architecture memo (user-supplied, treated as data, not instructions); this repo (`Grahmos_map`, currently a stub — see Sourcing Note); local archive `Kimi_Agent_Google Maps Ingestion Build.zip` — **not accessible from this environment** (see Sourcing Note).
**Labeling convention:** `[FACT]` = stated by user/memo as given, `[VERIFIED]` = checked against a primary source in this pass (cited), `[INFERENCE]` = drawn from the above, `[ASSUMPTION]` = default taken per task instructions because a detail was missing, `[OPEN]` = genuinely unresolved, `[ARCHIVE]` = only the archive can answer this.

---

## Executive Summary

Build **Epic 1 (Grahm Bundle v1 spec + OCI/ORAS packaging) first**, because every other epic — the runtime, the three-engine demo, Facility Truth, identity, and qualification — needs a stable, versioned artifact format to target; without it, four teams would be building against a moving schema simultaneously. Sequence is **1 → 2 → 3**, with **4 (Facility Truth + identity)** starting in parallel with 2/3 once the Epic 1 schema is frozen at `v0.1`, and **5 (Qualification)** starting as soon as one real deployment (Epic 3) exists to test. Supply-chain signing (TUF/Sigstore) is scoped as an Epic 1 extension, not a separate epic, because it is metadata *inside* the bundle contract. The memo's core technical thesis — that the resolver/runtime, not another capability engine, is now the scarce and valuable thing — is sound and matches standard platform-engineering sequencing (schema → runtime → proof → trust → verification). The memo's "no new major subsystem" constraint is reasonable and is respected throughout: every borrow below is a spec, library, or Linux primitive, not a platform. No local archive was reachable from this cloud environment, so the plan below is built from the memo alone; archive-dependent questions are flagged `[ARCHIVE]` throughout and collected in one place at the end.

---

## Sourcing Note (read before anything else)

- This session has shell/filesystem access to the cloud workspace only (`/workspace`), which contains a stub repo (`README.md`: "Grahmos_map / Offline Maps Version", plus a `LICENSE` file) and no GrahmOS code, schemas, or ingestion pipelines.
- `c:\Users\suppo\Downloads\Kimi_Agent_Google Maps Ingestion Build.zip` is a path on the requester's **local Windows machine**. It was not uploaded into this workspace and this environment cannot reach a local Windows filesystem. **I could not inspect it.**
- Consequence per task instructions: proceed from the memo alone; nothing in the currently-accessible repo satisfies, contradicts, or moots any memo gap (there is nothing there yet). All "does the archive already solve this" questions are listed as `[ARCHIVE]` items inline and summarized in **Open Questions**.
- If the archive is later made available (e.g., committed to this repo, or its contents pasted/described), re-run Epic 1–3 scoping against it before writing code — it may already define ingestion pipelines, schemas, or a TerraNova implementation that changes build-vs-borrow calls below.

---

## Epic 1 — Grahm Bundle v1 Specification + OCI/ORAS Packaging

**Objective:** Define a versioned, machine-validatable `.grahm` bundle format that fully describes a deployable capability set (what it needs, what it contains, how it's verified, how it's rolled back) and can be pushed/pulled/stored using existing OCI-compatible tooling rather than a bespoke registry.

### Deliverables
- `grahm-bundle-spec` v0.1 document: normative field list, versioning policy (SemVer for the spec itself), validation rules, and a reference JSON Schema (or CUE/Zod-equivalent — pick one, do not maintain two).
- OCI artifact-type mapping: what `artifactType` string(s) GrahmOS registers for bundle manifests, signatures, SBOMs, model files, map/tile packs, and dependency manifests, and how each is expressed as an OCI referrer of the bundle manifest `[VERIFIED — see Epic 1 evidence]`.
- Reference bundle: one worked example (`hospital.grahm`) hand-authored to spec, used as the fixture for Epic 2/3/5.
- CLI contract (not implementation): `grahm pack`, `grahm push`, `grahm pull`, `grahm verify` — inputs/outputs/exit codes only.
- Rollback/versioning policy: how a bundle declares its predecessor, and what "safe rollback" means (data migrations are the hard part — see Failure Modes).

### Interfaces / data contract (illustrative field list, not final schema)
```yaml
# hospital.grahm — top-level manifest (conceptual; wire format is an OCI artifact manifest + config blob)
apiVersion: grahm.io/bundle/v1
kind: GrahmBundle
metadata:
  id: hospital-main-campus
  version: 1.4.7            # SemVer
  supersedes: 1.4.6         # rollback target
  created_at: ...
  authority: <org identifier>
capabilities:
  - id: facility-database
    provider: sahana
    version: ...
  - id: routing
    provider: valhalla
    version: ...
  - id: maps-search
    provider: terranova
    version: ...
dependencies:
  - capability: routing
    requires: [maps-data]
hardware:                    # see ORB classes, lower-priority section
  ram_gb: 16
  storage_gb: 80
  accelerator: optional
  uptime_class: ORB-2
  networking: [wifi, ethernet]
data:
  - name: facility-model
    format: grahm-facility-truth-v1     # Epic 4
  - name: map-tiles
    format: terranova-tile-v1
services:
  - name: sahana-api
    health_check: /healthz
  - name: valhalla-api
    health_check: /status
integrity:
  digest: sha256:...
  signature_ref: <OCI referrer digest>   # Sigstore/TUF-style, see below
policies:
  rollback: allowed | forbidden | data-migration-required
  min_qualification_grade: B             # gates on Epic 5 output
```
- **OCI structure:** bundle manifest = subject; referrers (via the OCI Distribution Spec `GET /v2/<name>/referrers/<digest>` endpoint, part of OCI Distribution Spec v1.1) attach signature, SBOM, model, map-pack, and dependency-manifest artifacts, each with a distinct `artifactType`. `[VERIFIED]` This endpoint and its filtering/paging semantics are defined in the OCI Distribution Specification and implemented by ORAS tooling (oras-project/artifacts-spec, oras.land docs, OCI 2023-07-07 v1.1 change summary). Registries that don't yet support the referrers API fall back to the client-side "referrers tag schema" — the spec must account for both paths.

### Build vs. borrow vs. adapt
| Layer | Decision | Rationale |
|---|---|---|
| Bundle semantics (capabilities, hardware, policy, rollback) | **OWN** | No existing standard covers this; this is the memo's stated moat and the task's out-of-scope-to-outsource item. |
| Storage/transport (push/pull, content addressing, referrer graph) | **BORROW** (OCI Distribution Spec + ORAS) | Reinventing artifact transport would burn effort on a solved problem and forfeit interoperability with existing registries/CI. `[VERIFIED]` |
| Schema validation tooling | **ADAPT** (JSON Schema or CUE, existing libraries) | Off-the-shelf validators are mature; only the schema content is proprietary. |

### Dependencies and ordering
- No upstream dependency. **This is the root of the dependency graph.**
- Freezing this at `v0.1` (not final — versioned, extensible) unblocks Epics 2, 3, 4 (Facility Truth needs a `data` block format to live in), and 5 (qualification needs `policies.min_qualification_grade` and `integrity` to test against).

### Acceptance tests
- A hand-authored `hospital.grahm` validates against the schema and round-trips through `grahm pack` → OCI registry push → pull → `grahm verify` with byte-identical content.
- A bundle missing a required field (e.g., `hardware.ram_gb`) fails validation with a specific, actionable error, not a stack trace.
- A referrer graph query against the pushed bundle returns signature + SBOM + map-pack artifacts with correct `artifactType` filtering. `[VERIFIED capability of the underlying spec]`
- A bundle claiming `supersedes: 1.4.6` when no `1.4.6` is known locally is flagged, not silently accepted.

### Failure modes
- **Schema churn**: if the schema changes incompatibly after Epic 2/3 start consuming it, both stall. Mitigate with an explicit `apiVersion` and a "frozen for v0.1 consumers" checkpoint before Epic 2 kicks off.
- **Rollback ≠ safe** when a capability has migrated persistent data (e.g., Sahana DB schema moved forward). The spec can declare `rollback: data-migration-required`, but the *runtime* (Epic 2) — not this spec — must refuse an unsafe rollback rather than silently corrupting data. This is a cross-epic seam that needs an explicit contract, not an assumption.
- **Referrers API unsupported by a given registry** in fully offline/air-gapped distribution (no live registry at all, just files copied via USB/satellite). The spec must also define a **flat-file/offline transport encoding** (e.g., an OCI Layout directory tree written to a drive) as a first-class alternative to registry push/pull, since ORB deployments will often never touch a network registry at install time.

### Open questions
- Is there an existing internal `.grahm` draft schema already (from prior work referenced by the memo as "still needs a formal schema" implies earlier informal iterations)? `[ARCHIVE]`
- Does the archive contain any ingestion manifest format for TerraNova map/tile packaging that should become the `data` block format referenced above? `[ARCHIVE]`
- JSON Schema vs. CUE vs. a Rust/Go-native typed schema (with generated validators) is genuinely underdetermined without knowing the runtime's implementation language — `[OPEN]`, default assumption below.
- `[ASSUMPTION]` Runtime implementation language is not yet fixed; this plan assumes a single primary language (Go or Rust are typical for CLI+OCI tooling ecosystems) will be chosen at Epic 2 kickoff and schema tooling will follow that choice. This does not block Epic 1 authoring, which can start in a language-neutral schema format.

---

## Epic 2 — Grahm Runtime + `grahm install`

**Objective:** Build the pipeline that takes a verified `.grahm` bundle and turns it into a running, health-checked, offline-qualified deployment on real hardware — the verifier → capability resolver → deployment plan → health checks → offline qualification chain from the memo's diagram.

### Deliverables
- **Bundle Verifier**: checks integrity digest, signature (see Epic 1 supply-chain extension), schema conformance, and hardware compatibility (declared `hardware:` block vs. detected host) before anything is unpacked.
- **Capability Resolver**: given the bundle's `capabilities`/`dependencies` graph plus current host inventory (hardware, already-installed capabilities, local data), produces an ordered, idempotent deployment plan. This is the component the memo calls the most valuable proprietary asset.
- **Deployment Plan executor**: applies the plan (start/stop/reconfigure services, mount data volumes) and is resumable/idempotent if interrupted mid-install (power loss during install is an explicit qualification scenario in Epic 5).
- **Health check subsystem**: polls each capability's declared health endpoint on a defined cadence and schedule, with a documented state machine (`starting → healthy → degraded → failed`).
- **Offline qualification hook**: a runtime-level interface that Epic 5's test harness calls into (not a reimplementation of Epic 5 — the runtime exposes hooks; Epic 5 owns the scenarios and scoring).
- `grahm install <bundle>` CLI: end-to-end command wrapping the above, with structured, machine-parseable output (for Epic 5 to consume) and human-readable output (for operators).

### Interfaces / data contract
```yaml
# Deployment Plan (resolver output; consumed by executor)
plan:
  bundle_id: hospital-main-campus@1.4.7
  steps:
    - capability: facility-database
      action: install | upgrade | reconfigure | noop
      depends_on: []
      rollback_step: <id>
    - capability: routing
      action: install
      depends_on: [facility-database]      # example ordering constraint
  hardware_check: PASS | FAIL
  existing_state_diff: <summary of what's already present locally>
```
```yaml
# Health check contract each capability must implement
health_contract:
  endpoint: /healthz            # or declared alternative
  expected_status: 200
  body_schema: { status: healthy|degraded|failed, detail: string, checked_at: timestamp }
  poll_interval_s: 30
  failure_threshold: 3          # consecutive failures before state transition
```

### Build vs. borrow vs. adapt
| Layer | Decision | Rationale |
|---|---|---|
| Resolver / capability graph solving | **OWN** | This is the memo's named moat; also, no existing OSS resolver understands "capability" as GrahmOS defines it (bundle-declared, hardware-aware, offline-first). |
| Deployment/process supervision mechanics | **ADAPT** patterns, not platforms | Borrow *ideas* from declarative reconciliation (desired vs. actual state, as popularized by Kubernetes controllers) and from local package/service managers (systemd unit ordering, Nix-style declarative installs) — but do **not** adopt Kubernetes, Nomad, or a full orchestrator as a subsystem. Consistent with the memo's "no new major subsystem" constraint: a single-node dependency-ordered executor is a small, ownable component; a cluster orchestrator is a large one. |
| Health checking | **ADAPT** simple HTTP/process polling; no service mesh | Same rationale — a poll loop is not a subsystem. |
| Underlying process isolation (if containers are used to package Sahana/Valhalla/TerraNova) | **[OPEN — genuinely underdetermined]** | Two credible paths: (a) each capability ships as an OCI container image and the runtime shells out to an existing container runtime (`containerd`/`runc`/`podman`) purely as a process-isolation primitive — cheap, mature, but is arguably a "subsystem" the memo wants to avoid; (b) capabilities ship as native processes/binaries with the runtime doing direct process supervision, avoiding any container dependency but pushing more OS-compatibility work onto the runtime. Present both; do not force a choice without knowing target hardware constraints (ORB classes) and whether Sahana/Valhalla are already containerized upstream. |

### Dependencies and ordering
- Requires Epic 1 schema frozen at `v0.1` (resolver needs a stable `capabilities`/`dependencies`/`hardware` shape to parse).
- Unblocks Epic 3 (nothing to install bundles onto without this) and Epic 5 (nothing to qualify without a running install).
- Can start schema-conformant mock development (resolver logic against synthetic bundles) in parallel with the tail of Epic 1, once the field list — not full validation tooling — is stable.

### Acceptance tests
- `grahm install hospital.grahm` on a clean ORB-class host results in all declared capabilities reporting `healthy` within a defined SLA (e.g., `[VERIFY: target install time — not specified in memo]`).
- Re-running `grahm install` on an already-installed host is a no-op (idempotency) and does not restart healthy services unnecessarily.
- Killing the process mid-install and re-running completes correctly (resumability) — this is a direct precursor to the Epic 5 "power restart" scenario.
- Installing a bundle whose `hardware:` block exceeds detected host resources fails fast with a specific, actionable message, before any capability is touched.
- A capability that fails health checks after install triggers a defined remediation path (retry, rollback per bundle policy, or explicit `degraded` state surfaced to the operator) — not a silent partial install.

### Failure modes
- **Partial install left in an ambiguous state** if the executor isn't crash-safe — must be idempotent and resumable by construction, not by later patching.
- **Resolver produces a plan that satisfies the schema but is operationally wrong** (e.g., correct dependency order but wrong for this specific hardware profile) — needs a "dry-run/explain" mode so operators (and Epic 5) can inspect a plan before it executes.
- **Silent version skew** between what the resolver assumes a capability's health contract looks like and what the shipped adapter (Epic 3) actually implements — mitigated by making the health contract part of the Epic 1 schema, not an Epic 2/3-only convention.

### Open questions
- Target install-time SLA and target hardware baseline (ORB-1 vs ORB-2) are unspecified in the memo — `[OPEN]`, needed before resolver performance can be tested against a real bar.
- Does the archive already contain a working ingestion/deployment script for the Google Maps-equivalent pipeline that implies a specific process/container model already in use? `[ARCHIVE]`
- Container vs. native-process packaging (above) — `[OPEN]`, present as an explicit decision to make at Epic 2 kickoff, not before.

---

## Epic 3 — One Bundle Running Sahana + Valhalla + TerraNova Together

**Objective:** Prove Epics 1 and 2 against the real, already-selected capability engines on a single deployment — the first end-to-end demonstration that "bundle in, resilient system out" actually works, not just against synthetic fixtures.

### Deliverables
- Reference `hospital.grahm` (promoted from Epic 1's fixture to a real, populated bundle): real Sahana instance + config, real Valhalla routing graph for a bounded test area, real TerraNova map/search index for the same area.
- A **capability adapter** per engine: a thin shim conforming each engine to the Epic 2 health-contract and Epic 1 data/service schema, without modifying the upstream engines themselves (preserves upstream-compatibility goals in the lower-priority "upstream automation" item).
- Single-node deployment topology document: what runs where, port map, data volume layout, resource footprint measured (not estimated) on one representative host.
- A cross-capability smoke test: one action that exercises all three engines together (e.g., search finds a location via TerraNova → Valhalla routes to it → Sahana logs an incident referencing that location/route).

### Interfaces / data contract
- Per-engine adapter contract (concrete instantiation of Epic 2's `health_contract`, plus a minimal capability-specific config surface):
```yaml
capability: routing
provider: valhalla
service:
  process_or_container: <TBD per Epic 2 decision>
  config_injection: <how bundle-declared config reaches valhalla.json equivalent>
  health_check: GET /status -> {"version": ..., "tileset_last_modified": ...}
data_mount:
  path: /data/valhalla-tiles
  source: bundle "map-tiles" data block (Epic 1)
```
- Cross-capability query contract: a minimal internal API/event by which TerraNova search results (location) are passed to Valhalla (routing input) and Sahana (incident context) — this is the first piece of genuinely new integration glue and should be specified once, reused by Epic 5's smoke tests and later by Answer Receipts.

### Build vs. borrow vs. adapt
| Component | Decision | Rationale |
|---|---|---|
| Sahana, Valhalla | **BORROW as-is** (MIT-licensed — `[VERIFIED]`: Valhalla's `COPYING` and Sahana Eden's stated licensing are both MIT) | Already-selected engines; no reason to fork core logic. |
| TerraNova | **[ASSUMPTION]** already an in-house/proprietary maps+search stack, built or being built by this team (the memo lists it as an already-selected engine alongside Sahana/Valhalla, not as an OSS import) | `[ARCHIVE]` The referenced archive's filename ("Google Maps Ingestion Build") strongly suggests it is exactly the TerraNova ingestion pipeline — this is the single highest-value thing the archive could confirm or contradict. If the archive shows TerraNova is further along (or less far along) than assumed, Epic 3's scope and timeline change materially. |
| Per-engine adapters | **OWN** | Thin, bundle-specific glue; not something to borrow. |
| Cross-capability query glue | **OWN** | This is genuinely new integration surface, small enough not to be a "subsystem." |

### Dependencies and ordering
- Requires Epic 1 (schema) and Epic 2 (runtime) to be functional, at least to an alpha level — Epic 3 is the first real consumer/stress-test of both, and will likely surface schema and resolver defects that feed back into Epics 1/2 (expect at least one iteration loop, not a clean one-way handoff).
- Unblocks Epic 5 in a meaningful way: qualification against synthetic bundles is a weak proof; qualification against this real, three-engine bundle is the memo's actual target claim.

### Acceptance tests
- `grahm install hospital.grahm` succeeds on the target reference hardware with all three engines `healthy`.
- The cross-capability smoke test (search → route → incident log) succeeds with no network access after install.
- Resource footprint (RAM, storage, boot time) is measured and matches (or updates) the `hardware:` block declared in Epic 1's bundle — closing the loop between declared and actual requirements.
- Upgrading the bundle in place (new Valhalla tileset, same Sahana/TerraNova) succeeds without disturbing the other two capabilities (proves resolver's incremental-plan logic, not just fresh-install logic).

### Failure modes
- **TerraNova scope/maturity mismatch** (see Assumption above) — if TerraNova is less mature than Sahana/Valhalla, this epic's timeline is TerraNova-bound, not resolver-bound; that changes staffing priority.
- **Adapter drift from upstream**: if Sahana/Valhalla upstream releases change health-endpoint or config behavior, adapters silently break — mitigated by pinning versions in the bundle and by the lower-priority "upstream compatibility automation" item (CI against upstream release candidates).
- **Resource footprint underestimated for ORB-1**-class hardware, forcing a hardware-class bump discovered late — measure early, don't estimate.

### Open questions
- What exactly is TerraNova today — a working service, a design doc, or partially the contents of the referenced archive? `[ARCHIVE]` — materially affects this epic's estimate more than anything else in the plan.
- What is the target test area/data scope (one hospital floor? one campus? a whole city extract for Valhalla)? `[OPEN]`, `[ASSUMPTION]`: default to the smallest area that makes the "smallest credible demo" (see below) truthful — a single building/campus, not a city.

---

## Epic 4 — Grahm Facility Truth + Offline Identity/Authority

**Objective:** Make "the map says Exit A is open" a *trust-scored claim with provenance and an expiry*, not an assertion; and make "anyone on the LAN" definitively **not** equal to "authorized" even when the identity provider is unreachable.

### 4a. Facility Truth

**Deliverables:**
- Lifecycle state machine: `DRAFT → FIELD_VERIFIED → APPROVED → ACTIVE → SUPERSEDED`, plus an explicit `EXPIRED`/`STALE` terminal-ish state distinct from `SUPERSEDED` (superseded = replaced by a newer verified fact; expired/stale = no newer fact exists, but confidence has decayed past a threshold). The memo's lifecycle list omits an explicit staleness state, and this is exactly the gap that causes the "resilient wrong answer" failure mode — **recommend adding it**, flagged here as a plan addition beyond the memo's literal list.
- Provenance record format per operational object (per the memo's sketch, extended with explicit confidence/expiry semantics):
```yaml
exit_A:
  status: open
  lifecycle_state: APPROVED
  confidence: verified | field_reported | inferred | unknown
  verified_at: 2026-06-01T00:00:00Z
  verified_by: <credential subject id, see 4b>
  survey_date: 2026-05-28
  source: ifc_import + field_verification
  expires_at: 2026-12-01T00:00:00Z        # policy-driven, not hardcoded
  revision: 67
  approved_by: <credential subject id>
  approved_at: ...
  supersedes_revision: 66
```
- Approval-chain validation: an object cannot reach `APPROVED`/`ACTIVE` without a verifiable chain (approver credential valid at time of approval — ties directly into 4b).
- Confidence-decay policy: a defined function (even a simple one, e.g., linear decay past `expires_at` with configurable thresholds) that downgrades `confidence` automatically as data ages, surfaced to the Answer Receipts feature (lower-priority section) rather than hidden.

**Build vs. borrow vs. adapt:** **OWN**, entirely. `[INFERENCE]` No existing standard (IFC, OSM, IndoorGML) models *trust/approval/staleness of a fact*, only geometry/topology — this is orthogonal to and layered on top of any geometric interchange format (see IndoorGML section below), so building it is not duplicative of a standard.

### 4b. Offline identity & authority

**Deliverables:**
- Offline-verifiable credential format carrying, per the memo: device identity, user identity, role, scope, expiry, issuer, revocation epoch, break-glass authority.
- A **revocation epoch** distribution mechanism: a monotonically increasing counter (per-facility or global) that is bundled into every `.grahm` update and periodically pushed via any available sync channel; a credential is checked against the *locally cached* epoch at verification time — this is what makes "revoked while disconnected" resolvable without a live call to an identity provider, at the cost of a bounded window where a just-revoked credential can still work until the next epoch sync reaches that node. This bound must be stated explicitly to operators (it is a real, quantifiable residual risk, not a solved problem).
- Break-glass authority: a distinct credential class or claim that grants emergency elevated access, always logged to a tamper-evident local audit trail (append-only, hash-chained) that syncs upstream when connectivity returns, and always visible/flagged in the UI when active (never a silent elevation).
- Device identity: a per-ORB-node identity distinct from user identity, used to gate which bundles a given node is even allowed to install (ties back to Epic 1 `authority` field and Epic 2 verifier).

**Interfaces / data contract (illustrative):**
```yaml
credential:
  subject_type: user | device | service
  subject_id: ...
  role: [clinician, facilities_director, incident_commander, ...]
  scope: [facility:main-campus, capability:facility-database:write]
  issued_at: ...
  expires_at: ...
  issuer: <issuing authority id>
  revocation_epoch_at_issuance: 42
  break_glass: false
  signature: ...
```

**Build vs. borrow vs. adapt:**
| Layer | Decision | Rationale |
|---|---|---|
| Credential semantics (fields above, break-glass, revocation epoch) | **OWN** | No off-the-shelf format has "break-glass authority" or "revocation epoch for offline checking" as first-class fields; this is a genuine design project, as the memo says. |
| Cryptographic primitives (signing, verification, key formats) | **BORROW** existing crypto libraries/standards; do not invent cryptography | Standard practice; inventing signature schemes is a well-known anti-pattern. |
| Service/workload identity specifically (not user identity) | **ADAPT** — consider SPIFFE/SPIRE-style short-lived X.509 identity for service-to-service auth between capabilities on one node/cluster of ORB nodes | `[OPEN — genuinely underdetermined]`: SPIFFE/SPIRE is mature and designed for zero-trust, offline-tolerant workload identity, but is itself a small subsystem to run; alternative is a much simpler self-issued per-node cert bundled at install time. Present both; the choice depends on whether GrahmOS ever needs multi-node ORB clusters (ORB-3+) with dynamic service identity, which is not yet specified. |
| User/device credential encoding | **[OPEN]**: candidates are (a) compact custom signed token (JWT/CWT-shaped) carrying exactly the fields above, (b) W3C Verifiable Credentials data model with an offline-resolvable key method. | (a) is simpler and fully bespoke-controllable; (b) buys ecosystem tooling and future interoperability at the cost of adopting a heavier, less offline-native spec. Memo's own instruction (no new major subsystem) leans toward (a); noted as a trade-off, not forced. |

### Dependencies and ordering
- Facility Truth's data shape needs Epic 1's `data:` block format to exist, but is otherwise independent logic — can be designed in parallel with Epic 2, implemented alongside or just after Epic 3.
- Identity/credentials are needed by Epic 5 qualification (the "unauthorized pack REJECT" scenario needs a real authority concept to reject against) and should be at least alpha-functional before Epic 5 starts, not necessarily before Epic 3.

### Acceptance tests
- An `exit_A` record's `confidence` automatically transitions from `verified` to `field_reported`-equivalent decay state after its `expires_at` passes, with no code change required (policy-driven, not hardcoded per-object).
- An approval attempt by a credential whose role lacks the required scope is rejected, and the rejection is logged with reason.
- A credential revoked centrally, then the node is disconnected before the revocation epoch syncs, then reconnected: the credential is rejected **immediately upon the next epoch sync**, without requiring app restart or manual intervention.
- Break-glass activation is visible in the active UI session and produces an audit record within the same qualification run.
- Facility Truth objects cannot reach `APPROVED` without a validly-signed approver credential dated before the claimed `approved_at`.

### Failure modes
- **Clock drift on disconnected nodes** undermines both expiry and revocation-epoch logic — needs a defined tolerance and a documented behavior when local clock is untrusted (e.g., degrade confidence rather than trusting an unverifiable expiry check).
- **Revocation propagation lag** is a real, bounded residual risk (see above) — must be surfaced as a documented SLA ("credentials revoked centrally are guaranteed rejected within N sync cycles"), not implied to be instant.
- **Break-glass abuse** without adequate after-the-fact review process (a technical audit log with no organizational review process is theater) — this is partly a non-technical workstream item (see below).
- **Facility Truth becoming a bottleneck**: if every operational fact requires a human approval chain, field teams will bypass it under pressure, recreating the exact "stale but resilient" danger the system exists to prevent. The `FIELD_VERIFIED` intermediate state exists precisely to give a faster, honestly-lower-confidence path — the acceptance criteria above must test that this faster path is actually usable under time pressure, not just theoretically available.

### Open questions
- Is there an existing organizational identity provider (LDAP/AD, OIDC provider) that offline credentials must federate with when connected, or is GrahmOS the sole identity source? `[OPEN]`, materially affects issuer/key-management design.
- Does the archive define any existing facility data schema (from the maps ingestion work) that Facility Truth must wrap rather than replace? `[ARCHIVE]`

---

## Epic 5 — Grahm Qualification

**Objective:** Produce automated, auditable proof — not a claim — that a given bundle deployment survives the specific failure modes the memo lists, by actually inducing those failures, and to output a standardized, non-technical-audience-readable grade.

### Deliverables
- Fault-injection harness covering, at minimum, the memo's list: WAN off, cloud off, DNS broken, edge node unavailable, power restart, stale update (reject), corrupt pack (reject), unauthorized pack (reject), local routing, local search, incident persistence.
- Scoring rubric: how individual scenario PASS/FAIL results roll up into a letter grade (`Continuity Grade: A/B/C/D/F`) — this rubric must be defined and versioned, since it becomes a customer/procurement/auditor-facing artifact per the memo.
- Signed qualification report artifact: a bundle-digest-referenced, signed report (reusing Epic 1's signing infrastructure) so a report can't be forged or replayed against a different bundle version.
- CI integration: qualification runs automatically on every bundle build/release, not only on-demand.
- Per-deployment (not just per-bundle-type) qualification: the same bundle can qualify differently on different hardware (ORB-1 vs ORB-2), so reports must be scoped to a specific deployment instance, not just a bundle version.

### Interfaces / data contract
```yaml
qualification_report:
  bundle: hospital.grahm@1.4.7
  bundle_digest: sha256:...
  deployment_id: <specific ORB node/instance>
  run_at: ...
  scenarios:
    - name: wan_independence
      result: PASS
      detail: "3 canned queries succeeded with WAN interface disabled for 300s"
    - name: bundle_integrity_corrupt_pack
      result: PASS      # PASS here means "correctly rejected"
      detail: "corrupted pack rejected at verifier stage, no partial install occurred"
    - name: power_restart
      result: PASS
      detail: "install resumed correctly after SIGKILL at step 3/7"
  continuity_grade: A
  signature: ...
```

### Build vs. borrow vs. adapt
| Layer | Decision | Rationale |
|---|---|---|
| Scenario catalog, scoring rubric, report format | **OWN** | This is explicitly called out in the memo as potentially commercial by itself; no existing framework grades *offline continuity* this way. |
| Fault injection mechanics (network cut, DNS poison, process kill, corrupt-file injection) | **ADAPT** standard Linux primitives (`tc`/`netem`, `iptables`/`nft`, process signals, filesystem corruption in a controlled test harness) | These are OS-level tools, not subsystems; using chaos-engineering *concepts* (as in tools like Chaos Mesh/Toxiproxy) without adopting a chaos-engineering *platform* keeps this consistent with "no new major subsystem." |
| Power-loss simulation specifically | **[OPEN]** | Two credible fidelities: (a) software-simulated (kill the process/VM mid-operation) — cheap, always available, but doesn't test real hardware power-loss behavior (disk write-caching, filesystem journal recovery); (b) actual hardware power-cut rigs on real ORB units — higher fidelity, requires physical test infrastructure and is not CI-automatable in the same way. Recommend (a) for CI/every-build qualification and (b) as a periodic hardware-class certification exercise, not conflating the two under one "Continuity Grade." |

### Dependencies and ordering
- Needs Epic 3 (a real deployment) to be a meaningful proof; can be scaffolded against Epic 2's synthetic fixtures earlier for the mechanics (network cut, restart) but the "local routing/search/incident persistence" scenarios need real Sahana/Valhalla/TerraNova behavior.
- Needs at least an alpha of Epic 4's identity/authority to test "unauthorized pack REJECT" meaningfully (otherwise that scenario has nothing real to reject against).
- Feeds back into Epic 1 (policies.min_qualification_grade gating) and becomes a standing CI gate for all future bundle releases.

### Acceptance tests (meta-level — testing the tester)
- A deliberately corrupted bundle is correctly rejected (not just "happens to fail") — verify the harness distinguishes "rejected for the right reason" from "crashed for an unrelated reason."
- A deliberately stale bundle (violates a freshness policy) is rejected even if its integrity/signature are otherwise valid — proves the harness checks policy, not just cryptographic validity.
- Re-running the full qualification suite twice against the same unchanged deployment produces the same grade (determinism) — flaky qualification undermines the entire commercial claim.
- The signed report is verifiable offline (ties to Epic 1's Sigstore/TUF extension) and rejected if the bundle digest in the report doesn't match the actual installed bundle.

### Failure modes
- **False PASS**: the highest-severity failure mode for this epic specifically — a scenario that claims to sever WAN but doesn't actually do so (e.g., only blocks one of two network interfaces) produces a dangerously false "Continuity Grade: A." Every scenario needs its own meta-test proving the fault was actually injected (e.g., assert the WAN interface really went down, not just that the test "believes" it did).
- **Hardware-dependent flakiness** in power-cycle tests undermines CI reliability — mitigated by the tiered fidelity approach above.
- **Grade inflation pressure**: because the grade is commercial/customer-facing, there will be organizational incentive to loosen the rubric over time. Versioning the rubric (as required above) and treating rubric changes as a reviewed, published event (like a spec change) mitigates this; it is a governance risk, not just a technical one.

### Open questions
- What does "DNS broken" mean operationally for a system designed to be offline-first in the first place — is this testing graceful degradation for the (presumably rare) case of partial connectivity with broken DNS resolution specifically, as opposed to full WAN loss? `[OPEN]` — worth clarifying the intent before writing this scenario, since it's the one scenario in the memo's list that doesn't map cleanly to "no network at all."
- Target grade thresholds (what specifically separates A from B from C) are not specified in the memo — `[OPEN]`, needs a decision before the rubric can be finalized; not a blocker to building the harness itself.

---

## Lower-Priority Items (scoped, lower detail)

| Item | Objective (one line) | Build/borrow/adapt | Key dependency | Notable verification result |
|---|---|---|---|---|
| **Grahm Positioning Interface** (indoor positioning) | Multi-technology "YOU ARE HERE" with mandatory manual fallback and a confidence score, not a single-technology bet. | **ADAPT**: wrap existing positioning primitives (Wi-Fi RTT, UWB, BLE, QR/NFC, inertial) behind one internal interface returning `{position, confidence, technology_used}`; manual selection is always available and always OWN (it's core UX, not a technology integration). | Facility Truth (needs a coordinate system/floor model to position against) and IndoorGML/facility model (below). | `[VERIFIED]` Android's own Wi-Fi RTT documentation states multilateration with 3+ APs is "typically accurate within 1-2 meters" — but this is a best-case, LOS-friendly figure; independent studies (e.g., PMC10007519) report ~1.1–1.5 m RMSE achievable only after device-specific bias correction, and Android's AOSP KPI table shows 802.11mc accuracy degrading to 4–8 m at lower bandwidths. **Treat the memo's "~1–2 m" as an optimistic upper bound of achievable accuracy, not a guaranteed floor**, and design the confidence output accordingly — this is exactly why the interface must report confidence and support fallback, not just position. |
| **CAP as canonical alert I/O** | Ingest and emit Common Alerting Protocol messages rather than inventing an incompatible internal alert format. | **BORROW** the protocol itself (do not reinvent alert semantics); **OWN** the `CAP Alert -> Grahm Alert Contract -> SafetyMap` adapter and its reverse. | Facility Truth (alerts need to attach to a geofence/facility object) | `[VERIFIED]` OASIS CAP v1.2 is a real, network-independent, all-hazard alert standard with geographic targeting (lat/lon polygons/circles, 3D), multilingual support, and update/cancellation semantics, adopted by FEMA/IPAWS in the US. Memo's characterization is accurate. |
| **IndoorGML as interchange target** | Standards-based import/export for indoor topology so GrahmOS isn't locked to its own importer. | **BORROW/ADAPT**: IndoorGML as one of several import targets (`IFC / DXF / OSM / IndoorGML -> Grahm Facility Model`); keep the internal Emergency Graph proprietary as the memo suggests. | Facility Truth (Grahm Facility Model is downstream of Facility Truth's trust layer, upstream of the geometry itself — these are complementary, not competing, layers) | `[VERIFIED, with a date discrepancy to flag]` OGC's IndoorGML 2.0 Part 1 – Conceptual Model document header states Publication Date **2025-06-26**; OGC's own announcement page is dated **August 28, 2025** and titled "OGC Publishes IndoorGML 2.0 Part 1 Conceptual Model Standard." The memo's "published August 2025" matches the announcement date, not the document's internal metadata date — both are from OGC's own site; the discrepancy is OGC's, not an error to attribute to the memo. Also confirmed: Part 1 is the **conceptual/UML model only**; a still-forthcoming Part 2 defines the actual GML/SQL/JSON implementation schemas — meaning any IndoorGML *implementation* work today is against an unfinished multi-part standard, which is a real integration-timing risk worth flagging, not a reason to avoid Part 1 for conceptual alignment now. |
| **Secure bundle/update supply chain** | Make "signed/verified/trusted" true before claiming it publicly. | **BORROW + integrate**: TUF-style role separation (Root/Targets/Snapshot/Timestamp, offline keys for Root/Targets, online keys for Snapshot/Timestamp) for update metadata; Sigstore/Cosign for artifact signing with **offline-verifiable bundles**. | This is technically an **extension of Epic 1's `integrity`/`policies` block and Epic 5's "unauthorized/stale pack REJECT" tests**, not an independent epic — recommend folding its schedule into Epic 1 (design) and Epic 5 (proof), not tracking it as a sixth workstream. | `[VERIFIED]` TUF's four-role separation and its stated purpose (defending against rollback and key-compromise attacks) is accurately characterized by the memo (theupdateframework.io, TUF specification v1.0.33). Sigstore/Cosign's newer bundle format is explicitly designed for offline verification: `cosign verify-blob --bundle ... --key ...` with a local public key requires no live call to Rekor/the transparency log or TUF root data when using key-based (non-keyless) signing with `tlog-upload=false`; a 2026-01-06 Cosign change (`sigstore/cosign` PR #4613, confirmed merged) specifically removed a residual requirement to fetch a trusted-root file in this offline path, which had been a real gap until recently — **note this recency**: offline-verification ergonomics in the Cosign tool itself are still actively changing, so pin a specific Cosign version and re-verify this behavior before depending on it. |
| **Offline answer provenance** ("Answer Receipts") | Every answer states what it knows, source, freshness, and confidence — and explicitly says "I cannot verify this offline" rather than guessing. | **OWN** entirely | Directly consumes Facility Truth's `confidence`/`verified_at` fields (Epic 4) — this is essentially a UX-layer rendering of Epic 4's data model, not a separate data model. | Not a third-party claim; no verification needed. Design note: this should be specified as a rendering contract over Facility Truth objects, not a new source of truth. |
| **ORB hardware classes (ORB-0…ORB-X)** | Let bundles declare hardware/resilience requirements in a way `grahm install` can check. | **OWN** classification; **commodity hardware** underneath | Directly consumed by Epic 1's `hardware:` block and Epic 2's verifier's hardware-check step — already partially specified structurally above. | Memo's class descriptions (single device → mini-PC → redundant storage/UPS → multi-node mesh → rugged/remote) are a reasonable, standard resilience-tiering pattern; no external standard needed or claimed. |
| **Global Capability Registry** | The "index" of what software/model/device satisfies which capability, across deployments. | **OWN** | Depends on Epics 1–3 having enough real deployments and capability definitions to index meaningfully — this is a P2 for a reason; building an index before there's more than one bundle type to index is premature. | — |
| **Upstream compatibility automation** | Keep Sahana/Valhalla/TerraNova upgrades from silently breaking Grahm deployments. | **OWN** the automation (CI against upstream release candidates, adapter contract tests); **BORROW** upstream projects' own release/CI signals as inputs. | Depends on Epic 3's adapters existing as a concrete thing to test against upstream changes. | — |

---

## Dependency Graph

```
                 [Epic 1: Bundle Spec + OCI/ORAS]
                    |                        |
                    v                        v
        [Epic 2: Runtime/Resolver]   [Epic 4: Facility Truth
                    |                  + Offline Identity]  (parallel track,
                    v                        |               starts once Epic 1
        [Epic 3: 3-engine bundle] <----------+               data-block shape is frozen)
                    |
                    v
        [Epic 5: Qualification]  <---- needs Epic 4 alpha for
                    |                   "unauthorized pack REJECT"
                    v
   +----------------+-----------------+
   v                v                 v
[Positioning]  [CAP + IndoorGML]  [Answer Receipts]
   |                                  ^
   +---------------- feeds ----------+
                    v
        [Global Capability Registry, Upstream Automation]  (P2 — after
                                                              multiple real
                                                              deployments exist)

Supply-chain signing (TUF/Sigstore) is not a separate node: it is
Epic 1's integrity/policy design + Epic 5's rejection-scenario proof.
```

---

## Smallest Credible Demo

The point at which "GrahmOS keeps the world working offline" stops being aspirational:

1. One ORB-1-class node (single mini-PC, local SSD, Wi-Fi/Ethernet — no redundancy required for *this* milestone).
2. One real bundle, `clinic-min.grahm`, containing: a minimal Sahana instance (one facility, seeded incident-tracking config), a Valhalla routing graph clipped to the single building/campus footprint, and a TerraNova search index over the same footprint (a handful of named rooms/exits/hazards is enough — this is deliberately smaller than the "hospital.grahm" reference used in Epic 3's full proof).
3. `grahm install clinic-min.grahm` completes fully with the node's network interface **physically disconnected or hard-disabled before install starts** — proving install-time offline capability, not just run-time.
4. Three canned operations succeed with no network path available at any point: (a) search for a named location, (b) get a route to it, (c) log an incident referencing that location.
5. `grahm qualify` (Epic 5, minimal scenario subset: WAN independence, local routing, local search, incident persistence — not the full 11-scenario suite) produces a signed report with a grade.
6. The entire sequence — including the physical network disconnection — is filmed or logged with timestamps, because the credibility of this demo rests on the disconnection being real and verifiable, not narrated.

This requires Epics 1, 2, 3, and a minimal slice of 5 (not 4 in full — identity/authority can be stubbed for this specific demo, since the smallest credible demo is about *continuity*, not yet about *trust*, though the plan should say so explicitly rather than let that gap go unstated). Everything else in this plan is what turns this demo into a product.

---

## Non-Technical Workstreams (run in parallel, starting now)

| Workstream | Why it can't wait | First concrete artifact | Notable input from this plan |
|---|---|---|---|
| Trademark strategy | The memo's proprietary-terms list (Grahm Bundle, Grahm Runtime, Grahm Capability Graph, Grahm Resolver, Grahm Qualification, Grahm Facility Truth, Grahm Continuity, ORB) needs clearance before it's used in customer-facing qualification reports (Epic 5) or marketing. | Trademark clearance search on the term list above. | Epic 5's "Continuity Grade" report is the first customer/auditor-facing artifact carrying these names — sequence trademark clearance before that report ships externally. |
| Patent / prior-art analysis | The resolver (Epic 2) and Facility Truth (Epic 4) are the two components explicitly claimed as the technical moat; if either overlaps existing IP, that changes build strategy, not just legal posture. | Prior-art search scoped specifically to (a) capability-graph/dependency resolvers for offline software deployment, (b) trust-lifecycle models for facility/geospatial data. | — |
| License inventory (incl. copyleft exposure) | Determines what GrahmOS can ship, and under what terms, before Epic 3 bundles real engine code. | Inventory of every dependency's license, starting with the two confirmed above: `[VERIFIED]` Sahana Eden and Valhalla are both MIT-licensed (permissive, no copyleft exposure from the engines themselves). Note: OpenStreetMap-derived map data used by Valhalla/TerraNova is separately licensed under **ODbL**, a share-alike license for *data*, distinct from code copyleft — this is a real obligation (attribution + share-alike on derived data) that a pure code-license audit would miss. | TerraNova's own licensing/provenance is `[ARCHIVE]` — cannot be assessed without the archive. |
| Security threat model | Offline identity (Epic 4) and supply-chain signing (Epic 1 extension) are security-critical; a threat model should shape their design, not just review it after the fact. | STRIDE-or-equivalent threat model scoped to: bundle supply chain, offline identity/revocation, break-glass abuse, LAN-trust assumptions. | Directly informs Epic 4's revocation-epoch bound and break-glass audit design above — this workstream should start concurrently with Epic 4 design, not after. |
| Upstream contribution policy | Determines whether Sahana/Valhalla adapter work (Epic 3) stays as private forks/shims or gets contributed upstream — affects long-term maintenance cost either way. | A one-page policy: what gets contributed upstream (bug fixes, compatibility shims) vs. kept proprietary (Grahm-specific adapters, resolver logic). | Directly shapes the "upstream compatibility automation" lower-priority item's scope. |
| Commercial packaging | The Continuity Grade (Epic 5) and ORB hardware classes are both explicitly framed as customer/procurement/insurer-facing artifacts — packaging and pricing implications should be scoped before those artifacts are finalized, not retrofitted. | A pricing/packaging one-pager mapping ORB classes and Continuity Grades to commercial tiers. | — |

---

## Risk Register

| Severity | Risk | Mitigation |
|---|---|---|
| **Critical** | **Stale-but-resilient facility data is more dangerous than no data at all** (the memo's own core safety argument). An offline system that keeps confidently serving an outdated "Exit A: OPEN" is worse than a system that visibly fails. | This is the reason Facility Truth (Epic 4) and Answer Receipts exist as designed above: confidence must decay automatically, staleness must be visible in every answer, and "I cannot verify this offline" must be a first-class, tested output — not a fallback nobody implements. Epic 5 should include an explicit scenario testing that stale data is correctly flagged, not just that stale data doesn't crash the system. |
| **Critical** | **False PASS in Qualification** — a "Continuity Grade: A" that doesn't reflect reality is worse than no grade, because it will be relied upon by customers/auditors/insurers per the memo's own framing. | Meta-tests for every qualification scenario (see Epic 5 acceptance tests); versioned, published rubric; treat rubric loosening as a reviewed event. |
| **High** | **Revocation propagation lag** — a credential revoked centrally can remain valid on a disconnected node until the next epoch sync reaches it. | Must be a documented, bounded SLA, not an unstated gap; sync-cycle frequency should be tunable per deployment risk tolerance. |
| **High** | **TerraNova maturity/scope unknown** — Epic 3's timeline is bound by whichever of the three engines is least ready, and the memo gives no detail on TerraNova's actual state. | Resolve via the archive if it becomes available `[ARCHIVE]`; if not, timebox a spike to establish TerraNova's actual current state before committing an Epic 3 estimate. |
| **Medium-High** | **Resolver scope creep into "build a mini-Kubernetes"** — the memo explicitly warns against new major subsystems, but a capability resolver/executor can organically grow into one if not bounded. | Explicit non-goals for Epic 2 (single-node first; multi-node/ORB-3 clustering is out of scope until proven necessary); review resolver design against the "is this a subsystem?" test before adding features. |
| **Medium** | **IndoorGML Part 2 doesn't exist yet** — Part 1 is conceptual/UML only; any real implementation work needs Part 2 (GML/SQL/JSON schemas) which is still forthcoming `[VERIFIED]`. | Use IndoorGML Part 1 for conceptual alignment now; do not block the Grahm Facility Model's own (proprietary) implementation schema on Part 2's publication; revisit interchange-format support once Part 2 ships. |
| **Medium** | **Cosign offline-verification behavior is recent and still changing** in the tool itself (confirmed change merged 2026-01-06). | Pin a specific Cosign/Sigstore library version for the supply-chain extension; re-verify offline-verification behavior against that pinned version before depending on it in Epic 1/5. |
| **Medium** | **Wi-Fi RTT accuracy is hardware- and environment-dependent**, and the memo's "~1-2m" figure is a best-case documentation claim, not a guaranteed field result. | Positioning Interface must always report confidence and always support manual fallback (per memo, correctly) — treat this as validated design intent, not an accuracy guarantee to market on without qualification. |
| **Low-Medium** | **Break-glass technical logging without an organizational review process** becomes theater rather than a control. | Pair the technical audit log (Epic 4) with an explicit non-technical review workflow — flagged under the security threat model workstream above. |

---

## On the Trailing Multi-Agent Implementation Request

The final line of the task asked to "extract the architecture and build from the zip file... with a multi-agent approach," using specific models "only... to review the code," against "open source repos which you can gain access." This directly conflicts with the task's own explicit, repeated instruction to **not implement code in this response** and to treat implementation as out of scope. I resolved that conflict by following the dominant, detailed, structured instruction set (deliver the plan) rather than the one-line trailing instruction, and did not clone, fork, or write code against any GitHub repository in this pass — doing so would have been starting implementation under a different name.

What I did fold into this plan, since it's a legitimate staffing/execution question the plan should answer: **how implementation should be resourced once you decide to start it.** A workable pattern once Epic 1 begins:

- One or more implementation agents/engineers write code for a given epic against this plan's interfaces/acceptance criteria.
- A separate review pass — using stronger reasoning models specifically for review, not authorship, matching the intent of your instruction — checks each epic's output against this plan's acceptance tests and failure modes before merge, with particular scrutiny on Epic 4 (identity/authority) and Epic 5 (qualification meta-tests), where a subtly wrong implementation is more dangerous than a missing one.
- Each epic is a separate, independently reviewable unit of work (this plan is structured that way on purpose), which parallelizes across multiple implementation agents without them stepping on each other, provided Epic 1's schema is frozen first — which is exactly why it's sequenced first.

If you want, the next turn can start Epic 1 implementation under this model. I'd need: (a) confirmation the archive should be uploaded into this repo/workspace so it can actually be inspected, and (b) the two `[OPEN]` defaults flagged above (schema tooling language choice, container-vs-native packaging) either confirmed or explicitly left to my judgment.

---

## Open Questions Summary

**Archive-dependent (`[ARCHIVE]`) — would be resolved immediately if the zip were made available in this workspace:**
- Is there an existing `.grahm`-equivalent schema draft already, and does it match/contradict Epic 1's field list above?
- Does the archive contain a working TerraNova/maps ingestion pipeline — and if so, what is its actual current scope, license posture, and data-source provenance (this is the single highest-leverage unknown in the whole plan, directly affecting Epic 3's estimate)?
- Does the archive define a facility-data schema that Facility Truth (Epic 4) should wrap rather than duplicate?
- Does the archive imply a specific process/container packaging model already committed to (affecting Epic 2's open container-vs-native decision)?

**Genuinely underdetermined (`[OPEN]`), presented with alternatives above rather than forced:**
- Container-based vs. native-process capability packaging (Epic 2).
- Service identity mechanism: bespoke per-node certs vs. SPIFFE/SPIRE-style (Epic 4).
- User/device credential encoding: bespoke compact token vs. W3C Verifiable Credentials (Epic 4).
- Power-loss qualification fidelity split between CI-automatable software simulation and periodic real-hardware certification (Epic 5).
- Target install-time SLA, target test-area scope for Epic 3, and Continuity Grade thresholds — none specified in the memo; defaults assumed where stated, otherwise left open pending a first planning conversation with whoever owns the customer/procurement relationship.
