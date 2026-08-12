# Offline data

`demo-facilities.json` is non-authoritative UI preview data. Production PMTiles
archives belong in `public/tiles/` only for local testing; that directory is
ignored by Git. Deploy versioned archives through the nginx `/tiles/` mount.
