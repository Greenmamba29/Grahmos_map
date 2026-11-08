# GrahmOS Maps: offline indoor navigation and a Bluetooth mesh

GrahmOS Maps is an indoor maps app (search, floor plans, turn-by-turn directions,
blue-dot location) built to run with **no internet connection at all**. Devices
in a building share hazards, closures, SOS calls and even whole venue maps with
each other over a peer-to-peer mesh. Routes are recalculated around reported
closures automatically.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 86 unit + UI tests
npm run build      # static PWA in dist/ (precached for offline use)
npm run osa:gate   # full quality gate (types, tests, a11y, security); see below
npm run cap:android   # open the native Android project (Bluetooth on real phones)
npm run cap:ios       # open the native iOS project (needs a Mac with Xcode)
```

Open the app once, then switch the device to airplane mode. Everything keeps
working: the map, search, routing, positioning and the mesh.

## What it does

| Area | Capability |
| --- | --- |
| **Floor plans** | Vector SVG floor plans rendered on the device with pan, pinch-zoom, floor picker, room labels and amenity markers. No tile server, fonts or CDN. |
| **Search** | Offline fuzzy search with typo tolerance ("libary") and everyday synonyms ("bathroom", "defibrillator", "way out", "lift"). |
| **Directions** | A* shortest-time routing across floors via stairs and elevators, a **step-free** mode, turn-by-turn steps, ETA, and one-tap **nearest exit / restroom / medical / water** routing. |
| **Indoor positioning** | Step tracking fused with BLE (blue dot moves between beacon fixes and through dead zones), anyplace-derived fingerprinting (KNN/WKNN/MAP/MMSE), and BLE beacon positioning (iBeacon and Eddystone-UID). It filters signal strength with a per-beacon median, converts it to distance with a log-distance path-loss model, solves position by weighted least squares, smooths it with a Kalman filter, and detects the floor with hysteresis. Also supports a manual "I'm here" location and a simulated walk for demos. |
| **Bluetooth mesh** | Flooding mesh with TTL and dedupe over pluggable transports: other tabs on the device (BroadcastChannel) and **BLE relay nodes** (Nordic UART Service, chunked frames) through Web Bluetooth in a browser or the Capacitor BLE plugin in the native apps. |
| **Phone-to-phone Bluetooth** | In the native apps every phone is a BLE advertiser and scanner at once (`plugins/grahmos-ble-mesh`, Swift and Kotlin), so phones mesh with **no relay hardware**. Packets use bitchat's framing (compressed, fragmented), proven against bitchat's own code. |
| **Relays and long range** | `firmware/esp32-relay`: a ~$5 ESP32 relay that bridges phones over Nordic UART and floods to other relays over ESP-NOW (~200 m per hop, no Wi-Fi network). Direct WebRTC links upgrade peers on the same LAN for big transfers. |
| **Signed messages** | Every mesh message and every shared report is signed with the sender's Ed25519 key ([noble-ed25519](https://github.com/paulmillr/noble-ed25519)). A peer's id is derived from its public key, so nobody can impersonate another device, alter a report in transit, or post a closure in someone else's name. Anyone may mark a hazard resolved; the panel shows who signed it. Peers can be marked **Trusted** (e.g. venue staff). Map updates over the mesh are only accepted from the peer who first shared that map. |
| **Shared situational awareness** | SOS, closures, hazards and notes are stored as a last-writer-wins CRDT with hybrid logical clocks. Devices converge even if they were never online at the same time. Closures re-route everyone. |
| **Device-to-device maps** | Share a venue package over the mesh, import IMDF archives (walking graph generated automatically), or import and export `grahmos.venue/1` JSON. |
| **Native apps** | Capacitor shells for Android and iOS (`android/`, `ios/`) run the same build with native Bluetooth: beacon scanning and relay connections work on real phones. CI builds the Android APK on every push. |
| **Offline storage** | A service worker precaches every built file (a small Vite plugin, no workbox-build), IndexedDB holds venues and signed mesh state, and a persistent-storage request keeps the browser from evicting data. |

## Architecture

```
src/
  indoor/        venue schema, geometry, demo venue, search, package validation
  routing/       IndoorRouter (A*, step-free, closures, turn-by-turn), nearest-of
  positioning/   PositioningEngine (path loss, multilateration, Kalman, floors),
                 Web Bluetooth and native (Capacitor) scanners, iBeacon/Eddystone parsers, simulator
  mesh/          MeshNode (flooding + anti-entropy), Ed25519 identity and signing,
                 HLC, LWW CRDT, protocol, venue update policy,
                 transports/ (BroadcastChannel, Web Bluetooth relay, native BLE relay, in-memory)
  components/    FloorMap (SVG), search, place, directions, mesh, offline sheets
  hooks/         useMesh, usePositioning
  platform/      native-shell detection, service worker registration
  lib/storage.ts IndexedDB persistence
vite-plugins/    offline precache manifest + service worker build
plugins/         grahmos-ble-mesh: native phone-to-phone BLE (Swift + Kotlin)
firmware/        esp32-relay: NimBLE + ESP-NOW relay (PlatformIO)
third_party/     vendored upstream snapshots (bitchat, anyplace, simple-peer), unmodified
rea/             reverse-engineering goldens, reference runners and port CLIs
android/, ios/   Capacitor native projects (Bluetooth permissions set)
osa-kit/         OSA quality gate (vendored from conductor-s-launchpad)
```

All core modules are pure TypeScript with no DOM or network dependencies; the
native apps reuse them unchanged.

See [INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md) for the venue schema, the
mesh wire protocol (to build relay firmware), deployment, and the platform
support matrix.

## Quality gate

`npm run osa:gate -- --e2e http://127.0.0.1:4175` (against `npx vite preview --port 4175`) runs the
OSA gate: strict types, lint, the full test suite, WCAG contrast, axe-core accessibility at phone and
desktop width, a 12-step click-through (including an axe scan of every sheet and dialog) (`tests/e2e_click_test.py`), gitleaks, Semgrep, dependency
advisories, licenses and workflow lint. CI (`.github/workflows/osa-gate.yml`) runs the same gate.

## Platform notes

- **Native apps (recommended on phones).** Android: beacons are found by iBeacon or Eddystone; the
  app asks for Bluetooth and location permission (Android requires location for beacon positioning).
  iOS: Apple hides iBeacon frames from Bluetooth apps, so beacons must also broadcast **Eddystone-UID**
  (most beacons do both; the demo venue's beacons carry both identities).
- **Browsers.** Web Bluetooth (relay connections) works in Chrome and Edge on Android, ChromeOS, macOS
  and Windows, not in Safari or Firefox. Browser beacon scanning (`requestLEScan`) is still behind a
  Chrome flag, so use the native apps for positioning.
- **Phone-to-phone without a relay** works in the native apps (browsers can't advertise over BLE).
  The plugin and the relay firmware compile in CI but have not yet been tested on physical devices.
- **Building the native apps** needs the Android SDK (Android Studio) or Xcode on a Mac. CI builds the
  Android debug APK on every push (`.github/workflows/native.yml`); the iOS build runs on demand.

## License

MIT
