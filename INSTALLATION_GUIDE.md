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

## 5. Mesh protocol (v1)

### Envelope

Every frame is a UTF-8 JSON envelope:

```json
{ "v": 1, "id": "9f2c…", "origin": "a1b2c3d4e5f6", "ttl": 6, "hops": 0,
  "hlc": "0lz8k2m1c0:0000:a1b2c3d4e5f6", "body": { "kind": "ops", "entries": [ … ] } }
```

| `body.kind` | Purpose | Default TTL |
| --- | --- | --- |
| `hello` | Name and venue. Also a 15 s heartbeat. Newcomers get a hello back. | 0 |
| `digest` | `{key: hlc}` summary for anti-entropy. A receiver replies with missing `ops` and, if it is itself behind, a `reply` digest. | 0 |
| `ops` | Last-writer-wins CRDT entries `{key, value: Annotation, hlc}` | 6 |
| `presence` | Live position, level and accuracy (expires after 90 s) | 3 |
| `text` | Broadcast message (≤ 500 chars) | 6 |
| `venue` | Whole venue package | 2 |

Relay rules: drop frames whose `id` has been seen or whose `origin` is self.
Reject HLCs more than 24 h ahead. Otherwise handle the frame and, if `ttl > 0`,
forward it with `ttl − 1, hops + 1` on every link except the one it came in on.

### Chunked framing for constrained links

For BLE GATT (and LoRa or serial bridges), each frame is split into packets:

```
u16 seq (big-endian) | u16 index | u16 total | payload bytes…
```

The default packet size is 180 bytes (use 20 for links without MTU exchange).
Receivers reassemble packets in any order and drop partials after 15 s.

### BLE relay node (Nordic UART Service)

| Characteristic | UUID | Direction |
| --- | --- | --- |
| Service | `6e400001-b5a3-f393-e0a9-e50e24dcca9e` | |
| RX | `6e400002-b5a3-f393-e0a9-e50e24dcca9e` | phone → relay (write) |
| TX | `6e400003-b5a3-f393-e0a9-e50e24dcca9e` | relay → phone (notify) |

A relay is any ESP32 or nRF52 board running the standard Nordic UART profile
under an advertised name starting with `GrahmOS`. It forwards packets it
receives from one phone to every other connected phone, and over its long-range
fabric (ESP-NOW, BLE Mesh, or LoRa via projects such as Meshtastic) to other
relays. Relays do not need to parse JSON. Forwarding packets byte for byte is
enough, because dedupe and TTL are enforced on the phones. The browser
reconnects on its own with exponential backoff when a relay goes out of range.

### Open-source building blocks

The mesh is designed to plug into these open projects:

- **Meshtastic.** LoRa mesh firmware for ESP32/nRF52, used as a long-range
  backbone between relays.
- **Nordic UART Service / Zephyr / ESP-IDF NimBLE.** Relay firmware base.
- **Bitchat-style BLE store-and-forward.** Phone-to-phone over BLE in a native
  shell, using the same envelope and chunk format.
- **IMDF / OpenStreetMap Simple Indoor Tagging.** Venue data sources.

## 6. Storage

The IndexedDB database `grahmos-indoor` has these stores:

- `venues`: venue packages.
- `annotations`: CRDT entries, persisted 400 ms after each change.
- `settings`: the active venue.

The callsign lives in `localStorage`. The peer id lives in `sessionStorage`, so
each tab is its own mesh node.

## 7. Roadmap

- A native shell (Capacitor) for background beacon scanning and peer-to-peer
  BLE/Wi-Fi Aware on iOS and Android.
- Signed envelopes (Ed25519 per device) with a trust list for authoritative
  closures.
- Pedestrian dead reckoning (accelerometer and compass) fused with BLE in the
  Kalman filter.
- IMDF zip importer and a floor-plan editor.
- A WebRTC transport for phone-to-phone links over local Wi-Fi without
  internet.
