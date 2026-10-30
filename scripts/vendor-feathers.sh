#!/usr/bin/env bash
# feathers is copied in from its private repo, never committed, because nb's repo is public.
set -euo pipefail
cd "$(dirname "$0")/.."
src="$HOME/workspace/feathers/dist"
rm -rf web/vendor/feathers
mkdir -p web/vendor/feathers
cp "$src/feathers.css" web/vendor/feathers/
cp -R "$src/fonts" web/vendor/feathers/
