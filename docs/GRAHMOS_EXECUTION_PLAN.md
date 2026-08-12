# GrahmOS Continuity Control Plane — Engineering Execution Plan

Status: v1 draft for engineering review
Scope: specification, sequencing, interfaces, acceptance criteria, risk, staffing shape.
No production code is specified here; this is the plan that unblocks Epic 1 immediately.

---

## Executive summary

Build **Epic 1 (Grahm Bundle v1 spec + OCI/ORAS packaging)** first, because every other
epic consumes its output: the runtime parses it, the demo bundle instantiates it, Facility
Truth and identity artifacts ride inside it, and Qualification grades it. Ship the bundle
schema, media types, signing profile, and a `grahm pack/push/pull/verify` toolchain against
a local OCI registry and an on-disk OCI layout (sneakernet path) before writing any
orchestration code. Epic 2 (Runtime) then turns verified bundles into running services via
a pluggable "deployment driver" (Compose-class driver first). Epic 3 proves it end-to-end
with one `hospital-demo.grahm` running Sahana + Valhalla + TerraNova on a single ORB-1 box
with the WAN physically cut. Epic 4 (Facility Truth + offline identity) runs partially in
parallel — its data contracts must be frozen early because bundle and receipt schemas embed
them. Epic 5 (Qualification) converts the demo into a repeatable, auditable pass/fail
harness and is the commercial artifact. The single highest-severity risk is the memo's own
safety argument: offline resilience makes stale facility data *more* durable, so expiry and
degrade-to-refusal semantics are first-class schema fields from day one, not UX polish.

---

## 0. Evidence handling, archive status, and baseline assumptions

### 0.1 Evidence labels used throughout

| Label | Meaning |
|---|---|
| `[FACT-USER]` | Supplied by the user/memo; taken as their position, not verified by me |
| `[VERIFIED]` | Checked against primary sources during planning (citation given) |
| `[KNOWLEDGE]` | High-confidence from my training, not re-verified this session |
| `[INFERENCE]` | Conclusion I drew from verified facts or the memo |
| `[ASSUMPTION]` | Default I chose because the input is silent; changeable |
| `[VERIFY: …]` | Placeholder — do not treat as fact until checked |

### 0.2 Archive status — plain statement of limitation

The referenced archive `c:\Users\suppo\Downloads\Kimi_Agent_Google Maps Ingestion Build.zip`
is a Windows-local path. **It is not present in this environment** (the workspace is the
`Greenmamba29/Grahmos_map` GitHub repo, which currently contains only a README and LICENSE —
no code, manifests, pipelines, or schemas). This plan therefore proceeds from the memo alone.
The archive would answer, and should be reconciled against this plan when available:

1. What "TerraNova" concretely is: which tile server, which search engine, which UI, which
   ingestion pipeline (the memo names it but never defines it — largest single unknown).
2. Whether a Google Maps ingestion pipeline already exists (schemas, ETL scripts, data
   licensing posture of any Google-sourced data — a potential legal blocker, see §13).
3. Existing repo layout and whether any `.grahm` prototype, manifest draft, or deployment
   script already exists (would moot parts of Epic 1/2 or constrain their shape).
