# GrahmOS Open-Source Dependency Registry

**Purpose:** the license inventory and upstream-health record for every open-source component named in the execution plan, satisfying constraint **C2** in [`../agents/AGENTS.md`](../agents/AGENTS.md).

**Method:** every license below was read from the repository's own license file via the GitHub API, not inferred from a badge, a package-registry field, or memory. GitHub's own classifier returns `NOASSERTION` for several of these, which is precisely why they were read directly.

**Verified:** 2026-08-12.

---

## 1. Capability engines

| Component | Repository | License (read from file) | Role | Health signal |
|---|---|---|---|---|
| **Valhalla** | `valhalla/valhalla` | **MIT** — `COPYING`: *"The MIT License (MIT) … Copyright (c) 2018 Valhalla contributors"* | `cap:routing.pedestrian@1`, `.indoor@1`, `cap:routing.vehicle@1` | Active; ~6.1k stars; commits within days of verification |
| **Sahana Eden** | `sahana/eden` | **MIT** — `LICENSE`: *"This software is distributed under the MIT License … Copyright: 2009-2025 Sahana Software Foundation"* | `cap:incident.registry@1` | Active; v6.1 tagged 2026-01-13 including Python 3.13 fixes. Note `sahana/eden-legacy` is the older, larger-starred repository — **verify which one is intended** |
| **PMTiles** | `protomaps/PMTiles` | **BSD-3-Clause for reference implementations**; `LICENSE` states *"The PMTiles specification itself is public domain, or CC0 where applicable"* | `cap:map.tiles.vector@1` dataset format | Active; ~3k stars |
| **MapLibre GL JS** | `maplibre/maplibre-gl-js` | **BSD-3-Clause style** — `LICENSE.txt`: *"Copyright (c) 2023, MapLibre contributors … Redistribution and use in source and binary forms…"* | Map client | Active; ~11.3k stars |
| **TerraNova** | **Not found** | — | `[VERIFY]` | **No public repository by this name was findable.** See assumption A1 in the execution plan |

## 2. Supply-chain and packaging tooling

| Component | Repository | License | Role |
|---|---|---|---|
| **ORAS** | `oras-project/oras` | **Apache-2.0** | OCI artifact push/pull; `oci-layout` production |
| **Cosign** | `sigstore/cosign` | **Apache-2.0** | Keyed signing and offline verification (keyless mode rejected — see spec rule B-703) |
| **go-tuf** | `theupdateframework/go-tuf` | **Apache-2.0** | Freshness and anti-rollback metadata |
| **zot** | `project-zot/zot` | **Apache-2.0** | OCI-native local registry, small enough to run on an ORB |

## 3. Transitive components requiring attention

| Component | Repository | License | Why it matters |
|---|---|---|---|
| **web2py** | `web2py/web2py` | **LGPLv3** — `LICENSE.web2py.txt`: *"Web2py is Licensed under the LGPL license version 3"* | **The only real copyleft exposure found.** Sahana Eden runs on web2py, so choosing Eden brings LGPLv3 into the bundle |

### 3.1 The web2py exposure, assessed

This is the one finding in this registry that should change a decision.

The license text itself is unusually explicit about the redistribution case: *"In accordance with LGPL you may: redistribute web2py with your apps (including official web2py binary versions); release your applications which use official web2py libraries under any license you wish."*

**Assessment:** the exposure is manageable but real, and its manageability depends on *how* Eden ships.

| Approach | Exposure |
|---|---|
| Eden as a **black-box service** in its own container, unmodified (execution plan option 3-A) | Clean. Mere aggregation and unmodified redistribution; GrahmOS code is not a derivative work |
| Eden **forked or patched**, or web2py itself modified | Obligations attach to the modified library — source availability for those modifications |
| web2py **statically linked** into GrahmOS code | Not applicable in practice for a Python web framework, but named for completeness |

**This reinforces option 3-A in the execution plan** on licensing grounds as well as integration grounds: keep Eden behind an adapter, never fork it. It also raises the value of holding option 3-B (a thin incident store) in reserve — a bundle that carries no LGPL component is simpler to reason about in procurement.

*This is an engineering-side license assessment for planning purposes, not legal advice. Counsel should review before any distribution commitment.*

## 4. Standards referenced (not code dependencies)

| Standard | Version / status | Verified detail |
|---|---|---|
| **OCI Image Spec / Distribution Spec** | v1.1, released 2024-03-13 | `artifactType` and `subject` are top-level manifest fields; referrers API `GET /v2/<repo>/referrers/<digest>`; referrers tag-schema fallback is normative for registries lacking support |
| **TUF** | Current specification | Root / Targets / Snapshot / Timestamp role separation; online keys restricted to low-trust roles; explicit rollback and freeze-attack defences |
| **CAP** | **v1.2**, OASIS Standard approved 2010-07-01; also ITU-T X.1303 bis | Geographic targeting via polygon/circle/geocode on WGS 84; multilingual `info` blocks; `msgType` Update/Cancel with `references` |
| **OGC IndoorGML** | **2.0 Part 1**, publication date 2025-06-26, OGC announcement 2025-08-28 | **Part 1 is a UML conceptual model only. Part 2 (GML/JSON/SQL encodings) is still in progress.** There is no stable normative encoding to conformance-test an export against today |
| **NIST SP 800-207** | August 2020 | Tenet 2: *"Network location alone does not imply trust."* |
| **Android Wi-Fi RTT** | Current documentation | *"If you measure the distance to three or more access points, you can use a multilateration algorithm… The result is typically accurate within 1-2 meters."* Requires `is80211mcResponder()` / `is80211azNtbResponder()` APs; **one-sided RTT "can add hundreds of meters to the estimate"** |
| **Sigstore / Cosign offline** | Current documentation | Offline bundle verification is supported, but keyless verification requires a locally provisioned `trusted_root.json` whose *"contents will change without notification"* and for which the operator must build their own air-gapped refresh mechanism |
| **RFC 8785** | JSON Canonicalization Scheme | Basis for digest stability (spec rule B-701) |

### 4.1 Two standards findings that changed the plan

- **IndoorGML is demoted.** Without Part 2, "export IndoorGML" cannot be conformance-tested. The plan aligns the internal facility model's *concepts* to Part 1's UML so a future encoder is serialisation work, and prioritises *import* (IFC / DXF / OSM / IMDF) where real floorplans actually live. Track [`opengeospatial/IndoorGML-SWG`](https://github.com/opengeospatial/IndoorGML-SWG) for Part 2.
- **Sigstore keyless is rejected.** A trust anchor that silently goes stale in an air-gapped hospital defeats the product's entire premise. Keyed mode with an in-band, expiry-bearing trust anchor is the conformant path.

---

## 5. Adding a dependency

Per constraint **C2**, an addition requires all of the following in the same change:

1. Public GitHub repository URL
2. License **read from the repository's license file** and quoted — not inferred
3. Maintenance signal (latest release or commit recency)
4. The `cap:` capability it serves, or the build stage it belongs to
5. Whether it ships inside a bundle (which is what triggers the license analysis) or is build-time only

Blocked, not assumed, if the license cannot be verified.
