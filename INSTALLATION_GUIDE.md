# GrahmOS Maps: installation, architecture and protocols

## 1. Install and run

```bash
npm install
npm run dev         # development server
npm test            # vitest (core engines + UI)
npm run lint && npm run typecheck
npm run build       # production PWA → dist/
npm run preview     # serve dist/ locally (service worker active)
```

Docker:

```bash
docker compose up --build   # http://127.0.0.1:8080
```

No environment variables, API keys or backend are required. The build is a
static site. Any HTTPS static host works (HTTPS is required for service workers
and Web Bluetooth).

### Native apps (Android and iOS)

```bash
npm run cap:android   # build, sync, open Android Studio (run on a phone with Bluetooth)
npm run cap:ios       # build, sync, open Xcode (Mac only; set your signing team)
```

Bluetooth permissions are already declared (`android/app/src/main/AndroidManifest.xml`,
`ios/App/App/Info.plist`). Bluetooth doesn't work in the iOS simulator or the Android emulator; use a
real device. CI (`.github/workflows/native.yml`) builds a debug APK on every push and the iOS app on
manual dispatch.

### Offline check

1. Load the app once while online, and wait for "App installed for offline use"
   in the **Offline** tab.
2. Turn on airplane mode and reload. Map, search, directions, positioning and
   the mesh between tabs keep working.

## 2. Product surfaces

| Surface | What it shows |
| --- | --- |
| **Explore** | Full-screen floor plan, search bar, quick "find nearest" chips (Exits, Restrooms, Medical, Food, Water, Elevators), floor picker, locate / nearest-exit / directions buttons, and a status badge. |
| **Place sheet** | Name, category and level, plus any active hazards inside the place. Actions: Directions, I'm here (manual position), Report. |
| **Directions** | Origin (your location or any place) and destination, swap, step-free toggle, ETA, distance and floors, turn-by-turn steps (tap a step to focus it), and a "Simulate walk" demo that drives the BLE positioning pipeline. |
| **Mesh** | One-tap SOS, closure, hazard and note reports; the link list with status; "Connect relay node"; "Share map"; shared reports with resolve; nearby people; broadcast messages; editable callsign. |
| **Offline** | Offline readiness, connectivity, storage use with eviction protection, the venue library (switch or delete), and venue package import/export. |

## 3. Venue package schema (`grahmos.venue/1`)

Local metric coordinates: metres, with x growing east and y growing south. The
optional `anchor` places the venue on Earth for GPS handoff.

```jsonc
{
  "schema": "grahmos.venue/1",
  "id": "my-venue",                 // [a-z0-9-_.]
  "name": "My Venue",
  "version": 3,                     // newer versions replace older ones over the mesh
  "updatedAt": "2026-11-01T00:00:00Z",
  "anchor": { "lng": -122.4, "lat": 37.7, "bearing": 0 },
  "levels":   [{ "id": "L1", "name": "Ground", "shortName": "1", "ordinal": 0, "outline": [[0,0],[80,0],[80,50],[0,50]] }],
  "spaces":   [{ "id": "cafe", "levelId": "L1", "name": "Cafe", "category": "food",
                 "polygon": [[0,28],[16,28],[16,50],[0,50]], "entranceNodeId": "cafe:node", "keywords": ["coffee"] }],
  "amenities":[{ "id": "aed-1", "levelId": "L1", "name": "AED", "category": "aed", "position": [37,23], "nodeId": "c39" }],
  "nodes":    [{ "id": "cafe:node", "levelId": "L1", "position": [8,39], "kind": "room" }],
  "edges":    [{ "from": "cafe:node", "to": "c8", "kind": "walk" },
               { "from": "lift-L1", "to": "lift-L2", "kind": "elevator", "seconds": 35 }],
  "beacons":  [{ "id": "b1", "levelId": "L1", "position": [6,25], "txPower": -59,
                 "ibeacon": { "uuid": "f7826da6-…", "major": 1, "minor": 1 } }]
}
```

