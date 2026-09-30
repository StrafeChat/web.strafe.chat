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

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
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
