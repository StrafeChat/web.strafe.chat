import { build } from "esbuild";
import { resolve } from "path";

async function buildServiceWorker() {
  try {
    await build({
      entryPoints: [resolve("src/service-worker.ts")],
      bundle: true,
      outfile: "public/service-worker.js",
      format: "iife",
      platform: "browser",
      target: "es2020",
      minify: true,
      sourcemap: true,
    });
    console.log("Service worker built successfully!");
  } catch (error) {
    console.error("Error building service worker:", error);
    process.exit(1);
  }
}

buildServiceWorker();
