#!/bin/sh
# Runs from nginx's /docker-entrypoint.d before nginx starts: writes the runtime config
# the app reads (see src/lib/runtimeConfig.ts). Values are JSON-escaped minimally; these
# are URLs, not arbitrary text. Everything in config.js is public - every visitor can read
# it - so nothing secret may ever go in here.
set -e
cfg=/usr/share/nginx/html/config.js
api=$(printf '%s' "${STRAFE_API_URL:-}" | sed 's/["\\]/\\&/g')
gw=$(printf '%s' "${STRAFE_STARGATE_URL:-}" | sed 's/["\\]/\\&/g')
cdn=$(printf '%s' "${STRAFE_CDN_URL:-}" | sed 's/["\\]/\\&/g')
cat > "$cfg" <<EOF
// Generated at container start from STRAFE_API_URL / STRAFE_STARGATE_URL / STRAFE_CDN_URL.
window.__STRAFE_CONFIG__ = { apiUrl: "$api", stargateUrl: "$gw", cdnUrl: "$cdn" };
EOF
echo "strafe web: config.js -> api=${STRAFE_API_URL:-<default>} gateway=${STRAFE_STARGATE_URL:-<default>} cdn=${STRAFE_CDN_URL:-<default>}"
# GIF keys used to be written into config.js, where anyone could copy them. The API now
# holds them and proxies GIF search, so a key left on this container is ignored - say so
# once, without echoing it, so an operator knows to move it (and to rotate one that was
# served by an older version).
if [ -n "${STRAFE_GIPHY_API_KEY:-}" ] || [ -n "${STRAFE_HEYPSTER_API_KEY:-}" ]; then
  echo "strafe web: STRAFE_GIPHY_API_KEY / STRAFE_HEYPSTER_API_KEY are ignored here; GIF keys now belong to the API service (GIPHY_API_KEY / HEYPSTER_API_KEY) and are never sent to browsers"
fi