4. Which databases and adapters are already selected/configured (memo says "databases,
   search, adapters" without naming them).
5. Any existing container images, versions, and licenses to feed the license inventory.

Nothing in the memo's P0 gap list can be shown "already satisfied by the archive" because
the archive is unavailable; every P0 item is scheduled below instead.

### 0.3 Verification results for the memo's third-party claims

| Memo claim | Status | Finding |
|---|---|---|
| OCI artifacts carry arbitrary types; can reference related artifacts | `[VERIFIED]` | OCI Image/Distribution Spec 1.1 adds `artifactType` + `subject` fields and the Referrers API (`GET /v2/<name>/referrers/<digest>`). Nuance: registries without the API require the client-managed **referrers tag schema** fallback. ([OCI blog, 2024-03-13](https://opencontainers.org/posts/blog/2024-03-13-image-and-distribution-1-1/); [distribution-spec](https://github.com/opencontainers/distribution-spec/blob/main/spec.md)) |
| ORAS provides generic OCI push/pull and artifact attachment | `[VERIFIED]` | `oras push` / `oras attach --artifact-type …` with `--distribution-spec v1.1-referrers-api|tag` compatibility flags. ([oras-project/oras docs](https://github.com/oras-project/oras/blob/main/docs/proposals/compatibility-mode.md)) |
| TUF defines Root/Targets/Snapshot/Timestamp roles; defends against rollback and key compromise | `[KNOWLEDGE]` | Consistent with the TUF specification. Nuance for GrahmOS: the Timestamp role's freshness guarantee assumes periodic connectivity; a long-offline site cannot distinguish "stale" from "current" — this must become an explicit max-staleness policy (§10.4). |
| Sigstore/Cosign signs arbitrary blobs; bundles verifiable without contacting the transparency service | `[VERIFIED]` | `cosign sign-blob`/`verify-blob` with `--bundle` and `--offline`; the protobuf bundle format explicitly supports offline verification. Nuance: artifacts not in public Rekor need `--insecure-ignore-tlog` or a private Sigstore deployment; keyless (Fulcio OIDC) signing is a poor fit for issuers/verifiers that are offline → **use keyed signing with a Grahm root + TUF-managed rotation** (§10.4). ([cosign verify-blob docs](https://github.com/sigstore/cosign/blob/main/doc/cosign_verify-blob.md); [Cosign 2.0 release notes](https://blog.sigstore.dev/cosign-2-0-released/)) |
| Wi-Fi RTT multilateration typically ~1–2 m on compatible Android hardware | `[VERIFIED]` | Android developer docs state multilateration against 3+ RTT-capable APs is "typically accurate within 1-2 meters"; requires IEEE 802.11mc (802.11az on Android 15+) APs *and* phones. Field reports show per-AP calibration offsets and multipath degradation → confirms the memo's multi-technology + manual-fallback stance. ([Android Wi-Fi RTT docs](https://developer.android.com/develop/connectivity/wifi/wifi-rtt)) |
| OGC IndoorGML 2.0 Part 1 published August 2025 | `[VERIFIED, date nuance]` | Document publication date 2025-06-26; OGC's public announcement 2025-08-28. **Material nuance: Part 2 (GML/JSON/SQL encodings) is still in progress** — there is no finalized interchange *encoding* yet, only the UML conceptual model. This changes the adapter plan (§10.3). ([OGC 22-045r5](https://docs.ogc.org/is/22-045r5/22-045r5.html); [OGC announcement](https://www.ogc.org/announcement/ogc-publishes-indoorgml-2-0-part-1-conceptual-model-standard/)) |
| CAP is a network-independent all-hazard alert format with geo-targeting, multilingual messaging, updates/cancellations | `[KNOWLEDGE]` | Consistent with OASIS CAP 1.2. XML-based; widely deployed (IPAWS, EU-Alert, Google Public Alerts). Fit for the canonical-in/out role is good (§10.2). |
| NIST zero-trust guidance: network location alone must not grant trust | `[KNOWLEDGE]` | Consistent with NIST SP 800-207 tenets. The memo's harder problem (unreachable identity provider) is real and NIST does not solve it; §7 addresses it directly. |

Judgment note per the evidence-handling instruction: none of these standards is adopted
*because* it is official. OCI/ORAS is adopted for offline behavior (content-addressed,
works from an on-disk layout with zero infrastructure) and tooling maturity. TUF is adopted
for its threat model, with an explicit documented deviation on timestamp freshness.
IndoorGML is deliberately **not** adopted as an internal model — only as an isolated
adapter target — because its encoding is unfinished and its fit to emergency-operational
semantics (verified/expired exits) is poor.

### 0.4 Baseline assumptions (all changeable; plan marks the blast radius of each)

- `[ASSUMPTION]` Team: 3–6 engineers plus the founder. Effort below is sized S/M/L/XL
  relative to one engineer, with explicit parallelism; no calendar estimates.
- `[ASSUMPTION]` First customer archetype: one mid-size hospital or campus pilot (drives
  the demo bundle content and the ORB-1 default).
- `[ASSUMPTION]` Hardware not yet purchased; ORB-1 (commodity mini-PC, 16–64 GB RAM,
  NVMe SSD, Ethernet + Wi-Fi AP) is the reference target. x86_64 primary, arm64 kept
  buildable but not qualified initially.
- `[ASSUMPTION]` Greenfield code layout: a new `grahmos` monorepo for spec + runtime +
  qualification; this `Grahmos_map` repo holds the maps/TerraNova side. Revisit when the
  archive is reconciled.
- `[ASSUMPTION]` "TerraNova" = the in-house offline maps stack (vector tiles + search +
  web UI). Concrete components `[VERIFY: against archive]`; Epic 3 treats it as a black
  box behind two contracts (tile serving, geocoding/search API) so the plan survives
  whatever it turns out to be.

### 0.5 Reconciling the two instructions in the request

The task body says "do not implement code; deliver the plan"; the trailing line says
"extract the architecture and build from the zip … with a multi agent approach." These
conflict, and the zip is unavailable, so this document follows the dominant, detailed
instruction (the plan). The multi-agent build request is honored as §12, an execution
model that maps implementation agents to epics with **Fable 5 / Opus confined to
review-only gates**, and §12.2 confirms every borrowed component is open source on
publicly accessible GitHub repos.

---

## 1. Epic 1 — Grahm Bundle v1 specification + OCI/ORAS packaging

### 1.1 Objective

A formal, versioned, machine-verifiable `.grahm` format such that (a) a bundle can be
authored, packed, signed, pushed, pulled, and verified with no network beyond an optional
LAN registry, and (b) every later epic consumes the same schema without rework.

### 1.2 Deliverables

1. **Spec document** `grahm-bundle-spec/v1` (normative, RFC-2119 language, SemVer'd).
2. **JSON Schema** for the bundle manifest + machine-readable capability ID grammar.
3. **Media type registry** (namespaced, e.g.):
   - `application/vnd.grahm.bundle.manifest.v1+json`
   - `application/vnd.grahm.dataset.v1` (+ parameterized format annotation)
   - `application/vnd.grahm.facility-model.v1+json`
   - `application/vnd.grahm.qualification-report.v1+json`
4. **CLI** `grahm pack | push | pull | verify | inspect` built on ORAS libraries.
5. **Signing profile**: Cosign keyed signatures attached as OCI referrers; TUF metadata
   layout for the publishing side (§10.4 details).
6. **Conformance suite**: golden bundles + tamper fixtures (bit-flip, wrong key, stale
   metadata, oversize, missing referrer) that any implementation must pass.
7. **Offline transport story**: OCI image-layout directory as the sneakernet unit
   (USB/SSD), byte-identical semantics to registry pull.

### 1.3 Manifest schema sketch (field list, not exhaustive)

```yaml
apiVersion: grahm.io/bundle/v1
kind: Bundle
metadata:
  name: hospital-demo            # DNS-safe
  version: 1.4.7                 # SemVer
  publisher: grahm-authority:prod
  created: <RFC3339>
  description: ...
capabilities:                    # what this bundle PROVIDES
  - id: cap.incident-management  # capability ID grammar frozen here (see §11.6)
    version: ">=1.0"
    provider: service/sahana
  - id: cap.routing.indoor
  - id: cap.map.tiles
  - id: cap.search.places
dependencies:
  bundles: []                    # other .grahm by name+digest (base/overlay model)
  capabilities: []               # abstract requirements resolvable from other bundles
hardware:
  ram_gb: 16
  storage_gb: 80
  cpu: {arch: [amd64], min_cores: 4}
  accelerator: optional
  uptime_class: ORB-1            # §11.5
  networking: [ethernet, wifi-ap]
services:
  - name: sahana
    image: <registry-relative ref>@sha256:...   # digest-pinned, no floating tags
    healthcheck: {type: http, path: /healthz, interval_s: 10, failure_threshold: 3}
    depends_on: [postgres]
    resources: {ram_mb: 4096}
    restart: always
    persistence: [{volume: sahana-db, backup_class: critical}]
data:
  - name: valhalla-tiles
    mediaType: application/vnd.grahm.dataset.v1
    digest: sha256:...
    size_bytes: ...
    freshness:                   # Facility-Truth-aware from day one
      produced_at: <RFC3339>
      max_age_days: 180
      on_expiry: degrade         # degrade | refuse | warn  (never silently serve)
integrity:
  digest_algorithm: sha256
  manifest_digest_of: [services, data]
rollback:
  keep_previous: 1
  data_migrations_reversible: true   # false forces snapshot-before-upgrade
policies:
  network_egress: deny            # default-deny; explicit allowlist entries
  update: {channel: stable, max_metadata_age_days: 30}   # TUF staleness policy
  break_glass: {allowed_roles: [facilities_director], dual_control: true}
```

Signatures, SBOMs, qualification reports, and large auxiliary artifacts (models, map
packs) are **not** inline; they are separate OCI artifacts linked via `subject`/referrers
`[VERIFIED mechanism, §0.3]`.

### 1.4 Build / borrow / adapt

| Piece | Decision | Rationale |
|---|---|---|
| Bundle semantics, schema, capability grammar | **OWN** | This is the control-plane moat; nothing off-the-shelf models capabilities + facility truth + qualification together |
| Artifact structure & transport | **BORROW** (OCI 1.1 + ORAS) | Content-addressing, referrers, mature tooling, works fully offline via image-layout dirs |
| Local registry on the ORB | **BORROW** | Candidates: CNCF `zot` (native referrers support `[VERIFY: current conformance]`) or plain OCI layout with no registry at all for ORB-0/1. Decide by benchmark on multi-GB blobs, not by preference |
| Signing | **BORROW** (Cosign keyed) + **OWN** trust policy | §10.4 |

Rejected alternative, with reason: inventing a bespoke tar+manifest format (loses
content-addressing, dedup between bundle versions, referrers, and the entire OCI tooling
ecosystem for zero gain). Also considered `[INFERENCE]`: Nix/Guix closures solve
reproducible deployment but impose a language and store model on every engine and have no
referrers/signature-attachment story matching OCI; rejected as the packaging substrate,
worth revisiting only for *building* images reproducibly.

### 1.5 Dependencies and ordering

No upstream dependencies — this epic starts immediately. Freeze order inside the epic:
capability ID grammar → manifest schema → media types → CLI → signing profile →
conformance suite. The grammar freezes first because Epics 2, 3, and the P2 registry all
key on it.

### 1.6 Acceptance tests

- Round-trip: `pack → push(local registry) → pull → verify` and `pack → export(OCI
  layout on USB) → import → verify` produce digest-identical results.
- Every tamper fixture is rejected with a distinct, machine-readable error code.
- A signature/SBOM attached via referrers is discoverable and verifiable offline against
  a pinned trust root, on a registry **with** the Referrers API and on one requiring the
  tag-schema fallback.
- A 50+ GB data blob (synthetic) packs, transfers, and verifies with streaming (no
  full-file memory buffering); resumable pull after interruption.
- Schema versioning: a v1.1 manifest with unknown optional fields verifies under a v1.0
  verifier per the spec's compatibility rules; unknown *critical* fields fail closed.

### 1.7 Failure modes

- Registry lacks Referrers API → tag-schema fallback (client-managed index) `[VERIFIED]`.
- Digest mismatch mid-pull → resume/retry, then quarantine artifact, never partial-install.
- Clock skew on offline ORBs breaks `created`/expiry comparisons → all freshness logic
  must tolerate skew windows and record the clock source in receipts (§11.4).
- Spec drift across twenty repos → conformance suite is the single source of truth; CI in
  every consumer repo runs it.

### 1.8 Open questions

- One monolithic bundle per facility vs. base+overlay (`hospital-base.grahm` +
  `facility-stpauls.grahm` with site data)? Overlay model is likelier long-term; v1 spec
  should include `dependencies.bundles` so overlays don't force v2. **Underdetermined;
  both presented, spec keeps both possible.**
- Where do >100 GB regional map packs live: inside the bundle vs. a referenced
  `datapack` artifact with independent lifecycle? Leaning referenced-artifact (update
  maps without re-shipping software); decide during Epic 3 with real sizes.

---

## 2. Epic 2 — Grahm Runtime + `grahm install`

### 2.1 Objective

`grahm install hospital.grahm` executes the memo's pipeline — verify → resolve → plan →
apply → health → offline-qualify → READY — transactionally, idempotently, and resumable
across power loss.

### 2.2 Deliverables

1. **Runtime daemon/CLI** with verbs: `install`, `upgrade`, `rollback`, `status`,
   `verify`, `qualify`, `inspect`.
2. **Fact collector**: hardware inventory (CPU, RAM, storage, accelerators, NICs,
   TPM presence), software inventory (driver, kernel, container engine), existing-state
   inventory (installed bundles, data revisions).
3. **Capability resolver**: bundle requirements × facts × installed state → satisfiable /
   unsatisfiable-with-reasons.
4. **Deployment planner**: emits a `DeploymentPlan` (ordered, journaled steps) — this is
   an inspectable artifact, not hidden internal state.
5. **Deployment driver interface** + first driver (see 2.4).
6. **Health engine**: per-service probes from the manifest, aggregate readiness gates.
7. **State store**: local SQLite journal — installed bundles, revisions, plan execution
   log, qualification results, receipts index. Append-only event table for audit.

### 2.3 Interfaces / contracts

```jsonc
// DeploymentPlan (emitted by planner, consumed by driver, archived in state store)
{
  "plan_id": "…", "bundle": {"name": "…", "version": "…", "digest": "sha256:…"},
  "preconditions": [{"check": "storage_free_gb>=80", "result": "pass"}],
  "steps": [
    {"id": 1, "op": "volume.create", "args": {…}, "compensation": "volume.delete"},
    {"id": 2, "op": "service.start", "args": {"name": "postgres"}, "wait_for": "healthy"}
  ],
  "rollback_point": {"snapshot_id": "…"}
}
```

Driver interface (the load-bearing abstraction): `apply(step)`, `compensate(step)`,
`probe(service)`, `snapshot(volumes)`, `restore(snapshot)`. Everything above the driver is
substrate-agnostic.

### 2.4 Build / borrow / adapt — the orchestration substrate decision

**This is genuinely underdetermined**; three viable options, trade-offs:

| Option | Pros | Cons |
|---|---|---|
| (a) Docker/Podman Compose-class driver | Simplest; fits ORB-0/1; smallest attack surface; easiest to make deterministic | No multi-node failover; DIY volume snapshots |
| (b) k3s (single or multi node) | ORB-2/3 failover for free; declarative reconciliation | Heavy for a mini-PC under duress; large failure-mode surface the Qualification suite must then cover; risks "we built a worse k8s wrapper" |
| (c) systemd + Podman Quadlet | No daemon dependency; robust restart semantics; distro-native | More per-service glue; weaker ecosystem for health aggregation |

**Recommendation** `[INFERENCE]`: own the plan/journal/driver abstraction (that is the
proprietary part), ship driver (a) or (c) first — decide by a one-week spike measuring
crash-recovery behavior on forced power loss — and add a k3s driver only when an ORB-3
customer exists. Do **not** let the runtime's value proposition become "we wrapped k8s."

Borrow: container engine, SQLite, filesystem snapshot mechanism (LVM/btrfs/ZFS —
`[VERIFY: pick by snapshot+restore benchmark on target SSDs]`). Own: resolver, planner,
journal, driver contract, health aggregation semantics.

### 2.5 Dependencies and ordering

Depends on Epic 1 (manifest schema + verifier library). Internal order: fact collector →
resolver → planner → driver → health → transactional upgrade/rollback. `qualify` verb is
a stub until Epic 5 supplies scenarios.

### 2.6 Acceptance tests

- Clean install on a wiped ORB-1 reaches READY with all health checks green, WAN
  disconnected the whole time (bundle sourced from USB OCI layout).
- Re-running `install` is a no-op (idempotence proven by journal diff).
- `upgrade` to a bad version (failing health) auto-rolls-back to the prior version
  including data snapshot; state store shows both attempts.
- Hardware-insufficient bundle fails at RESOLVE with a machine-readable reason —
  **before** any mutation.
- Unsigned / wrongly-signed / stale-metadata bundle refused at VERIFY (reuses Epic 1
  fixtures).
- Power cut at three injected points (mid-pull, mid-apply, mid-health) → on boot, runtime
  resumes or compensates to a consistent state, never a half-running system.

### 2.7 Failure modes

Partial apply (journal + compensation steps); disk-full mid-install (precondition checks
+ reserved headroom); container engine wedged (driver-level watchdog, escalate to reboot
policy); clock loss on battery-dead RTC (monotonic sequence numbers in journal, not wall
clock); resolver deadlock between mutually-dependent bundles (resolution is over a DAG;
cycles are a validation error at pack time, enforced by Epic 1 conformance).

### 2.8 Open questions

- Single-binary Go-style runtime vs. supervisor + plugins? `[ASSUMPTION: single static
  binary + driver plugins]`, revisit after driver spike.
- Does `grahm install` own OS provisioning (image the ORB) or assume a prepared OS?
  v1: prepared OS image built separately; OS-image pipeline is an ORB-spec deliverable
  (§11.5).

---

## 3. Epic 3 — One bundle running Sahana + Valhalla + TerraNova

### 3.1 Objective

A single `hospital-demo.grahm` that installs on one ORB-1 and serves, LAN-only: incident
management (Sahana), indoor/outdoor routing (Valhalla), map tiles + place search
(TerraNova), with shared facility identifiers — the existence proof that the control plane
composes real engines.

### 3.2 Deliverables

1. Digest-pinned container images for: Sahana Eden `[KNOWLEDGE: github.com/sahana/eden]`,
   Valhalla `[KNOWLEDGE: github.com/valhalla/valhalla]`, TerraNova services
   `[VERIFY: from archive]`, Postgres/PostGIS, search engine `[VERIFY: which one]`.
2. Data artifacts: OSM extract for the pilot region, prebuilt Valhalla routing tiles,
   vector tile pack (MBTiles/PMTiles class), search index, one facility model (pilot
   building) authored in the Facility Truth schema (Epic 4 contract, even if the
   approval workflow isn't built yet).
3. **Integration shims (the real work of this epic):**
   - Facility ID namespace shared across engines (a place found in search resolves to
     the same ID Valhalla routes to and Sahana references in incidents).
   - Reverse proxy + single origin, LAN TLS story `[ASSUMPTION: private CA provisioned
     at install; revisit with Epic 4 identity]`.
   - Auth stub: one shared session mechanism, replaced by Epic 4 credentials later —
     built behind the Epic 4 token-shape contract so replacement is a swap, not a rewrite.
4. Demo script + seeded scenario data (used again by Epic 5 and the demo milestone).

### 3.3 Build / borrow / adapt

Engines: BORROW unmodified where possible; patches go upstream (policy §13.5). Data
pipelines (OSM → Valhalla tiles, OSM → vector tiles/search): ADAPT existing open tooling.
Integration shims and facility ID namespace: OWN. Explicitly **do not** fork engines to
inject Grahm semantics — semantics live in the bundle/adapters, keeping upstream
compatibility automation viable (§11.7).

### 3.4 Dependencies and ordering

Depends on Epic 1 (format) and Epic 2 (runtime MVP: install + health; upgrade/rollback
can land after). Can start early in parallel: containerization and data pipeline work
need no Grahm code at all. The facility ID namespace needs Epic 4's *schema* (not its
workflow) — freeze that contract before shim work starts.

### 3.5 Acceptance tests

- With WAN physically disconnected before install begins: install from USB, then on a
  phone joined to the ORB's Wi-Fi — map renders, "radiology" search returns the right
  room, route to it computes with floor transitions, an incident filed in Sahana
  persists across an ORB power cycle.
- All inter-service traffic stays on-box (verified by packet capture — no DNS or
  external calls attempted; egress default-deny policy from the manifest enforced).
- Bundle installs identically on a second, differently-specced ORB-1 machine (catches
  hidden host dependencies).

### 3.6 Failure modes

Engine startup ordering (Valhalla needs tiles mounted before ready; expressed via
`depends_on` + readiness gates, not sleep hacks); memory pressure on 16 GB with all
engines resident (resource limits in manifest; resolver enforces); search/tile datasets
drifting out of sync with the facility model (all three carry the same
`facility_model_revision` — mismatch is a health-check failure, not a warning).

### 3.7 Open questions

- What TerraNova actually is (§0.2 Q1) — every unknown here is contained behind the tile
  and search contracts.
- Sahana Eden's maintenance status and Python/runtime currency `[VERIFY: repo activity
  and supported Python version]` — if unmaintained, effort shifts from "package" to
  "package + minimal fork with a documented divergence budget," which changes this
  epic's size from M to L.

---

## 4. Epic 4 — Grahm Facility Truth + offline identity & authority

Two subsystems, one epic, because both are trust plumbing the memo correctly refuses to
fake: *what facts are trusted* and *who is trusted to act*.

### 4.A Facility Truth

#### Objective

Every operational fact (exit, corridor, hazard zone, shelter point) carries revision,
provenance, verification, approval, expiry, and a lifecycle state — and consumers
(routing, receipts, qualification) treat those fields as load-bearing.

#### Data contract sketch

```yaml
facility_object:
  id: fac.stpauls.exit.A          # same namespace Epic 3 froze
  type: exit
  geometry_ref: <ref into facility model geometry store>
  revision: 67                     # monotonic per object; append-only history
  lifecycle: ACTIVE                # DRAFT | FIELD_VERIFIED | APPROVED | ACTIVE
                                   # | SUPERSEDED | EXPIRED
  provenance: {source: ifc-import, source_ref: <digest>, imported_at: …}
  verification: {verified_by: user:…, verified_at: …, method: field-walk}
  approval: {approved_by: role:facilities_director, approved_at: …,
             signature: <cosign sig over canonical object>}
  validity: {valid_until: <RFC3339>, on_expiry: degrade}
  confidence: verified             # verified | reported | inferred | stale
```

Lifecycle transitions are signed events in an append-only log; `ACTIVE → EXPIRED` happens
autonomously on the ORB by clock policy (skew-tolerant, §1.7). **The safety-critical
rule, enforced in the routing adapter and testable in Epic 5: expired/stale objects are
excluded from "verified safe route" computation and may only appear in explicitly
degraded answers; zero verified routes ⇒ the refusal answer, never a synthesized one.**
This is the direct mitigation for the memo's core safety argument.

#### Build/borrow: OWN

the model and workflow engine (nothing off-the-shelf combines
GIS-ish objects with signed approval lifecycles); BORROW storage (Postgres, already
present) and signing (Cosign, already present).

#### Acceptance tests

Object cannot reach ACTIVE without FIELD_VERIFIED + APPROVED signatures from distinct
principals; expiry flips routing behavior in an integration test (route through Exit A
before expiry, degraded-or-refused after); full revision history reconstructible and
signature-verifiable offline; import from IFC/DXF lands as DRAFT only.

#### Failure modes / open questions

Who field-verifies at a real customer and on what cadence (product/ops question — the
system must make cadence *visible* via qualification and receipts, it cannot force
compliance); mass-expiry cliff when a whole survey ages out simultaneously (stagger
`valid_until` at authoring time; qualification warns on expiry-date clustering).

### 4.B Offline identity & authority

#### Objective

Verify who/what/role/scope on a LAN with no reachable IdP, with expiry, revocation
epochs, and auditable break-glass — per the memo's required credential fields.

#### Credential contract (fields; format decision below)

`device_id` (hardware-bound key, TPM-backed where present), `user_id`, `roles[]`,
`scope[]` (facility/bundle-level), `iat/exp` (short-lived: hours–days, not months),
`issuer` (facility authority key, chained to Grahm root), `revocation_epoch` (monotonic
integer), `break_glass` (absent | grant with dual-control co-signatures and time box).

**Format decision — underdetermined, three candidates:**

| Option | Pros | Cons |
|---|---|---|
| Signed JWT/COSE tokens against facility CA | Ubiquitous libraries, easiest audits | Attenuation/delegation is DIY |
| Biscuit tokens | Offline attenuation built in (hand a medic a narrowed token with no IdP) | Smaller ecosystem, fewer eyes `[VERIFY: current audit status]` |
| W3C Verifiable Credentials | Standards story for cross-org trust | Heavy for LAN-local v1; ecosystem churn |

Recommendation `[INFERENCE]`: v1 = COSE/JWT against a facility CA (fastest to a *correct*
implementation), with the token shape kept Biscuit-compatible so offline attenuation can
be adopted at v2 without re-issuing identities. Present both to whoever owns security
sign-off.

**Revocation while disconnected — honest design, not hand-waving:** each bundle update
and each LAN sync carries the latest `revocation_epoch` + revocation list; tokens minted
before a listed revocation are rejected on next contact with any ORB. Between syncs there
is an **irreducible acceptance window**; the design makes it explicit, bounded by token
`exp`, measured by Epic 5, and disclosed in the threat model — rather than pretending
offline revocation can be instantaneous.

**Break-glass:** offline ceremony requiring two credentialed principals (or one + a
tamper-evident physical token `[ASSUMPTION: decide with customer]`), granting a
time-boxed elevated role; every break-glass use writes a signed audit event and trips a
mandatory-review flag in the next qualification report.

#### Build/borrow

OWN the authority model, epoch/revocation scheme, break-glass ceremony. BORROW all
cryptography (no bespoke crypto): standard signature suites, TPM stack, Cosign/TUF
roots already introduced in Epic 1.

#### Acceptance tests

All operations verifiable with IdP unreachable (WAN cut); expired token rejected; token
from revoked epoch rejected after sync and *measurably accepted before it* (the window is
asserted, logged, and bounded by `exp`); break-glass grants elevated scope, expires on
schedule, and produces the audit trail; a stolen device key without a user credential
gets device-only scope (no operational writes).

#### Dependencies

Trust-root and signing machinery from Epic 1; consumed by Epic 3's auth-stub replacement
and Epic 5's unauthorized-action scenarios. Facility Truth approval signatures use these
identities — so 4.B's issuer hierarchy must be designed (not necessarily built) before
4.A approvals are implemented.

---

## 5. Epic 5 — Grahm Qualification

### 5.1 Objective

An automated, auditable suite that proves continuity by actually severing things, and
emits a signed, human-legible Continuity Qualification Report — the memo's commercial
artifact.

### 5.2 Deliverables

1. **Scenario DSL** (YAML): fault to inject, expected behavior, evidence to capture.
2. **Fault injectors**: WAN cut (netns/nftables *and* physical via managed-switch port
   or USB relay — software-only cuts miss real failure modes like link-state-triggered
   bugs), DNS breakage, edge-node kill, power cycle via smart PDU, corrupt/stale/
   unsigned bundle fixtures (from Epic 1), single-service crash, disk-latency injection.
3. **Assertion library**: routing answers, search answers, incident persistence, receipt
   content (freshness fields!), refusal-state correctness.
4. **Report generator**: signed `application/vnd.grahm.qualification-report.v1+json`
   attached to the installed bundle record via referrers; plus the human summary
   (PASS/FAIL per scenario, Continuity Grade).
5. **Grade rubric** (objective, published): e.g. Grade A requires all P0 scenarios PASS
   including physical WAN cut and power cycle; grades must be criteria-referenced so an
   auditor can recompute them — otherwise the grade is marketing, not qualification.

### 5.3 Scenario set v1 (from the memo, made testable)

WAN OFF / Cloud OFF / DNS broken / edge node down / power restart → PASS required;
stale update / corrupt pack / unauthorized pack / revoked-credential action → REJECT
required; local routing / local search / incident persistence / receipt freshness
disclosure / stale-facility-data degradation (§4.A rule) → PASS required.

### 5.4 Build/borrow

OWN the DSL, assertions, report, rubric (this *is* the product). BORROW injectors where
mature (Linux netns/tc/nftables; smart-PDU control `[VERIFY: pick PDU with local API,
no cloud dependency — a cloud-dependent PDU in the continuity lab would be an irony
defect]`). Chaos-engineering frameworks (k8s-centric) are poor fits for a single mini-PC
under physical faults — evaluated and set aside `[INFERENCE]`.

### 5.5 Dependencies, acceptance, failure modes

Depends on Epics 1–3 (something real to qualify) and consumes Epic 4 fixtures. Acceptance
of the harness itself: seeded-defect testing — deliberately break persistence, freshness
disclosure, or signature checking in a test build and confirm the suite catches each
(mutation testing of the qualifier). Failure modes: flaky scenarios eroding trust (every
scenario must be deterministic or auto-retried with attempt disclosure in the report);
qualification passing in the lab but not at the customer site (report binds to hardware
inventory hash; re-qualification required on hardware change).

### 5.6 Open questions

Third-party audit path (who vouches for the vouching?) — defer, but keep evidence
formats stable; per-customer-site re-qualification cadence (proposal: every bundle
upgrade + every 90 days `[ASSUMPTION]`).

---

## 6–11. Lower-priority items (P1/P2) — scheduled, deferred, or satisfied

### 11.1 Indoor positioning — Grahm Positioning Interface (P1, after Epic 3)

- Contract first: providers (Wi-Fi RTT, UWB, BLE, QR/NFC waypoint scan, inertial
  dead-reckoning) emit
  `PositionEstimate {space_ref (facility/floor/coord), accuracy_m, confidence, sources[], at}`;
  a fusion layer arbitrates; **manual "I am here" is a mandatory provider with
  confidence=declared, and every consumer must render confidence** — this is spec'd in
  the contract, not left to app teams.
- Wi-Fi RTT: `[VERIFIED]` ~1–2 m typical with 3+ 802.11mc APs on compatible Android;
  field caveats (per-AP calibration offset, multipath) confirm the memo's
  no-single-technology stance. iOS has no public RTT API `[KNOWLEDGE]` → QR/NFC + manual
  matter more than elegance, exactly as the memo says.
- Cheapest credible first step: QR/NFC waypoints + manual selection (zero hardware
  dependency, works during the demo milestone), RTT as the second provider where the
  pilot's APs support 802.11mc `[VERIFY: AP model capability at pilot site]`.

### 11.2 CAP as canonical alert input/output (P1)

Adopt CAP 1.2 `[KNOWLEDGE]` at the boundary; internal Grahm Alert Contract stays richer
(links alerts to facility objects and receipts). Two adapters: CAP→Grahm (ingest,
geo-target against facility model, expire per CAP semantics) and Grahm→CAP (authorized
incidents out). Acceptance: round-trip a library of real CAP samples (IPAWS/EU-Alert
style) without loss of severity/geo/expiry/multilingual blocks. Small (S–M) and
independent — good early candidate for a parallel agent (§12).

### 11.3 IndoorGML as an interchange target (P1, adapter-only)

`[VERIFIED]` Part 1 (conceptual model) is published; **Part 2 encodings are unfinished**
(§0.3). Consequence: build import/export against Part 1 *concepts* (CellSpace,
connectivity graph, navigation extension) with a clearly-labeled provisional encoding
tracking the Part 2 drafts; isolate behind an adapter module so encoding churn cannot
touch the Grahm Facility Model. Do **not** adopt IndoorGML as the internal model — it has
no notion of verification/approval/expiry, which are GrahmOS's load-bearing fields.
IFC/DXF/OSM importers land as Facility Truth DRAFT objects (§4.A) — import never confers
trust.

### 11.4 Offline answer provenance — Answer Receipts (P1, contract in Epic 1 era)

```jsonc
{ "answer": "...", "generated_at": "...",
  "engines": [{"name": "valhalla", "version": "...", "locality": "local"}],
  "data_sources": [{"name": "facility:stpauls", "revision": 67,
                     "verified_at": "...", "confidence": "verified"}],
  "degradation": null | {"reason": "facility data expired 43d",
                          "guidance": "confirm conditions"},
  "refusal": false }
```

The schema lands with Epic 1 media types; the routing/search wiring lands with Epic 3;
the refusal state ("no verified safe route available") is asserted by Epic 5. Cheap to
carry early, very expensive to retrofit.

### 11.5 ORB hardware classes ORB-0…ORB-X (P1)

A short normative spec: per class, measurable requirements — storage redundancy, UPS
runtime minutes, network paths, restart behavior, environmental rating for ORB-X.
Bundles already declare `uptime_class` (Epic 1 schema); the resolver enforces it
(Epic 2). Deliverables: spec doc + reference BOM for ORB-1 `[ASSUMPTION: first build]` +
the OS image pipeline (§2.8). Deferred: ORB-2/3 reference designs until a customer
requires them — rationale: no failover code should be written before Epic 5 can measure
failover.

### 11.6 Global Capability Registry (P2 — explicitly deferred)

Deferred with rationale: valuable only when multiple bundles/publishers exist. What is
**not** deferred: the capability ID grammar and semantics (frozen in Epic 1) so the
registry later indexes existing IDs rather than forcing a migration.

### 11.7 Upstream compatibility automation (P2 — partially deferred)

Now (cheap): digest-pinning everywhere, an automated dependency-bump bot, rebuild
pipeline per engine. Deferred until Epic 5 exists: auto-qualification of upstream bumps
(the whole point is "new Valhalla passes the continuity suite before any deployment sees
it" — meaningless without the suite).

### 11.8 Secure supply chain (P1 in memo — pulled forward into Epic 1/§10.4)

Scheduled, not deferred, because the memo's §3 argument is accepted: production
"signed/verified/trusted" language requires it. Design: Grahm root (offline, HSM or
airgapped laptop ceremony `[ASSUMPTION: HSM budget exists]`) → TUF root/targets/snapshot/
timestamp roles for the publishing pipeline → Cosign keyed signatures on artifacts,
verified offline via bundles `[VERIFIED]`. Explicit deviation from stock TUF: timestamp
freshness cannot be guaranteed to a long-offline site; policy field
`max_metadata_age_days` (Epic 1 schema) sets the bound, qualification measures behavior
at the bound, receipts disclose staleness. Keyless/Fulcio signing rejected for issuers
and verifiers that are offline (§0.3 nuance).

---

## 7. Dependency graph and ordered sequence

```
Epic 1  Bundle spec + OCI/ORAS + signing profile
  ├──> Epic 2  Runtime (verify→resolve→plan→apply→health)
  │      └──> Epic 3  hospital-demo.grahm  (Sahana+Valhalla+TerraNova)
  │             ├──> SMALLEST CREDIBLE DEMO (§8)
  │             └──> Epic 5  Qualification suite + Continuity Report
  │                    └──> 11.7 upstream auto-qualification (P2)
  ├──> 11.4 Answer Receipt schema (media type)        [early, cheap]
  └──> capability ID grammar ──> 11.6 registry (P2, deferred)

Epic 4A Facility Truth schema  ──(contract only)──> Epic 3 facility IDs & data
Epic 4A workflow + 4B identity ──> Epic 3 auth-stub replacement ──> Epic 5 authz scenarios
(4A schema freeze must precede Epic 3 shim work; 4B build can lag Epic 3 MVP)

Parallel-safe from day one: Epic 3 containerization & data pipelines; 11.2 CAP adapter;
11.5 ORB-1 spec + OS image; §13 non-technical workstreams.
```

Critical path: **1 → 2 → 3 → 5.** Epic 4 is the deliberate partial-parallel track: its
*schemas* are on the critical path (front-load), its *workflows* are not (lag).

Effort shape (relative, no calendar): Epic 1 = M; Epic 2 = L (largest engineering risk);
Epic 3 = M–L (L if Sahana needs forking, §3.7); Epic 4 = L (split M schema+truth /
M identity); Epic 5 = M. With 3–6 engineers: one pair on 1→2 (critical path), one on
Epic 3 prep in parallel, one on 4A schema then 4B design, CAP/ORB-spec as slack-filler
tasks.

---

## 8. Smallest credible demo

**"The cable-cut demo."** One ORB-1 mini-PC, one USB drive, one phone, one visible
Ethernet cable, ideally one smart PDU.

1. Show the empty box. `grahm install hospital-demo.grahm` from USB; signature
   verification output on screen (then, adversarially: install a tampered bundle from a
   second USB — watch it refuse).
2. **Physically unplug the WAN cable.** On the phone via the ORB's Wi-Fi: search
   "Radiology", route to it across a floor change, file an incident.
3. Kill power. Box reboots; map, route, and the filed incident are all still there.
4. Tap the answer: the Receipt shows *Local facility map · Verified 18h ago · Routing
   engine local*.
5. Run `grahm qualify --quick`; hand over the printed Continuity Report.

Requires: Epic 1, Epic 2 MVP (install+health+verify), Epic 3, receipt wiring (11.4), and
a 5-scenario slice of Epic 5. Does **not** require: identity workflows, positioning, CAP,
IndoorGML, upgrades/rollback. This is the earliest point at which "GrahmOS keeps the
world working offline" is demonstrable rather than aspirational — and the tamper-refusal
step is what separates it from "a laptop running Docker Compose."

---

## 12. Multi-agent execution model (per the request's trailing instruction)

The request asks for a multi-agent build approach with **Fable 5 and Opus used only to
review code**. Mapping that onto this plan:

### 12.1 Agent roles and gates

| Lane | Work | Reviewer gate |
|---|---|---|
| Agent A (spec/tooling) | Epic 1 schema, CLI, conformance suite | Fable 5/Opus review-only: schema soundness, fail-closed behavior |
| Agent B (runtime) | Epic 2 resolver/planner/driver | Review gate on transactional semantics + crash-recovery paths (highest-scrutiny lane) |
| Agent C (integration) | Epic 3 containers, data pipelines, shims | Review gate on pinned digests, no-egress proof, license headers |
| Agent D (trust) | Epic 4 schemas → workflows → identity | Review gate mandatory + human security sign-off (crypto-adjacent code never merges on agent review alone) |
| Agent E (qualification) | Epic 5 DSL/injectors/report | Review gate on assertion honesty (no vacuous PASSes) |

Rules: implementation agents never merge to protected branches; every PR requires (a) the
Epic 1 conformance suite green in CI, (b) a review-model approval, (c) human approval on
Epic 4 and on any change to verification/signing logic. Reviewer models are configured
without write access — matching "only used to review the code" literally.

### 12.2 Open-source accessibility of every borrowed component

All third-party components in this plan are open source on publicly accessible GitHub
repos `[KNOWLEDGE, spot-checkable]`: `oras-project/oras`, `opencontainers/*` specs,
`sigstore/cosign`, `theupdateframework/python-tuf` and `go-tuf`, `valhalla/valhalla`,
`sahana/eden`, `maplibre/maplibre-gl-js`, `protomaps/PMTiles`, `project-zot/zot`,
Postgres/PostGIS mirrors. `[VERIFY: TerraNova's own components once the archive is
reconciled.]` Nothing in the plan depends on a closed or paywalled dependency.

---

## 13. Non-technical workstreams (run in parallel, per the memo)

| Workstream | First concrete actions | Coupled to |
|---|---|---|
| Trademark | Clearance search on *Grahm/GrahmOS/ORB* word marks (note: "orb" is a crowded generic term — expect a fight or a qualifier `[INFERENCE]`); file in relevant classes (software; SaaS) `[VERIFY: with counsel]` | Before public spec publication (Epic 1 doc) |
| Patent / prior-art | Prior-art sweep around capability-resolving installers (package managers, k8s operators, Nix, TUF) *before* drafting claims — the field is crowded; the likeliest novel ground is the combination of capability resolution + facility-truth freshness + continuity qualification `[INFERENCE, not legal advice]` | Before Epic 2 design docs are published |
| License inventory | Per-engine SPDX audit as an Epic 3 CI gate. Known copyleft flag: **PostGIS is GPL-2** `[KNOWLEDGE]` — fine to run server-side, but *distributing ORB appliances* means distributing GPL code: written source-offer process required. Sahana Eden `[VERIFY: MIT status]`, Valhalla `[VERIFY: MIT]`, check every TerraNova component. Any AGPL discovery (e.g., some search engines) is a stop-and-decide event | Epic 3; blocks commercial packaging |
| Google-sourced data check | If the archive's "Google Maps Ingestion" means ingesting Google Maps *data*, that is a Terms-of-Service problem independent of code licensing — audit before any pilot `[INFERENCE; VERIFY: archive contents]` | Archive reconciliation |
| Security threat model | STRIDE pass over: bundle pipeline (Epic 1), runtime apply path (Epic 2), break-glass abuse and the offline revocation window (Epic 4) — the documented acceptance window (§4.B) must appear here, not be discovered by a customer | Before first external pilot |
| Upstream contribution policy | Default: patches upstream, forks carry a divergence budget and an owner; contributor CLA position | Epic 3 start |
| Commercial packaging | The Continuity Qualification Report (Epic 5) *is* the sellable artifact — design its human-facing form with a real procurement/insurance reviewer early | Epic 5 |

---

## 14. Risk register (highest severity first)

| # | Risk | Sev | Mitigation (scheduled where) |
|---|---|---|---|
| R1 | **Stale-but-resilient facility data misleads people in an emergency** (memo's core safety argument: offline resilience makes wrong data durable) | Critical | Expiry + `on_expiry: degrade/refuse` are schema-level (Epic 1); routing excludes unverified objects from "verified safe" answers and refuses rather than synthesizes (Epic 4A rule); receipts disclose freshness (11.4); qualification asserts the degradation behavior (Epic 5). Residual risk: humans ignoring degradation banners — a product-design problem, flagged, not solvable in the schema |
| R2 | Signing-key compromise or rollback attack on bundle distribution | Critical | TUF role separation + offline root ceremony + Cosign offline verification (§10.4/Epic 1); rollback protection via monotonic versions in TUF metadata; qualification's stale/unauthorized-pack scenarios (Epic 5) |
| R3 | Offline revocation window abused (credential revoked while site disconnected) | High | Short token `exp`, revocation epochs on every sync, window measured and disclosed (Epic 4B); break-glass dual-control + signed audit |
| R4 | Epic 2 scope creep into "a worse Kubernetes" | High | Driver abstraction + Compose-class first (§2.4); k3s only on concrete ORB-3 demand; the plan's own value statement: the moat is resolver/journal/qualification, not orchestration |
| R5 | TerraNova unknowns invalidate Epic 3 sizing (archive unavailable) | High | Black-box contracts for tiles/search (§3.2); archive reconciliation is the first action item when the zip is provided |
| R6 | GPL/AGPL exposure in appliance distribution discovered late | High | License inventory as Epic 3 CI gate (§13); PostGIS source-offer prepared in advance |
| R7 | Sahana Eden maintenance status forces a fork | Medium | `[VERIFY]` early (§3.7); divergence budget policy ready |
| R8 | Qualification flakiness destroys the product's credibility (a "Grade A" nobody trusts) | Medium | Deterministic scenarios, seeded-defect testing of the harness itself, criteria-referenced grades (Epic 5) |
| R9 | Clock integrity on offline ORBs undermines expiry and token `exp` | Medium | RTC + skew-tolerant comparisons + clock-source disclosure in receipts (§1.7); qualification scenario for clock loss |
| R10 | Indoor positioning over-promise (RTT needs compatible APs *and* phones; no iOS RTT) | Medium | Multi-provider contract with mandatory manual fallback and confidence display (11.1); never demo positioning hardware the pilot site doesn't have |
| R11 | Single-pilot overfit (hospital assumptions baked into schemas) | Medium | Capability grammar and facility model reviewed against a second archetype (school/campus) before v1 freeze `[ASSUMPTION: paper exercise suffices]` |

---

## 15. Open questions (consolidated)

Blocking-if-unanswered (defaults already assumed, §0.4): none — the plan proceeds on
stated assumptions. Materially plan-shaping when answered:

1. Archive contents (§0.2, all five questions) — reshapes Epic 3 and the license/data-ToS
   workstreams.
2. Monolithic vs. base+overlay bundles (§1.8) — spec keeps both open.
3. Orchestration driver (a) vs (c) (§2.4) — one-week spike decides.
4. Identity token format v1 (§4.B) — recommendation given; needs security-owner sign-off.
5. Sahana Eden maintenance status (§3.7) — flips Epic 3 from M to L.
6. Break-glass second factor: second principal vs. physical token (§4.B) — customer
   decision.
7. Field-verification cadence ownership at the pilot (§4.A) — operations decision the
   software can expose but not decide.

**Completion check against the memo's P0 list:** Bundle Spec → Epic 1 (scheduled);
Runtime/Resolver → Epic 2 (scheduled); Offline identity & authority → Epic 4B
(scheduled; schemas front-loaded); Facility Truth → Epic 4A (scheduled; contract
front-loaded into Epic 3); Failure Qualification → Epic 5 (scheduled). No P0 item is
deferred; none can be marked "already satisfied" because the referenced archive is not
available in this environment (§0.2).
