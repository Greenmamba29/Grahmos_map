# GrahmOS Maps: offline indoor navigation and a Bluetooth mesh

GrahmOS Maps is an indoor maps app (search, floor plans, turn-by-turn directions,
blue-dot location) built to run with **no internet connection at all**. Devices
in a building share hazards, closures, SOS calls and even whole venue maps with
each other over a peer-to-peer mesh. Routes are recalculated around reported
closures automatically.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 35 unit + UI tests
npm run build      # static PWA in dist/ (precached for offline use)
```

Open the app once, then switch the device to airplane mode. Everything keeps
working: the map, search, routing, positioning and the mesh.

## What it does

| Area | Capability |
| --- | --- |
| **Floor plans** | Vector SVG floor plans rendered on the device with pan, pinch-zoom, floor picker, room labels and amenity markers. No tile server, fonts or CDN. |
| **Search** | Offline fuzzy search with typo tolerance ("libary") and everyday synonyms ("bathroom", "defibrillator", "way out", "lift"). |
| **Directions** | A* shortest-time routing across floors via stairs and elevators, a **step-free** mode, turn-by-turn steps, ETA, and one-tap **nearest exit / restroom / medical / water** routing. |
| **Indoor positioning** | BLE beacon positioning (iBeacon and Eddystone-UID). It filters signal strength with a per-beacon median, converts it to distance with a log-distance path-loss model, solves position by weighted least squares, smooths it with a Kalman filter, and detects the floor with hysteresis. Also supports a manual "I'm here" location and a simulated walk for demos. |
| **Bluetooth mesh** | Flooding mesh with TTL and dedupe over pluggable transports: other tabs on the device (BroadcastChannel) and **BLE relay nodes** (Web Bluetooth GATT, Nordic UART Service, chunked frames). |
| **Shared situational awareness** | SOS, closures, hazards and notes are stored as a last-writer-wins CRDT with hybrid logical clocks. Devices converge even if they were never online at the same time. Closures re-route everyone. |
| **Device-to-device maps** | Share a venue package over the mesh, or import and export it as a `grahmos.venue/1` JSON file. |
| **Offline storage** | Workbox precache for the app shell, IndexedDB for venues and mesh state, and a persistent-storage request so the browser does not evict data. |

## Architecture

```
src/
  indoor/        venue schema, geometry, demo venue, search, package validation
  routing/       IndoorRouter (A*, step-free, closures, turn-by-turn), nearest-of
  positioning/   PositioningEngine (path loss, multilateration, Kalman, floors),
                 Web Bluetooth scanner, iBeacon/Eddystone parsers, simulator
  mesh/          MeshNode (flooding + anti-entropy), HLC, LWW CRDT, protocol,
                 transports/ (BroadcastChannel, BLE GATT relay, in-memory)
  components/    FloorMap (SVG), search, place, directions, mesh, offline sheets
  hooks/         useMesh, usePositioning
  lib/storage.ts IndexedDB persistence
```

All core modules are pure TypeScript with no DOM or network dependencies, so they
can move unchanged into a React Native or Capacitor shell.

See [INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md) for the venue schema, the
mesh wire protocol (to build relay firmware), deployment, and the platform
support matrix.

## Honest platform notes

- **Web Bluetooth GATT** (connecting to a relay node) works in Chrome and Edge on
  Android, ChromeOS, macOS and Windows. It does not work in Safari or Firefox.
- **Beacon scanning** (`requestLEScan`) is still behind Chrome's experimental
  flag. Production beacon positioning on iOS and Android needs a thin native
  shell (Capacitor/React Native) that feeds sightings into the same
  `PositioningEngine`.
- Browsers cannot advertise as BLE peripherals, so phone-to-phone Bluetooth
  without a relay needs that same native shell. The mesh core is
  transport-agnostic for exactly this reason.

## License

MIT
