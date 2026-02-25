import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite';

export default defineConfig({
  plugins: [devtools(), solidPlugin(), tailwindcss()],
  server: {
    port: 3000,
    strictPort: true,
  },
  build: {
    target: 'esnext',
  },
  // SPA fallback for path-based routing (no hash)
  appType: 'spa',
});