- Space categories: `room corridor lobby restroom elevator stairs food medical retail office conference utility security shelter`.
- Amenity categories: `exit aed first-aid fire-extinguisher information water charging assembly`.
- Walk edges cost `length / 1.3 m/s`. Vertical edges need an explicit `seconds`. `stairs` edges are skipped in step-free mode.
- Packages are validated (`parseVenue`) before they are stored, whether they come from a file or a peer.
- The schema follows the venue → level → unit/amenity/opening structure of the
  open Indoor Mapping Data Format (IMDF), so converting IMDF or OSM Simple Indoor
  Tagging exports is a straightforward mapping step.

### Importing IMDF venues

The Offline panel accepts IMDF archives (`.zip` of GeoJSON layers, OGC 20-094) as well as GrahmOS
packages. `src/indoor/imdf.ts`:
- projects WGS84 to local metres;
- maps unit and amenity categories, skipping open-to-below and non-public units;
- generates the walking graph IMDF lacks: a node per unit and per door, walkway links that stay inside the
  walkway, stairs and elevators linked across adjacent levels, and footprint doors as exits.

The result goes through the same `parseVenue` validation as any package.

## 4. Positioning pipeline

1. **Scan.** Advertisements come from `WebBluetoothBeaconScanner`, a native
   shell, or `SimulatedBeaconScanner`, and are resolved to venue beacons by
   iBeacon UUID/major/minor or Eddystone namespace/instance.
2. **Filter.** Keep a 2.5 s sliding window and take the median RSSI per beacon,
   which rejects multipath spikes.
3. **Floor.** The level with the strongest top-3 summed signal wins. It must win
   twice in a row (hysteresis) to switch floors.
4. **Range.** Distance = `10^((txPower − rssi) / (10·n))`, with `n = 2.2` by
   default.
5. **Solve.** Gauss-Newton weighted least squares (weights 1/d²) with
   Levenberg damping, seeded at the weighted centroid. One or two beacons
   degrade to the centroid.
6. **Smooth.** A Kalman filter whose measurement variance comes from the solver
   residual. The reported accuracy circle is √variance.

Tests show under 5 m error with 3 dB noise in the demo venue, and correct floor
switching.

### Step tracking (pedestrian dead reckoning)

`src/positioning/pdr.ts` detects steps from accelerometer peaks, with a refractory period and Weinberg
step length. Heading comes from the operating system's fused orientation (iOS `webkitCompassHeading`,
Android absolute orientation). Each step is a Kalman prediction in `PositioningEngine.applyStep()`, which
BLE fixes then correct. In a simulated beacon dead zone (two beacons for an 80 m corridor), mean error falls
from 18.2 m with BLE only to 11.7 m with BLE plus steps.

### Fingerprinting (anyplace algorithms)

`src/positioning/fingerprint.ts` ports anyplace's KNN, weighted KNN, MAP and MMSE radio-map positioning.
`locateCompat` reproduces upstream exactly (81 golden cases from the unmodified Java). `locateFingerprint`
is the GrahmOS layer:
- BSSIDs matched case-insensitively;
- the strongest reading kept for repeated BSSIDs;
- configurable K and sigma;
- ties broken by key, not hash order;
- MMSE computed in log space so long fingerprints don't underflow.

It works with Wi-Fi scans (Android native) or BLE beacon RSSI vectors.

## 5. Mesh protocol (v1)

### Envelope

Every frame is a UTF-8 JSON envelope:

```json
{ "v": 1, "id": "9f2c…", "origin": "a1b2c3d4e5f6", "ttl": 6, "hops": 0,
  "hlc": "0lz8k2m1c0:0000:a1b2c3d4e5f6", "body": { "kind": "ops", "entries": [ … ] },
  "pub": "<64 hex: Ed25519 public key>", "sig": "<128 hex: Ed25519 signature>" }
```

### Signatures and identity

- Each device (each browser tab, or the native app) has an Ed25519 key. Its peer id, `origin`, is the
  first 12 hex characters of SHA-256(public key), so an origin can't be claimed without the key.
