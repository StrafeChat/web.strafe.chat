# Web client: build once, configure at runtime.
# The image serves the static bundle with nginx and rewrites /config.js on start from
# STRAFE_API_URL / STRAFE_STARGATE_URL, so the same image works for any domain.
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json* ./
# No --legacy-peer-deps: the tree resolves cleanly now (solid-devtools 0.34.5 declares Vite 7),
# and the flag would only hide the next genuine conflict instead of failing the build.
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY docker/entrypoint.sh /docker-entrypoint.d/40-strafe-config.sh
RUN chmod +x /docker-entrypoint.d/40-strafe-config.sh

COPY --from=build /app/dist /usr/share/nginx/html

ENV STRAFE_API_URL="" \
    STRAFE_STARGATE_URL=""

EXPOSE 80
