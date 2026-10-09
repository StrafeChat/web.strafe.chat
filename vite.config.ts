import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite';
import wasm from 'vite-plugin-wasm';
import { strafeDocsPlugin } from './scripts/docs-plugin.mjs';

// A unique id per build. Exposed to the bundle as __BUILD_ID__ and also written to
// /version.json (emitted below), so a running client can poll that file and tell when a
// newer build has been deployed - then prompt the user to refresh.
const buildId = String(Date.now());

// The app's semantic version, taken straight from package.json so there is one source of
// truth - exposed as __APP_VERSION__ and shown in the user-settings footer. Bump package.json
// to change it.
const appVersion = String(
  (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version?: string }).version ?? '0.0.0'
);

/** Emits /version.json alongside the build so the client can detect new deploys. */
function versionFilePlugin() {
  return {
    name: 'strafe-version-file',
    generateBundle() {
      // eslint-disable-next-line @typescript-eslint/no-invalid-this
      (this as { emitFile: (f: { type: 'asset'; fileName: string; source: string }) => void }).emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ buildId }),
      });
    },
  };
}

// Dev-only: where the local dev server forwards API/gateway traffic. See server.proxy below.
const PROD_ORIGIN = 'https://app.strafe.chat';

const prodProxy = {
  target: PROD_ORIGIN,
  // Caddy routes by Host, so the upstream request must present the instance's hostname.
  changeOrigin: true,
  secure: true,
  // The API tolerates an unknown Origin but then omits Access-Control-Allow-Origin, and a
  // state-changing request can be refused outright by an origin check. Present the
  // instance's own origin so a forwarded request is indistinguishable from a real one.
  configure(proxy: { on: (event: string, cb: (req: { setHeader: (k: string, v: string) => void }) => void) => void }) {
    proxy.on('proxyReq', (proxyReq) => proxyReq.setHeader('origin', PROD_ORIGIN));
  },
};

export default defineConfig({
  // The desktop app (StrafeChat/desktop) runs this same dev server inside its webview: keep
  // the terminal readable for the Rust output and let the shell's TAURI_ENV_* reach the bundle.
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  // wasm(): loads the @matrix-org/matrix-sdk-crypto-wasm E2EE engine as an ES module.
  // Its init glue uses top-level await; build.target is already esnext below, so every
  // target browser supports that natively and vite-plugin-top-level-await's transform
  // (which broke on this project's SWC toolchain) isn't needed.
  // strafeDocsPlugin(): the developer docs at /docs/ (docs/pages/*.md), served in dev and
  // emitted into dist/docs/ so every instance ships them.
  plugins: [devtools(), solidPlugin(), tailwindcss(), wasm(), versionFilePlugin(), strafeDocsPlugin()],
  server: {
    port: 3000,
    strictPort: true,
    // Dev-only: forward API, CDN and gateway traffic to the production instance, so the dev
    // client exercises app.strafe.chat without a deploy. The browser calls the dev server
    // same-origin (hence the relative /api in .env), so it applies no CORS check at all, and
    // the proxy re-presents the instance's origin upstream - which is what the production
    // CORS policy and the gateway's Origin check expect (it answers 403 to a localhost
    // Origin). Nothing here ships: it lives under `server` and never reaches a build.
    proxy: {
      '/api': prodProxy,
      '/cdn': prodProxy,
      '/gateway': { ...prodProxy, ws: true, rewriteWsOrigin: true },
    },
  },
  build: {
    target: 'esnext',
  },
  // SPA fallback for path-based routing (no hash)
  appType: 'spa',
  // esbuild (used for dev-time dependency pre-bundling) doesn't understand WASM imports;
  // without this exclude, the pre-bundled copy's .wasm request falls through to the SPA
  // fallback above and gets served as text/html, which fails WebAssembly.compile with a
  // MIME-type error. Excluding it makes Vite load the package directly instead.
  optimizeDeps: {
    exclude: ['@matrix-org/matrix-sdk-crypto-wasm'],
  },
});