- `sig` covers the canonical JSON (keys sorted at every depth) of `{v, id, origin, hlc, body, pub}`.
  `ttl` and `hops` are left out because relays change them.
- Receivers check `origin == peerId(pub)` and the signature before anything else. A forged frame is
  dropped **without** marking its id as seen, so it can't shadow the genuine message.
- CRDT entries (`ops`) are signed separately by whoever wrote that version:
  `{key, value, hlc, pub, sig}` over `{key, value, hlc}`. The HLC's node must equal the signer's peer
  id. The signer must be the annotation's `author`, unless the entry only sets `resolved: true`: any
  responder may clear a hazard, but nobody can create or edit one in someone else's name. Because
  entries carry their author's signature, anti-entropy can relay them through any peer.
- Venue packages over the mesh: a new venue id is installed; an update is accepted only from the peer
  who first shared it; the built-in venue and file imports can't be replaced from the mesh.
- Not covered yet: revoking a stolen key, and replay of old presence after the 10-minute dedupe window
  (CRDT merges are idempotent, so replayed reports change nothing).

| `body.kind` | Purpose | Default TTL |
| --- | --- | --- |
| `hello` | Name and venue. Also a 15 s heartbeat. Newcomers get a hello back. | 0 |
| `digest` | Salted GCS filter of held entry versions (`{p, m, data, salt, count}`). The receiver sends what isn't in it and answers once with its own. | 0 |
| `ops` | Signed last-writer-wins CRDT entries `{key, value: Annotation, hlc, pub, sig}` | 6 |
| `rtc` | WebRTC offer, answer or candidate addressed to one peer (`to`) | 3 |
| `presence` | Live position, level and accuracy (expires after 90 s) | 3 |
| `text` | Broadcast message (≤ 500 chars) | 6 |
| `venue` | Whole venue package | 2 |

Relay rules: drop frames whose `id` has been seen or whose `origin` is self, and frames whose
signature doesn't verify. Reject HLCs more than 24 h ahead. Otherwise handle the frame and, if `ttl > 0`,
forward it with `ttl − 1, hops + 1` on every link except the one it came in on.

### Bluetooth framing (bitchat packets)

Over Bluetooth (phone ↔ phone and phone ↔ relay), each envelope travels inside a **bitchat BinaryProtocol
packet** of private type `0x40`. The codec is ported from bitchat and proven byte for byte against the
unmodified Swift code (see section 7):

- 14-byte v1 header (version, type, TTL, timestamp, flags, length) + 8-byte link id + payload.
- Payloads of 100 bytes or more are raw-DEFLATE compressed when that helps. JSON envelopes shrink 3–5×.
- Packets larger than the link budget are split into bitchat **fragment** packets (type `0x20`):
  8-byte id | u16 index | u16 total | original type | data. They are reassembled in any order, with
  per-type size caps and expiry.
- The link budget is 180 bytes in the browser, and the negotiated MTU − 3 in the native apps (long writes
  below 99 bytes). Signatures add about 200 bytes per envelope before compression.
- Envelopes are capped at 128 KiB uncompressed, which covers venue maps of several hundred rooms.

### Anti-entropy with GCS filters

