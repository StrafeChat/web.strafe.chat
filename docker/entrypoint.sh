#!/bin/sh
# Runs from nginx's /docker-entrypoint.d before nginx starts: writes the runtime config
# the app reads (see src/lib/runtimeConfig.ts). Values are JSON-escaped minimally; these
# are URLs, not arbitrary text.
set -e
cfg=/usr/share/nginx/html/config.js
api=$(printf '%s' "${STRAFE_API_URL:-}" | sed 's/["\\]/\\&/g')
gw=$(printf '%s' "${STRAFE_STARGATE_URL:-}" | sed 's/["\\]/\\&/g')
cdn=$(printf '%s' "${STRAFE_CDN_URL:-}" | sed 's/["\\]/\\&/g')
giphy=$(printf '%s' "${STRAFE_GIPHY_API_KEY:-}" | sed 's/["\\]/\\&/g')
heypster=$(printf '%s' "${STRAFE_HEYPSTER_API_KEY:-}" | sed 's/["\\]/\\&/g')
cat > "$cfg" <<EOF
// Generated at container start from STRAFE_API_URL / STRAFE_STARGATE_URL / STRAFE_CDN_URL,
// and the optional GIF-picker keys STRAFE_GIPHY_API_KEY / STRAFE_HEYPSTER_API_KEY.
window.__STRAFE_CONFIG__ = { apiUrl: "$api", stargateUrl: "$gw", cdnUrl: "$cdn", giphyApiKey: "$giphy", heypsterApiKey: "$heypster" };
EOF
echo "strafe web: config.js -> api=${STRAFE_API_URL:-<default>} gateway=${STRAFE_STARGATE_URL:-<default>} cdn=${STRAFE_CDN_URL:-<default>} giphy=$([ -n "${STRAFE_GIPHY_API_KEY:-}" ] && echo set || echo unset) heypster=$([ -n "${STRAFE_HEYPSTER_API_KEY:-}" ] && echo set || echo unset)"
