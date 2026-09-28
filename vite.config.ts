import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  // wasm(): loads the @matrix-org/matrix-sdk-crypto-wasm E2EE engine as an ES module.
  // Its init glue uses top-level await; build.target is already esnext below, so every
  // target browser supports that natively and vite-plugin-top-level-await's transform
  // (which broke on this project's SWC toolchain) isn't needed.
  plugins: [devtools(), solidPlugin(), tailwindcss(), wasm()],
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
