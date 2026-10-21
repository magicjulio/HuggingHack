#!/usr/bin/env bash
# Serves all ending prototypes at http://localhost:8765/ .
# three.js is copied from app/node_modules on first run (vendor/ is gitignored).
set -e
cd "$(dirname "$0")"
if [ ! -f vendor/three/build/three.module.js ]; then
  mkdir -p vendor/three
  cp -r ../app/node_modules/three/build ../app/node_modules/three/examples vendor/three/
fi
echo "open http://localhost:8765/"
python3 -m http.server 8765
