# anyplace snapshot (vendored subset, unmodified)

- Upstream: https://github.com/dmsl/anyplace (stale: last commit 2022-08-06)
- Commit: `7229551823757cc39174cc693947d9077e770bfb`
- License: MIT (`LICENSE.txt`, Copyright (c) 2020 DMSL, University of Cyprus).
- Vendored: `server/app/location/*.java` (fingerprint positioning: KNN, WKNN, MAP, MMSE, radio map
  parser) and the CSUCY building's recorded radio maps from `clients/simulator/data` (fixtures).
- Not vendored: the Scala/Play server, Couchbase storage, Android/iOS/web clients, Dijkstra navigation
  (GrahmOS's multi-floor A* with closures and step-free routing supersedes it).
