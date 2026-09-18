#!/usr/bin/env bash
# Sign the extension for Firefox through Mozilla's add-on service (AMO).
#
# Release Firefox only installs Mozilla-signed add-ons; an unsigned .xpi fails
# with "could not be installed because it has not been verified". Signing on
# the "unlisted" channel returns a signed .xpi you distribute yourself (attach
# it to the GitHub release). Use --channel=listed to publish an AMO page.
#
# One-time setup: create an API key at
#   https://addons.mozilla.org/developers/addon/api/key/
# (free Mozilla add-on developer account), then put the two values in
# ~/.studocuhack-amo.env, outside the repo so they are never committed:
#   export WEB_EXT_API_KEY='user:XXXXXXX:NNN'     # the "JWT issuer"
#   export WEB_EXT_API_SECRET='xxxxxxxxxxxxxxxx'  # the "JWT secret"
#
# Usage: npm run sign      (or: bash scripts/sign-firefox.sh)
set -euo pipefail

cd "$(dirname "$0")/.."

[ -f "$HOME/.studocuhack-amo.env" ] && . "$HOME/.studocuhack-amo.env"
: "${WEB_EXT_API_KEY:?set WEB_EXT_API_KEY (AMO JWT issuer) first}"
: "${WEB_EXT_API_SECRET:?set WEB_EXT_API_SECRET (AMO JWT secret) first}"

VERSION="$(node -p "require('./src/manifest.json').version")"

npx --yes web-ext sign \
  --source-dir=src \
  --channel="${AMO_CHANNEL:-unlisted}" \
  --artifacts-dir=./web-ext-artifacts \
  --api-key="$WEB_EXT_API_KEY" \
  --api-secret="$WEB_EXT_API_SECRET"

echo
echo "Signed .xpi is in ./web-ext-artifacts/. Attach it to the release, e.g.:"
echo "  gh release upload v${VERSION} ./web-ext-artifacts/*.xpi --clobber"
