#!/usr/bin/env bash
# Package the extension from src/ into dist/:
#   dist/studocuhack-v<version>.zip   Chrome / Brave / Edge (extract, load unpacked)
#   dist/studocuhack-v<version>.xpi   Firefox (same archive; unsigned until
#                                     scripts/sign-firefox.sh or the release
#                                     workflow signs it)
#
# Usage: npm run build      (or: bash scripts/build.sh)
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="$(node -p "require('./src/manifest.json').version")"
OUT="dist"
mkdir -p "$OUT"
rm -f "$OUT"/studocuhack-v"$VERSION".zip "$OUT"/studocuhack-v"$VERSION".xpi

# web-ext validates the manifest and excludes editor junk for us.
npx --yes web-ext build \
  --source-dir=src \
  --artifacts-dir="$OUT" \
  --filename="studocuhack-v${VERSION}.zip" \
  --overwrite-dest

cp "$OUT/studocuhack-v${VERSION}.zip" "$OUT/studocuhack-v${VERSION}.xpi"

echo
echo "Built:"
ls -1 "$OUT"/studocuhack-v"$VERSION".*