`digest` messages carry a Golomb-coded set (bitchat's `GCSFilter`, ported and proven): 400 bytes at a
1% false-positive rate, about P+2 bits per entry instead of the full key-to-HLC map. The receiver sends
every entry whose salted id is not in the filter and answers once with its own filter. GrahmOS salts the
ids with a random value per digest (bitchat doesn't), so a false positive can't hide the same entry round
after round.

### Links

| Link | Where | Notes |
| --- | --- | --- |
| Tabs (BroadcastChannel) | every browser | Zero setup; demos and kiosks. |
| Phone ↔ phone Bluetooth | native apps | `plugins/grahmos-ble-mesh`: each phone advertises a GATT service (`6c1a4e8e-…-9e01`, one write + notify characteristic) and connects to up to 7 others, both roles at once, after bitchat's design. No hardware needed. |
| Phone ↔ relay (Nordic UART) | Chrome/Edge, native apps | ESP32 relay firmware in `firmware/esp32-relay`. |
| Relay ↔ relay ESP-NOW | relays | About 200 m line of sight, no Wi-Fi network; packets flooded once per relay. |
| Direct WebRTC | browsers and apps on the same LAN | Signalling (offer and answer) rides the mesh as signed `rtc` messages. Then a fast data channel carries big payloads. Lower peer id initiates. `RtcPeer` is our port of simple-peer's behaviour, in 7.5 KB versus 99 KB. |

### Open-source building blocks

The mesh is designed to plug into these open projects:

- **bitchat** (Unlicense). Wire format, fragmentation and GCS sync, ported and proven (section 7).
- **MeshCore** (MIT). LoRa mesh firmware for ESP32/nRF52, used as a long-range
  backbone between relays. (Meshtastic is GPL-3.0, so it is only supported as a
  separate radio people already own, never as code in this app.)
- **Nordic UART Service / Zephyr / ESP-IDF NimBLE.** Relay firmware base.
- **Bitchat-style BLE store-and-forward.** Phone-to-phone over BLE in a native
  shell, using the same envelope and chunk format.
- **IMDF / OpenStreetMap Simple Indoor Tagging.** Venue data sources.

## 6. Storage

The IndexedDB database `grahmos-indoor` has these stores:

- `venues`: venue packages.
- `annotations`: CRDT entries, persisted 400 ms after each change.
- `settings`: the active venue.

The callsign and the trust list live in `localStorage`. The Ed25519 secret key lives in
`sessionStorage` in a browser (each tab is its own mesh node) and in `localStorage` in the native app
(one identity per install). Only the public key and signatures ever leave the device.

## 7. Reverse-engineered sources (REA)

Every adopted upstream behaviour is recorded from the **unmodified** upstream code into a golden. Our port
must reproduce it, and a deliberately wrong mutant must fail it.

| Upstream (license, pin) | Seam | Golden | Control | Decision |
| --- | --- | --- | --- | --- |
| bitchat (Unlicense, `04995f6`) | codec, padding, compression, signing bytes, packet ids, GCS, fragment plan and reassembly | 62 cases, recorded by the Swift runner on macOS CI (`rea/bitchat`) | mutant caught | Adopt the framing and GCS sync; keep our signed JSON envelopes and CRDT (bitchat's chat model doesn't fit map annotations). Snapshot vendored in `third_party/bitchat`. |
| anyplace (MIT, `7229551`, stale) | `Algorithms.ProcessingAlgorithms` (KNN, WKNN, MAP, MMSE) | 81 cases from real CSUCY radio maps (`rea/anyplace`) | HashMap-order and float32 mutants caught | Port the algorithms; don't adopt the Scala/Couchbase server or its Dijkstra navigation (our multi-floor A* with closures does more). |
| simple-peer (MIT, `f1a492d`, stale) | WebRTC session in real Chromium | 9 scripted sessions (`rea/simple-peer`) | mutant caught | Replace with `RtcPeer`: same observable behaviour, 7.5 KB versus 99 KB, no Node polyfills. |

Quirks pinned by the goldens include:
- bitchat accepts trailing bytes after a frame and leaves frames that would need more than 255 pad bytes
  unpadded;
- anyplace uses its K constant "4" as the MAP/MMSE sigma;
- simple-peer surfaces a remote destroy as `ERR_DATA_CHANNEL`.

Each difference GrahmOS makes from upstream has its own named test.

## 8. Roadmap

- On-device field test of the phone-to-phone plugin and relay firmware (both compile in CI; neither has
  run on physical hardware yet).
- Background scanning: CoreLocation beacon regions on iOS, AltBeacon on Android.
- MultipeerConnectivity / Nearby Connections as a higher-bandwidth native link.
- A floor-plan editor (terra-draw) and a radio-map survey tool for fingerprinting.
- Key revocation and venue-authority keys published inside venue packages.
- A dark theme (the gate's standard dark-mode check is skipped until then).
