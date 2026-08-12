# GrahmOS Engineering Execution Plan

**Continuity control plane + offline Google Maps-class product**  
**Status:** Plan only (no production implementation in this deliverable)  
**Repo home:** `Greenmamba29/Grahmos_map`  
**Primary existing monorepo to extend:** `Greenmamba29/Grahmos`  
**Date of analysis:** 2026-08-12

---

## Evidence legend

| Label | Meaning |
|-------|---------|
| **[USER]** | Assertion from the architecture memo (treat as product intent, not proven fact) |
| **[VERIFIED]** | Checked against public docs / GitHub in this run |
| **[REPO]** | Observed in cloned `Greenmamba29/*` repositories |
| **[INFERENCE]** | Conclusion drawn from evidence |
| **[ASSUMPTION]** | Default used so the plan can proceed |
| **[VERIFY]** | Must be confirmed before locking a design choice |
| **[UNAVAILABLE]** | Input not accessible in this environment |

---

## Executive summary

Build GrahmOS as the **continuity control plane**, not another mapping engine. The five P0 epics are: (1) formal `.grahm` Bundle + OCI/ORAS packaging, (2) Grahm Runtime + `grahm install`, (3) one hospital/venue bundle co-running Sahana + Valhalla + maps/search (“TerraNova”), (4) Facility Truth + offline identity/authority, (5) Qualification that literally severs WAN. Do **not** adopt another major OSS subsystem now — [USER] and [REPO] both support this: engines are already selected; the control plane is missing.

**[REPO]** Current reality: `Grahmos` is an offline-first emergency PWA + edge search (MapLibre overlays, Meilisearch/SQLite, ZIM/minisign packs, Electron installer). There is **no** `.grahm` schema, no `grahm install` CLI, no Valhalla/Sahana integration, no Facility Truth, no CAP/IndoorGML adapters, and no ORB hardware taxonomy in any searched public repo. **[UNAVAILABLE]** The local archive `Kimi_Agent_Google Maps Ingestion Build.zip` was not on this filesystem (Windows path not mounted).

**Build first:** Epic 1 Bundle schema + OCI media types, because every later epic consumes that contract. Parallel non-tech workstreams (trademark, license inventory, threat model) start on day one. Smallest credible demo: one ORB-class node installs `hospital-demo.grahm`, serves local map + route + search with Answer Receipts while WAN is cut, and prints a Continuity Grade.

**Staffing shape [ASSUMPTION]:** 2–4 engineers + 1 security/identity specialist part-time. First customer vertical: hospital / large-venue emergency continuity [ASSUMPTION from memo framing].

---

## Archive status and gap reconciliation

### Archive access

**[UNAVAILABLE]** Path `c:\Users\suppo\Downloads\Kimi_Agent_Google Maps Ingestion Build.zip` is not readable here. Plan proceeds from the memo + public GitHub clones.

### Questions the archive would answer

1. Is there a working Google Maps / OSM / IFC → tiles / IndoorGML ingestion pipeline, or only design docs?
2. What is **TerraNova** concretely (service name, repo, tile server, search layer)?
3. Does a draft `.grahm` schema or packer already exist?
4. Are ORAS/OCI push scripts or sample artifacts present?
5. Is there a `grahm` / `grahm install` CLI prototype?
6. Facility/floorplan source schema and target format?
7. Valhalla graph-build inputs and costing profiles?
8. Sahana Eden integration mode (embedded vs API vs DB sidecar)?
9. Resgrid coupling scope?
10. Indoor/outdoor routing handoff rules?
11. Tile strategy (PMTiles vs MBTiles vs raster cache)?
12. Demo facility dataset (campus/hospital/stadium) and golden routes?
13. License notes for any Google Maps–derived data?
14. Compose/K8s manifests for the triple-engine bundle?
15. Whether any P0 gap is already partially satisfied offline of GitHub?

### Memo gap list vs public repos

| Memo P0/P1 item | Memo status | Public repo reality [REPO] | Plan disposition |
|-----------------|-------------|----------------------------|------------------|
| Grahm Bundle Spec | Missing | Not found; closest = ZIM + minisign packs + edge update manifest placeholders | **Schedule Epic 1** |
| Grahm Runtime / Resolver | Missing | Electron installer + `docker-compose` + `start-grahmos.sh`; no capability resolver | **Schedule Epic 2** |
| Offline identity & authority | Missing | Edge JWT/mTLS/DPoP present; not offline-verifiable credentials with revocation epoch | **Schedule Epic 4** |
| Facility Truth | Missing | Not found | **Schedule Epic 4** |
| Failure Qualification | Missing | Shell QA scripts; no WAN-cut continuity grade | **Schedule Epic 5** |
| Indoor positioning | Missing | Not found | **Defer P1 after Epic 5** |
| CAP / IndoorGML gateways | Missing | Not found | **Defer P1 after Epic 5** |
| Secure update supply chain | Partial intent | minisign for ZIM; RSA placeholder update manifests; no TUF | **Integrate in Epics 1–2, harden P1** |
| Answer Receipts | Missing | Not found | **Ship with Epic 3 UX, harden P1** |
| ORB hardware profile | Missing | Stadium deployment JSON exists (capacity, not ORB classes) | **Define in Epic 1 `requires`, detail P1** |
| Global Capability Registry | Missing | Not found | **Defer P2** |
| Upstream compatibility automation | Missing | Not found | **Defer P2** |

**[INFERENCE]** Memo’s claim that “engines are selected” is product intent; **integration of Sahana/Valhalla is not present in public code**. Maps/search pieces that can stand in for “TerraNova” today: MapLibre + PMTiles submodule intent + Meilisearch/SQLite in `Grahmos`.

---

