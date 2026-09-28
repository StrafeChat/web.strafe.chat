#!/bin/sh
# Runs from nginx's /docker-entrypoint.d before nginx starts: writes the runtime config
# the app reads (see src/lib/runtimeConfig.ts). Values are JSON-escaped minimally; these
# are URLs, not arbitrary text.
set -e
cfg=/usr/share/nginx/html/config.js
api=$(printf '%s' "${STRAFE_API_URL:-}" | sed 's/["\\]/\\&/g')
gw=$(printf '%s' "${STRAFE_STARGATE_URL:-}" | sed 's/["\\]/\\&/g')
cat > "$cfg" <<EOF
// Generated at container start from STRAFE_API_URL / STRAFE_STARGATE_URL.
window.__STRAFE_CONFIG__ = { apiUrl: "$api", stargateUrl: "$gw" };
EOF
echo "strafe web: config.js -> api=${STRAFE_API_URL:-<default>} gateway=${STRAFE_STARGATE_URL:-<default>}"
