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
| **MapLibre GL JS** | `maplibre/maplibre-gl-js` | `LICENSE.txt` opens *"Copyright (c) 2023, MapLibre contributors … Redistribution and use in source and binary forms, with or without modification…"* — three-clause BSD form. **`[VERIFY: read the full clause list and record the SPDX identifier; "BSD-3-Clause style" is a hedge and C2 does not permit hedges.]`** | Map client | Active; ~11.3k stars |
| **TerraNova** | **Not found** | — | `[VERIFY]` | **No public repository by this name was findable.** See assumption A1 in the execution plan |

## 2. Supply-chain and packaging tooling

| Component | Repository | License | Role |
|---|---|---|---|
| **ORAS** | `oras-project/oras` | **Apache-2.0** | OCI artifact push/pull; `oci-layout` production |
| **Cosign** | `sigstore/cosign` | **Apache-2.0** | Keyed signing and offline verification (keyless mode rejected — see spec rule B-703) |
| **go-tuf** | `theupdateframework/go-tuf` | **Apache-2.0** | Freshness and anti-rollback metadata |
| **zot** | `project-zot/zot` | **Apache-2.0** | OCI-native local registry, small enough to run on an ORB |

## 3. Copyleft and share-alike exposure

**Correction to an earlier version of this registry.** It stated that web2py's LGPLv3 was "the only real copyleft exposure found." That was wrong by omission: the licence that most directly binds the shipped product — **ODbL on OpenStreetMap data** — was not in the inventory at all. There are two exposures, and the data one is larger.

| # | Component | Licence | Attaches to |
|---|---|---|---|
| 1 | **OpenStreetMap data** (via `planet.osm` / regional extracts) | **ODbL 1.0** | Every dataset derived from it: Valhalla routing tiles, PMTiles basemaps, search indexes |
| 2 | **web2py** — `web2py/web2py` | **LGPLv3** — `LICENSE.web2py.txt`: *"Web2py is Licensed under the LGPL license version 3"* | The Sahana Eden runtime, if Eden is selected |

### 3.1 The ODbL exposure — the one that binds the product you sell

OpenStreetMap data is licensed under the **Open Database License 1.0**, an attribution *and* share-alike licence written specifically for databases. The OSM Foundation states the obligations directly:

> *"Where you make our data or any Derivative Database available to others, it must continue to be licensed under the ODbL. This is often referred to as Share-Alike. If you create a Produced Work, you can apply whatever terms you like to the Produced Work, but you must upon request offer recipients either a copy of your data and any Derivative Databases under the terms of the ODbL or the means of creating the Derivative Databases upon request. You must attribute the use of our data in both of the above cases."*
> — [OSMF Licence and Legal FAQ](https://osmfoundation.org/wiki/Licence_and_Legal_FAQ)

ODbL §4.4 further provides that *"Extraction or Re-utilisation of the whole or a Substantial part of the Contents into a new database is a Derivative Database and must comply with Section 4.4."* ([ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/))

**Why this is load-bearing for GrahmOS specifically:**

| Artefact | Likely ODbL character | Consequence |
|---|---|---|
| Rendered map imagery in the UI | **Produced Work** | Attribution required; your cartography and other layers stay under your own terms |
| PMTiles basemap containing OSM features | Arguably a **Derivative Database**, not merely a produced work | Share-alike likely triggered on the tile data |
| **Valhalla routing tiles** | **Derivative Database** — a substantial extraction restructured into a new database | Share-alike; recipients may request the data or the means to recreate it |
| Search index over OSM place names | **Derivative Database** | Same |

The product ships all of these inside a signed, commercially distributed bundle. The obligations are attribution and, on request, provision of the derivative database under ODbL — **not** a requirement to open-source GrahmOS itself. But it is a live obligation on the artefact, and it lands in two places engineering owns: `provenance.source_license` on every dataset (spec rule B-404) and the attribution surface in the rendering contract.

Note also that ODbL is a *database* licence, so the analysis differs from software copyleft in kind, not just degree. Counsel should determine which artefacts are Produced Works and which are Derivative Databases before any distribution commitment; the table above is an engineering-side reading to scope the question, not an answer to it.

**If OSM is unacceptable**, the alternatives are commercial map data (cost, and usually offline-hostile terms), authority-supplied data (a hospital's own IFC/CAD, which is the better source indoors anyway), or a mixed model. This should be decided before the tile pipeline is built, not after.

### 3.2 The web2py exposure, assessed

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

### 3.3 Inventory completeness — what is still missing

This registry covers the components **named in the execution plan**. Constraint C2 says "no exceptions for transitive-only additions that end up in a bundle," and by that standard the inventory is **incomplete**. Not yet recorded:

| Component | Why it will end up in a bundle |
|---|---|
| Meilisearch | Search backend already wired in `apps/edge-api` |
| SQLite | FTS backend; also the likely Facility Truth store |
| Tile-build tooling (tippecanoe or equivalent) | Dataset pipeline, build-time |
| nginx | Reverse proxy in every compose file |
| Workbox | Service worker in the PWA |
| Sahana Eden's full Python dependency tree | Ships inside the Eden container |
| Base container images | Every component |

**Do not treat the current inventory as a clearance.** Completing it is a scheduled task, not a formality: the SBOM requirement in Epic 1 exists precisely so this list is generated rather than hand-maintained, and the hand-maintained version has already been shown to miss the most important entry.

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
| **RFC 8785** | JSON Canonicalization Scheme | Basis for digest stability (B-701). §3.2.2.1: *"JCS-compliant string processing does not take [Unicode Normalization] into consideration… all components involved in a scheme depending on JCS MUST preserve Unicode string data 'as is'."* |
| **ODbL** | 1.0, Open Data Commons | Attribution + share-alike database licence governing OpenStreetMap data; see §3.1 |

### 4.1 Three standards findings that changed the plan

- **RFC 8785 forbids Unicode normalisation.** An earlier draft of the bundle spec required NFC and NFD forms of a string to produce the *same* digest. No conformant JCS implementation can do that, and implementing it would mean a normalisation pass that disagrees with every JCS library — which is the digest-instability failure the rule exists to prevent. Corrected to require *different* digests, with a linter warning on non-NFC input.

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