## Claim verification (third-party)

| Claim | Result | Source |
|-------|--------|--------|
| OCI artifacts + ORAS for arbitrary types + referrers (sigs, SBOMs, etc.) | **[VERIFIED]** Supported pattern | [ORAS attached artifacts](https://oras.land/docs/concepts/reftypes/), OCI Distribution referrers |
| TUF Root/Targets/Snapshot/Timestamp + rollback defense | **[VERIFIED]** | [TUF metadata docs](https://theupdateframework.io/docs/metadata/), [TUF spec](https://github.com/theupdateframework/specification/blob/HEAD/tuf-spec.md) |
| Sigstore/Cosign offline-verifiable bundles | **[VERIFIED with caveat]** Bundles + local trusted root enable air-gapped verify; trusted root must be refreshed out-of-band | [Cosign README air-gapped verify](https://github.com/sigstore/cosign); [issue #4454](https://github.com/sigstore/cosign/issues/4454) |
| Wi-Fi RTT ~1–2 m multilateration on compatible Android | **[VERIFIED as Android docs claim]** “typically accurate within 1-2 meters” with ≥3 APs; real-world varies | [Android Wi-Fi RTT](https://developer.android.com/develop/connectivity/wifi/wifi-rtt) |
| IndoorGML 2.0 Part 1 published August 2025 | **[VERIFIED with nuance]** Spec publication date **2025-06-26**; OGC announcement **2025-08-28**. Part 2 (GML/SQL/JSON impl schemas) still forthcoming | [OGC docs](https://docs.ogc.org/is/22-045r5/22-045r5.html), [OGC announcement](https://www.ogc.org/announcement/ogc-publishes-indoorgml-2-0-part-1-conceptual-model-standard/) |
| OASIS CAP: geo targeting, multilingual, updates/cancels, instructions/resources | **[VERIFIED]** CAP v1.2 | [OASIS CAP v1.2](https://docs.oasis-open.org/emergency/cap/v1.2/CAP-v1.2.html) |
| NIST ZTA: network location alone must not grant trust | **[VERIFIED]** | [NIST SP 800-207](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-207.pdf) |

---

## Multi-agent delivery model (how we build)

| Role | Model policy | Responsibility |
|------|--------------|----------------|
| Architecture / inventory / planning | Default coding agents (non-review) | Specs, schemas, integration design |
| Implementation agents | Default coding agents | Bundle, runtime, adapters, demos |
| Maps / ingestion agents | Default coding agents | PMTiles/Valhalla graph build, facility model |
| **Code review only** | **Claude Fable 5 / Opus** | PR review, threat review, schema critique — **not** primary implementation |

**[ASSUMPTION]** “Everything open source on GitHub” means product code lives in `Greenmamba29/*` public repos; proprietary moat is **semantics/control plane** (Bundle, Runtime, Facility Truth, Qualification), not secret map engines.

**Repo strategy [ASSUMPTION]:**
- Specs + maps product track: `Grahmos_map` (this repo) and/or `docs/` in `Grahmos`
- Runtime + install: evolve `Grahmos` (do not start a fourth empty shell)
- Retire/ignore empty placeholders: `Grahmos_offline`, `RescueNet`, `grahmos_demo_backend` until filled with real code
- Do **not** treat `lyra3D_Grahmosmaps` (NVIDIA Lyra) or `scion_JamesOfflineRepoGrahmos` (GCP Scion) as GrahmOS maps engines

---

# Epic 1 — Grahm Bundle v1 + OCI/ORAS packaging

### Objective
Formalize `.grahm` as the **unit of deployable continuity**: capabilities, dependencies, hardware requirements, data, services, versions, integrity, rollback, and policies — distributed as OCI artifacts with referrers for signatures, SBOMs, models, maps, and dependency manifests.

### Concrete deliverables
1. `grahm-bundle.schema.json` (JSON Schema draft 2020-12) + normative prose spec (`docs/specs/grahm-bundle-v1.md`)
2. Media type registry: e.g. `application/vnd.grahm.bundle.v1+json` **[VERIFY final IANA/vendor string]**
3. `grahm pack` / `grahm push` / `grahm pull` using ORAS CLI (wrap, don’t reimplement registry protocol)
4. Referrer layout: signature, SBOM (CycloneDX or SPDX), dependency lock, map assets, model weights
5. Example `hospital-demo.grahm` manifest (engines pinned, ORB-1/2 requires, offline policies)
6. Conformance fixtures: valid / invalid / rollback / unsigned / expired

### Interfaces and data contracts (schema sketch)

```yaml
# hospital-demo.grahm  (logical; stored as OCI artifact config + layers)
apiVersion: grahm.io/bundle/v1
kind: Bundle
metadata:
  name: hospital-demo
  version: 0.1.0          # semver; also OCI tag
  revision: 1              # monotonic for Facility Truth coupling later
  created_at: ...
  vendor: grahmos
spec:
  capabilities:            # what this bundle claims to provide
    - id: routing.pedestrian
      engine: valhalla
      api: "[VERIFY: native Valhalla /route vs adapter path]"
    - id: incident.ims
      engine: sahana
    - id: maps.tiles
      engine: terranova     # [ASSUMPTION] maps/search stack alias
    - id: search.local
      engine: meilisearch
  dependencies:
    - capability: storage.sqlite
      version: "[VERIFY: minimum sqlite version]"
    - capability: runtime.grahm
      version: "[VERIFY: runtime semver once tagged]"
  requires:                # ORB profile binding — classes defined below for v1 freeze
    ram_gb: 16
    storage_gb: 80
    accelerator: optional
    uptime_class: ORB-2
    networking: [wifi, ethernet]
  services:                # deployment units
    - name: valhalla
      image: "[VERIFY: pinned digest of chosen Valhalla image]"
      ports: ["[VERIFY]"]
      health: "[VERIFY: Valhalla status endpoint]"
      data_layers: [graphs/hospital]
    - name: sahana
      image: "[VERIFY: pinned digest]"
      depends_on: [postgres]
    - name: terranova-maps
      image: "[VERIFY: pinned digest]"
      data_layers: [tiles/hospital.pmtiles]
  data:
    - id: facility-model
      mediaType: "application/vnd.grahm.facility.v1+json"  # [VERIFY: register vendor type]
      digest: sha256:...
      truth_policy: require_active_revision
    - id: tiles
      mediaType: "application/vnd.pmtiles"  # [VERIFY against PMTiles registry practice]
      digest: sha256:...
  integrity:
    digest: sha256:...     # whole-bundle merkle/root
    sbom_ref: ...
  rollback:
    previous: "[VERIFY: prior demo version or null]"
    allow_downgrade: false
  policies:
    offline_mode: required
    stale_data:
      max_age_hours: 72
      # Life-safety default: FAIL CLOSED (Fable 5 review)
      on_exceed: insufficient_truth
      # Non-life-safety layers may opt into warn_and_degrade explicitly
      life_safety_capabilities: [routing.pedestrian, alerts.safety]
    answer_receipts: required
  trust:
    authority: grahm-root
    # Minimal v1 trust: Grahm authority pubkey set + Cosign bundle referrer.
    # Full TUF role metadata is P1 hardening, not a P0 new subsystem.
    cosign_trusted_root_ref: "[VERIFY: air-gap root refresh mechanism]"
```

### Epic 1 freeze decisions (unblocks kickoff)

| Decision | Frozen choice | Rationale |
|----------|---------------|-----------|
| Packaging form | **(B)** `.grahm` = tar+manifest that expands to OCI layout | USB/sneakernet + ORAS registry parity |
| Root of trust | Dual: Grahm platform keys sign engines; customer keys approve facility truth | Separates software trust from operational truth |
| TerraNova | Codename for MapLibre + PMTiles + local search (Alt A) until zip contradicts | Avoids new major subsystem |
| ORB classes in v1 | ORB-0..ORB-2 required fields only (RAM/storage/net/UPS boolean); ORB-3/X descriptive | Measurable for resolver |
| Update metadata v1 | Cosign signature + monotonic bundle version + `allow_downgrade:false` | TUF full client = P1 |

**OCI layout [INFERENCE — recommended]:**
- Subject artifact = bundle config + service/data layers
- Referrers: Cosign/Sigstore bundle, CycloneDX SBOM, `dependencies.lock.json`, optional model/map digests

### Build vs borrow vs adapt

| Piece | Decision | Rationale |
|-------|----------|-----------|
| Bundle semantics | **OWN** | Core moat [USER] |
| Registry transport | **BORROW** ORAS/OCI | Don’t invent YASS [VERIFIED fit] |
| Signing | **BORROW** Cosign + Grahm-authority keys; plan TUF metadata | Offline verify possible with caveats [VERIFIED] |
| SBOM | **BORROW** CycloneDX or SPDX | Ecosystem tooling |
| Pack format continuity | **ADAPT** existing ZIM/minisign concepts into layers, don’t break current packs overnight | [REPO] `PACK_VERIFICATION_HARDENING.md` |

### Dependencies and ordering
- Unblocks Epics 2–5
- Can start with schema + fixtures before any runtime
- License inventory (non-tech) must classify Sahana/Valhalla/MapLibre/Osmium before public redistribution of example bundles

### Acceptance tests
- Schema rejects missing `capabilities`, `integrity.digest`, or `requires.uptime_class`
- `oras push` / `oras pull` round-trip of example bundle to local registry
- Referrers discoverable via `oras discover`
- Unsigned / wrong-digest fixtures fail verification
- Spec doc alone sufficient for a second team to author a valid bundle

### Failure modes
- Over-specifying v1 (boils ocean) → freeze v1 to installable hospital demo fields only
- Treating OCI as semantics → leak proprietary contracts into registry media types carelessly
- Keyless Sigstore without trusted-root refresh plan → air-gap verify breaks [VERIFIED caveat]
- Bundle grows to multi-GB without layering → failed offline USB/sneakernet installs

### Open questions
- Exact TerraNova identity if archive contradicts Alt A [VERIFY via archive / product owner]
- Customer key ceremony UX for facility approval roots
- Whether `.grahm` tar uses zstd or uncompressed layers for air-gap USB **[ASSUMPTION: zstd]**

---

# Epic 2 — Grahm Runtime + `grahm install`

### Objective
Turn `grahm install hospital.grahm` into: **verify → resolve capabilities → plan deployment → health checks → offline qualification → READY**.

### Concrete deliverables
1. `grahm` CLI (`install`, `status`, `uninstall`, `qualify`, `verify`)
2. Bundle Verifier (digest + signature + TUF-style freshness/rollback checks)
3. Capability Resolver (hardware inventory × software inventory × local state)
4. Deployment Planner (compose/k3s/docker plan from bundle `services`)
5. Health Probe runner + readiness gate
6. Hook to Epic 5 qualification suite (may stub grade in Epic 2)
7. Migration path from Electron installer / `docker-compose.yml` in `Grahmos` [REPO]

### Pipeline (normative)

```
.GRAHM / oci://...
        |
 GRAHM BUNDLE VERIFIER
        |
 CAPABILITY RESOLVER
 +----------+----------+
 Hardware   Software   Existing State + local data
 +----------+----------+
        v
 DEPLOYMENT PLAN
 +----------+----------+
 Sahana   Valhalla   TerraNova/maps/search
 +----------+----------+
        v
 HEALTH CHECKS
        v
 OFFLINE QUALIFICATION (Epic 5; stub OK early)
        v
 READY + Answer Receipt baseline
```

### Interfaces and data contracts

**Resolver input**
```json
{
  "bundle": { "name": "hospital-demo", "version": "0.1.0" },
  "hardware": {
    "ram_gb": 32, "storage_gb_free": 200,
    "uptime_class": "ORB-2",
    "networking": ["wifi", "ethernet"],
    "accelerators": []
  },
  "software": {
    "runtime.grahm": "[VERIFY: installed runtime semver]",
    "container_runtime": "[VERIFY: docker/containerd version policy]",
    "engines_present": []
  },
  "state": {
    "active_bundle": null,
    "facility_revision": null
  }
}
```

**Deployment plan output**
```json
{
  "actions": [
    {"op": "pull", "ref": "oci://.../valhalla@sha256:..."},
    {"op": "load_data", "layer": "graphs/hospital"},
    {"op": "start", "service": "valhalla", "health": "/status"},
    {"op": "start", "service": "sahana"},
    {"op": "start", "service": "terranova-maps"},
    {"op": "migrate", "from": null, "to": "0.1.0"},
    {"op": "qualify", "profile": "continuity-basic"}
  ],
  "rollback": {"target": null}
}
```

**CLI UX (minimum)**
```bash
grahm verify ./hospital-demo.grahm
grahm install oci://registry.example/grahm/hospital-demo:0.1.0
grahm status
grahm qualify --cut-wan
grahm uninstall hospital-demo
```

### Build vs borrow vs adapt

| Piece | Decision | Rationale |
|-------|----------|-----------|
| Resolver + planner semantics | **OWN** | Highest proprietary value [USER] |
| Container runtime | **BORROW** Docker/containerd | Already used [REPO] |
| Crypto verify | **ADAPT** `packages/crypto-verify` + Cosign verify | Evolve beyond NaCl-only |
| Installer UX | **ADAPT** Electron installer later; CLI first | CLI is testable; Electron follows |
| Orchestration file gen | **BORROW** Compose generation | Matches current ops |

### Dependencies and ordering
- Requires Epic 1 schema (can mock schema in week 1)
- Unblocks Epic 3 end-to-end
- Identity (Epic 4) plugs into verifier as “who may install”
- Until Epic 4: install allowed only with local root key on ORB [ASSUMPTION]

### Acceptance tests
- Fresh ORB-class VM: `grahm install` brings services to healthy within defined timeout **[VERIFY: set numeric SLO after first bench]**
- Missing RAM/storage → clear resolver error, no partial silent start
- Corrupt layer digest → abort before start
- Rollback flag restores previous bundle when upgrade health fails
- Idempotent re-install does not duplicate volumes
- `policies.offline_mode=required` + missing local layers → **refuse install** (no silent cloud pull)

### Failure modes
- Partial start leaves inconsistent multi-engine state → transactional install with explicit rollback
- Resolver too greedy (pulls cloud deps) → offline install mode must refuse network if `policies.offline_mode=required` and media missing
- Compose drift from planner → planner owns generated files; hand-edits warned

### Open questions
- Orchestrator target: Docker Compose only vs k3s? **Default [ASSUMPTION]:** Compose for ORB-1/2; k3s optional for ORB-3
- Language for CLI: Go vs Rust vs Node? **Default [ASSUMPTION]:** Go (single static binary for air-gap) unless team Node expertise dominates

---

# Epic 3 — One bundle: Sahana + Valhalla + TerraNova

### Objective
End-to-end proof: **one** `grahm install` yields co-running incident IMS (Sahana), routing (Valhalla), and maps/search (TerraNova alias), offline-capable, with a Google Maps–class UX path for “find / route / show facility context.”

### Concrete deliverables
1. `hospital-demo` (or `venue-demo`) bundle definition consuming Epic 1
2. Compose/services wiring: Sahana Eden + Valhalla + maps tile serve + local search
3. Minimal data pack: outdoor campus OSM extract + 1 indoor floor schematic + sample incidents
4. PWA/client integration in `Grahmos` MapLibre path: search → select → route → overlay
5. Answer Receipts v0 on route/search responses
6. Demo script + screen recording checklist for “WAN cut still works”

### TerraNova naming (decision needed)

| Alternative | Meaning | Trade-off |
|-------------|---------|-----------|
| **A [RECOMMENDED ASSUMPTION]** | TerraNova = Grahm maps/search stack (MapLibre client + PMTiles + Meilisearch/SQLite) | Matches [REPO]; no new major subsystem |
| B | TerraNova = separate unreleased engine in the missing zip | Unknown until archive available |
| C | Rename to avoid unused codename | Clearer externally; loses memo vocabulary |

**Do not** adopt Lyra 3D or Scion as TerraNova [REPO: wrong products].

### Upstream engines (verified licenses)

| Engine | Repo | License |
|--------|------|---------|
| Sahana Eden | https://github.com/sahana/eden | MIT **[VERIFIED]** |
| Valhalla | https://github.com/valhalla/valhalla | MIT **[VERIFIED]** |
| docker-valhalla | https://github.com/nilsnolde/docker-valhalla | MIT **[VERIFIED]** |
| MapLibre GL JS | https://github.com/maplibre/maplibre-gl-js | BSD-3-Clause **[VERIFIED]** |
| PMTiles | https://github.com/protomaps/PMTiles | BSD-3-Clause **[VERIFIED]** |
| Resgrid Core | https://github.com/Resgrid/Core | Apache-2.0 **[VERIFIED]** — **not in Epic 3 critical path** |
| Osmium Tool | https://github.com/osmcode/osmium-tool | GPL-3.0 **[VERIFIED]** — **copyleft exposure if distributed** |

### Interfaces and data contracts

**Route request (Grahm → Valhalla adapter)**
```json
{
  "from": {"facility_ref": "ward-3-nurse-station", "floor": 3},
  "to": {"facility_ref": "exit-stair-b"},
  "costing": "pedestrian",
  "constraints": {"avoid_hazards": true},
  "truth_min_state": "ACTIVE"
}
```

**Route response + Answer Receipt v0**
```json
{
  "route": {
    "distance_m": 28.6,
    "duration_s": 45,
    "geometry": "...",
    "instructions": ["..."]
  },
  "receipt": {
    "answer_class": "verified_local",
    "sources": [
      {"type": "facility_map", "revision": 12, "verified_at": "..."},
      {"type": "routing_engine", "engine": "valhalla", "locus": "local"}
    ],
    "freshness": {"facility_age_hours": 18},
    "confidence": 0.86,
    "degraded": false,
    "user_message": "Nearest safe exit: Stairwell B — 94 ft · Local facility map · Verified 18h ago · Routing engine local"
  }
}
```

**Insufficient truth**
```json
{
  "route": null,
  "receipt": {
    "answer_class": "insufficient_truth",
    "user_message": "No verified safe route available.",
    "reasons": ["exit_A status SUPERSEDED", "no ACTIVE path"]
  }
}
```

### Build vs borrow vs adapt

| Piece | Decision | Rationale |
|-------|----------|-----------|
| Sahana | **BORROW** Eden; thin Grahm adapter | Don’t rewrite IMS |
| Valhalla | **BORROW**; Grahm costing/hazard filter adapter | Standard outdoor/ped routing |
| Maps/search | **ADAPT** `Grahmos` MapLibre + PMTiles + Meilisearch | Existing codepath [REPO] |
| Indoor graph | **OWN** minimal Grahm facility graph for demo; IndoorGML import later | Avoid premature standard lock-in |
| Google Maps ingestion | **Do not** build proprietary Google scrape; use OSM + customer IFC/DXF | Legal/license risk |

### Dependencies and ordering
- Needs Epic 1 manifest + Epic 2 installer (can use hand-compose spike in parallel week 1–2 to de-risk)
- Facility Truth full lifecycle can be stubbed (single ACTIVE revision) until Epic 4
- Unlocks credible demo + Epic 5 scenarios

### Acceptance tests
- With WAN disabled: map tiles load from local PMTiles; Valhalla returns route; Sahana accepts incident create; search returns facility POI
- Answer Receipt always present on route/search
- Bundle declares and meets `requires` on demo hardware class
- Restart recovers all three engines without re-image

### Failure modes
- Sahana operational complexity dominates sprint → scope Eden to **minimal modules only** (orgs, incidents, locations) **[VERIFY module list]**
- Valhalla indoor inadequacy → hybrid: outdoor Valhalla + Grahm indoor graph; document handoff
- Stale demo map shipped as “production” → watermark demo data; tie to Facility Truth ASAP

### Open questions
- First demo venue: hospital vs stadium? **Default [ASSUMPTION]:** synthetic hospital floor + campus OSM (stadium demos already exist in docs; hospital matches memo risk story)
- Postgres for Sahana on ORB-1 storage budget?

---

# Epic 4 — Facility Truth + offline identity/authority

### Objective
Make operational facts **trustworthy under disconnection**: revision, provenance, approval, field validation, expiration, lifecycle — and offline-verifiable credentials for device, user, role, scope, expiry, issuer, revocation epoch, break-glass.

### Concrete deliverables
1. Facility Truth store + API (append-only revisions)
2. Lifecycle state machine: `DRAFT → FIELD_VERIFIED → APPROVED → ACTIVE → SUPERSEDED` (+ `EXPIRED`)
3. Offline credential format + local verifier
4. Revocation epoch distribution (bundle update + sneakernet)
5. Break-glass policy with audit
6. UI surfaces: truth badges on map objects; refuse hallucinated routes

### Interfaces and data contracts

**Facility object**
```yaml
facility:
  id: hospital-a
  revision: 67
  state: ACTIVE
  approved_by: did:grahm:org:facilities_director
  approved_at: ...
  survey_date: ...
  source: [IFC, field_verification]
  expires_at: ...
  confidence: verified
objects:
  exit_A:
    status: open
    verified_at: ...
    verified_by: did:grahm:user:...
    confidence: verified
    geometry_ref: ...
```

**Offline credential (fields required by memo)**
```json
{
  "device_id": "...",
  "user_id": "...",
  "roles": ["responder", "facilities_editor"],
  "scope": {"facilities": ["hospital-a"], "actions": ["route", "validate_field"]},
  "expires_at": "...",
  "issuer": "[VERIFY: issuer URI scheme — did:grahm vs X.509 vs custom]",
  "revocation_epoch": 42,
  "break_glass": {
    "allowed": true,
    "max_ttl_minutes": 240,
    "requires_dual_control": true
  },
  "proof": {"alg": "Ed25519", "sig": "..."}
}
```

**Borrow primitives [ASSUMPTION — choose after spike]:**
- **Alt A:** mdocs / ISO mDL-style offline claims
- **Alt B:** W3C Verifiable Credentials + local DID keys *(major identity stack — only if spike proves offline verify + low ops cost)*
- **Alt C:** Custom CBOR + Ed25519 (fastest to ship; weaker ecosystem)

**P0 default: Alt C** to avoid pulling a major identity subsystem onto the critical path (aligned with “no new major OSS subsystem”). Map to VC (Alt B) in P1 if needed for interoperability.

NIST SP 800-207: network location alone must not grant trust **[VERIFIED]** — LAN presence ≠ authorization.

### Build vs borrow vs adapt

| Piece | Decision | Rationale |
|-------|----------|-----------|
| Truth lifecycle semantics | **OWN** | Core safety moat |
| Crypto / VC libraries | **BORROW** | Don’t invent crypto |
| Edge auth (JWT/mTLS/DPoP) | **ADAPT** as online path only | [REPO] insufficient for offline |
| GPOS audit hash-chain pattern | **ADAPT idea only** from `gpos-by-grahmos` | Different domain; reuse pattern not code blindly |

### Dependencies and ordering
- Needs Epic 1 data types for facility layers
- Needs Epic 3 to attach truth to real routes (can develop in parallel after schema freeze)
- Blocks “production” safety claims; demo may use pinned ACTIVE revision

### Acceptance tests
- Sealed exit marked SUPERSEDED cannot appear as OPEN in ACTIVE route answers
- Expired facility revision on life-safety capability → Answer Receipt `insufficient_truth` (fail-closed; warnings alone are insufficient)
- Offline auth: valid credential works without IdP; revoked epoch rejects; break-glass emits audit record
- Approval without FIELD_VERIFIED blocked by policy (configurable)

### Failure modes
- **Stale-but-resilient data more dangerous than no data** [USER] — highest safety risk; default fail-closed for life-safety routes when truth insufficient
- Clock skew breaks expiry → require ORB trusted time source / last-seen secure time
- Break-glass abuse → dual control + short TTL + post-incident review queue

### Open questions
- Who is root issuer per hospital vs Grahm cloud?
- Maximum offline revocation lag acceptable to customers? **Default [ASSUMPTION]:** epoch bundled daily when online; emergency USB revoke pack supported

---

# Epic 5 — Grahm Qualification

### Objective
Automated, auditable proof that a deployment survives continuity failures by **actually severing connectivity** and exercising negative cases (stale/corrupt/unauthorized packs).

### Concrete deliverables
1. `grahm qualify` test harness (network namespace / iptables / compose network disconnect)
2. Standard scenario pack (below)
3. Machine-readable report + human Continuity Grade card
4. CI job for demo bundle + on-ORB soak script
5. Evidence package suitable for procurement/auditor narrative (not a legal certification)

### Scenario matrix (P0)

| ID | Scenario | Expected |
|----|----------|----------|
| Q1 | WAN OFF | PASS core local services |
| Q2 | Cloud / IdP OFF | PASS with offline credentials |
| Q3 | DNS broken | PASS (no hard DNS deps) |
| Q4 | Edge peer unavailable | PASS single-node mode |
| Q5 | Power restart / cold boot | PASS recovery |
| Q6 | Stale update (rollback attack) | REJECT |
| Q7 | Corrupt pack | REJECT |
| Q8 | Unauthorized pack | REJECT |
| Q9 | Local routing | PASS |
| Q10 | Local search | PASS |
| Q11 | Incident persistence (Sahana) | PASS |
| Q12 | Stale facility truth beyond policy | **FAIL** life-safety route; receipt `insufficient_truth` (not silent PASS; not warn-only) |

### Continuity Grade rubric (v1)

| Grade | Required outcomes |
|-------|-------------------|
| **A** | Q1–Q11 PASS; Q12 FAIL-closed (insufficient_truth enforced); offline install refusal proven |
| **B** | Q1–Q5, Q9–Q11 PASS; Q6–Q8 PASS; Q12 implemented but max_age policy looser than production profile |
| **C** | Core offline map/search/route PASS (Q1,Q9,Q10); integrity rejects (Q6–Q8) PASS; truth policy incomplete |
| **F** | Any of Q6–Q8 fail open (accepts stale/corrupt/unauthorized) **or** life-safety route returned without ACTIVE truth |

**Outcome vocabulary:** `PASS` | `FAIL` | `insufficient_truth` (expected safe refusal). **Do not** use `DEGRADE` for life-safety capabilities in v1.

**Report sketch**
```
GRAHM CONTINUITY QUALIFICATION — Hospital A — Bundle: hospital-demo 0.1.0
WAN independence PASS | map PASS | routing PASS | search PASS |
incident capture PASS | restart PASS | bundle integrity PASS | truth policy PASS
Continuity Grade: A
```

### Build vs borrow vs adapt
- Harness: **OWN** scenarios + grading semantics
- Network cut: **BORROW** OS networking tools / container network disconnect
- Signing negative tests: reuse Epic 1 fixtures

### Dependencies and ordering
- Requires Epics 1–3 for meaningful PASS
- Epic 4 scenarios Q2/Q12 become mandatory for Grade A+

### Acceptance tests
- Running qualify with WAN physically/logically cut produces Grade without online calls
- Flipping to corrupt signature flips integrity to FAIL
- Report hash-chained / signed for audit [ASSUMPTION: Ed25519 report signature]

### Failure modes
- “Simulated offline” that still allows DNS/CDN → false confidence; require packet-level deny
- Flaky timing tests → separate smoke vs soak
- Grade inflation → publish rubric; Grade A requires life-safety truth policy tests

### Open questions
- Is Qualification a separate commercial SKU? [USER suggests yes] — product packaging later; engineering treats it as open report format first

---

# Lower-priority workstreams (P1/P2) — shorter form

## P1 — Indoor positioning (`Grahm Positioning Interface`)

**Objective:** Provide “YOU ARE HERE” without depending on one radio technology.

**Interface:**
```json
{
  "lat": ..., "lon": ..., "floor": 3,
  "confidence": 0.4,
  "source": ["wifi_rtt", "ble", "manual"],
  "manual_override": true
}
```

**Mandatory:** manual location selection + confidence. Wi-Fi RTT claimed ~1–2 m on compatible Android **[VERIFIED as platform claim]** — treat as best-effort, not sole path. Also UWB / BLE / QR-NFC checkpoints / inertial.

**Build/adapt:** ADAPT platform APIs; OWN fusion policy.  
**After:** Epic 3 routing exists.  
**Accept:** Manual pin always works offline; low confidence suppresses turn-by-turn certainty in receipts.

## P1 — CAP gateway

CAP → Grahm Alert Contract → SafetyMap (hazard, instructions, geofence, severity, expiry, multilingual). Reverse for authorized incidents.  
**Borrow** OASIS CAP v1.2 **[VERIFIED]**; don’t invent alert protocol.  
**Accept:** ingest sample CAP, render geofence, expire/cancel correctly offline.

## P1 — IndoorGML interchange

Proprietary emergency graph remains; adapters: IFC/DXF/OSM/IndoorGML → Grahm Facility Model → Emergency Graph.  
**Note:** IndoorGML 2.0 Part 1 is conceptual UML; Part 2 impl schemas forthcoming **[VERIFIED]** — plan adapter against Part 1 concepts + pragmatic GeoJSON interim.  
**Accept:** round-trip lossless for demo topology subset.

## P1 — Secure bundle/update supply chain

**P0 (Epics 1–2):** Cosign/Sigstore bundles + monotonic version + reject downgrade + SBOM referrer (borrow/integrate — not a new product subsystem).  
**P1:** Full TUF-style role separation (Root/Targets/Snapshot/Timestamp) client for freeze/mix-and-match defense.  
**Accept:** rollback/freeze/mix-and-match attacks fail fixtures.

## P1 — Answer Receipts (productization)

Epic 3 ships v0; P1 adds UX polish, localization, auditor export, policy packs per customer.

## P1 — ORB hardware classes

| Class | Shape |
|-------|-------|
| ORB-0 | Single device |
| ORB-1 | Mini PC + SSD + LAN/Wi-Fi |
| ORB-2 | Redundant storage + UPS + dual net |
| ORB-3 | Multi-node mesh + failover |
| ORB-X | Rugged / vehicle / remote |

Bundles declare `requires.uptime_class`. Stadium JSON in `Grahmos` is a precursor, not a substitute [REPO].

## P2 — Global Capability Registry
Index which software/model/device satisfies which capability. Defer until ≥3 bundles exist.

## P2 — Upstream compatibility automation
CI matrix against Sahana/Valhalla/MapLibre releases; pin + canary. Defer until Epic 3 stable.

---

## Dependency graph / sequencing

```
[Non-tech: trademark | license inventory | threat model] ── parallel ──►
        │
        ▼
   Epic 1 Bundle + OCI/ORAS  ─────────────────────────────┐
        │                                                   │
        ▼                                                   │
   Epic 2 Runtime + grahm install                           │
        │                                                   │
        ├──────────────► Epic 3 Triple-engine bundle ◄──────┘
        │                       │
        │                       ├──► Smallest credible demo
        │                       │
        ▼                       ▼
   Epic 4 Facility Truth + offline identity
        │
        ▼
   Epic 5 Qualification (Grade A requires 3+4)
        │
        ▼
   P1: Positioning | CAP | IndoorGML | TUF harden | Receipts UX | ORB spec
        │
        ▼
   P2: Capability Registry | Upstream compat automation
```

**Parallelization notes**
- Week 0–2: Epic 1 schema + Epic 3 hand-compose spike + license inventory
- Epic 4 credential spike can start after Epic 1 trust section freezes
- Fable 5 / Opus review gates: schema freeze, runtime security, truth fail-closed policy

---

## Smallest credible demo

**Title:** “Cut the cable — hospital still routes.”

**Script (≤15 minutes):**
1. ORB-1/2 class machine preloaded with local OCI cache / USB `.grahm`
2. `grahm install hospital-demo.grahm` → Sahana + Valhalla + maps/search healthy
3. Show map + POI search + walk route to exit with Answer Receipt (fresh)
4. Disable WAN (hardware switch or `grahm qualify --cut-wan`)
5. Repeat search/route/incident create — still works
6. Flip facility exit to SUPERSEDED via Field Truth tool — route refuses or degrades with receipt
7. Show Continuity Grade card (even if partial until Epic 5 complete)

**Success criterion:** A non-engineer observer believes “GrahmOS keeps operations working offline” from the demo alone — not from slides.

---

## Non-technical workstreams (parallel)

| Workstream | Why now | Immediate actions |
|------------|---------|-------------------|
| Trademark strategy | Protect Bundle/Runtime/Qualification/Facility Truth/ORB names before spread | Knockout search; filing plan for GRAHMOS + key product terms **[VERIFY counsel]** |
| Patent / prior-art analysis | Resolver + Facility Truth + Qualification may be novel combinations | Prior-art search on offline facility truth + continuity grading **[VERIFY counsel]** |
| License inventory | Osmium GPL-3, various BSD/MIT/Apache; SmartDirectory marked proprietary | Produce SPDX inventory per engine; decide GPL isolation (build-time only vs ship) |
| Security threat model | Install + stale maps + offline auth are high-impact | STRIDE on install path, truth, credentials; review by Opus/Fable |
| Upstream contribution policy | Sahana/Valhalla/MapLibre will diverge | CLA/DCO stance; patch-fork vs contribute-first rules |
| Commercial packaging | Qualification + ORB SKUs | Define Community (engines) vs Platform (control plane) vs Continuity Grade add-on |

---

## Risk register (highest severity first)

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| R1 | **Stale-but-resilient facility data causes harm** (sealed exit still routed) | **Critical** | Facility Truth fail-closed; Answer Receipts; Qualification Q12; never auto-promote DRAFT |
| R2 | Bundle supply chain compromise (“one-touch” becomes one-touch malware) | Critical | Cosign + TUF roles; install requires authority; Qualification Q6–Q8 |
| R3 | Offline identity gap → LAN-trusted responders | High | Epic 4 credentials; NIST ZTA alignment; break-glass audited |
| R4 | Scope creep into new major OSS engines | High | Freeze engine set; TerraNova = adapt existing maps/search |
| R5 | Fragmented repos / empty shells / naming drift (PRISM vs GrahmOS) | Medium | Single runtime home in `Grahmos`; specs in `Grahmos_map`; archive empty repos |
| R6 | IndoorGML Part 2 not ready; over-invest in UML-only standard | Medium | Interim GeoJSON facility model; IndoorGML as interchange target |
| R7 | Sigstore trusted-root staleness in air-gap | Medium | Bundle Grahm trust root updates; document refresh SLA |
| R8 | GPL toolchain (Osmium) copyleft contagion | Medium | Isolate GPL tools to build hosts; ship only MIT/BSD runtime artifacts |
| R9 | Sahana operational weight sinks Epic 3 | Medium | Minimal module slice; feature flags |
| R10 | Demo false confidence (CDN tiles still leak in) | Medium | Qualify with packet deny; PMTiles local-only |

---

## Staffing / effort shape (non-calendar)

| Epic | Shape | Skills |
|------|-------|--------|
| 1 | Spec-heavy, small code (schema, ORAS scripts, fixtures) | Systems + supply chain |
| 2 | Medium systems engineering | Go/Rust CLI, containers, crypto integration |
| 3 | Integration-heavy | Maps, Valhalla ops, Sahana ops, PWA |
| 4 | Design-heavy security | Identity, policy, UX for truth |
| 5 | Test infra | Networking, chaos, compliance UX |

**[ASSUMPTION]** One tech lead owns Bundle/Runtime contracts end-to-end to prevent semantic drift across agents.

---

## P0 disposition checklist (completion criterion)

| P0 item | Disposition |
|---------|-------------|
| Grahm Bundle Specification | **Scheduled — Epic 1** |
| Grahm Runtime / Resolver | **Scheduled — Epic 2** |
| Offline identity & authority | **Scheduled — Epic 4** |
| Facility Truth System | **Scheduled — Epic 4** |
| Failure Qualification | **Scheduled — Epic 5** |
| Archive-satisfied gaps | **None proven** — archive **[UNAVAILABLE]**; public repos do not moot any P0 |

---

## Open questions (global)

1. Confirm TerraNova definition with product owner / provide the Kimi zip. **[VERIFY]**
2. Confirm first paying vertical (hospital vs stadium vs industrial ORB). **[ASSUMPTION: hospital]**
3. Confirm ORB hardware already procured. **[ASSUMPTION: commodity ORB-1/2]**
4. Confirm public vs private split for Runtime source. **[ASSUMPTION: open repos, proprietary specs optional]**
5. Root of trust operator model (Grahm vs customer). **[ASSUMPTION: dual]**

---

## Immediate next actions for an engineering lead (Epic 1 kickoff)

1. Create `docs/specs/grahm-bundle-v1.md` + JSON Schema from the sketch above; freeze field list for hospital-demo only.
2. Stand up local OCI registry; `oras push` a stub bundle with one data layer + Cosign signature referrer.
3. Write 10 conformance fixtures (valid/invalid).
4. SPDX license matrix for Sahana, Valhalla, MapLibre, PMTiles, Osmium, Meilisearch, any ZIM tooling.
5. Book Fable 5 / Opus review on schema + trust section before Epic 2 coding starts.
6. Spike hand-compose of Valhalla + MapLibre PMTiles + Meilisearch (TerraNova-A) to de-risk Epic 3 — **without** adopting new major subsystems.

---

## Appendix A — Public repo inventory (summary)

| Repo | Role | Use in plan |
|------|------|-------------|
| `Grahmos` | Main monorepo (PWA, edge-api, packs, installer) | **Runtime home / Epic 2–3** |
| `Grahmos_map` | Offline maps track (currently stub) | **Specs + maps plan home** |
| `grahmos-docs` / `grahmos-interactive-demo` | Static Leaflet demos | UX reference only |
| `Grahmos_Company` | Org/agents meta | Non-product |
| `GrahmOS_SmartDirectory` | B2B directory | Out of scope for continuity maps |
| `gpos-by-grahmos` | Procurement governance demo | Audit-pattern inspiration only |
| `Grahmos_offline`, `RescueNet`, `grahmos_demo_backend` | Empty | Do not schedule work into voids |
| `lyra3D_Grahmosmaps`, `scion_JamesOfflineRepoGrahmos` | Unrelated forks | Exclude from maps stack |

---

## Appendix B — Review adjustments (Fable 5)

Incorporated before publish:
1. Life-safety stale policy default → `insufficient_truth` (fail-closed)
2. Epic 1 freeze table (packaging, trust, TerraNova, ORB, update metadata)
3. Invented API/media-type/version pins marked `[VERIFY]`
4. Identity P0 = custom CBOR+Ed25519; VC/DID deferred
5. Continuity Grade A–F rubric + outcome vocabulary

## Appendix C — Clarifying question (single)

**What is TerraNova in your current architecture — a codename for the existing MapLibre/PMTiles/Meilisearch stack, or a separate codebase (possibly inside the Kimi zip)?**  
Until answered, this plan assumes **codename for the existing maps/search stack (Alternative A)** so Epic 3 does not invent a new major subsystem.
