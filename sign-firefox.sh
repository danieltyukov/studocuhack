#!/usr/bin/env bash
# Sign StudocuHack for Firefox via Mozilla AMO, then it can be installed like any
# add-on. Firefox only trusts add-ons signed by Mozilla, so this is required; the
# unsigned .xpi gives "could not be installed because it has not been verified".
#
# One-time: create an API key at https://addons.mozilla.org/developers/addon/api/key/
# (requires a free Mozilla add-on developer account), then in this shell:
#   export WEB_EXT_API_KEY='user:XXXXXXX:NNN'     # the "JWT issuer"
#   export WEB_EXT_API_SECRET='xxxxxxxxxxxxxxxx'  # the "JWT secret"
# Then run:  ./sign-firefox.sh
#
# --channel=unlisted returns a Mozilla-signed .xpi you self-distribute (e.g. attach
# to the GitHub release). Use --channel=listed instead to publish a public AMO page.
set -euo pipefail
cd "$(dirname "$0")"
: "${WEB_EXT_API_KEY:?set WEB_EXT_API_KEY (AMO JWT issuer) first}"
: "${WEB_EXT_API_SECRET:?set WEB_EXT_API_SECRET (AMO JWT secret) first}"
npx --yes web-ext sign \
  --source-dir=. \
  --channel=unlisted \
  --artifacts-dir=./web-ext-artifacts \
  --api-key="$WEB_EXT_API_KEY" \
  --api-secret="$WEB_EXT_API_SECRET"
echo
echo "Signed .xpi is in ./web-ext-artifacts/ . Attach it to the release, e.g.:"
echo "  gh release upload v2.9.0 ./web-ext-artifacts/*.xpi --clobber"
