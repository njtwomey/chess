import { copyFileSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin, ResolvedConfig } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Routing is client-side, so a direct hit on /schedule asks the host for a file
 * that does not exist. Serving index.html for it is what makes a pasted link
 * work, and on GitHub Pages the way to ask for that is a 404.html.
 */
function spaFallback(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "spa-fallback",
    apply: "build",
    configResolved(resolved) {
      config = resolved;
    },
    closeBundle() {
      const outDir = resolve(config.root, config.build.outDir);
      copyFileSync(resolve(outDir, "index.html"), resolve(outDir, "404.html"));
    },
  };
}

export default defineConfig({
  // A project site lives under /<repo>/ on Pages, and this one is published to
  // nialltwomey.com/chess. The dev server uses the same prefix on purpose: a
  // hard-coded "/somewhere" works perfectly at the root and breaks in
  // production, and that is a class of bug worth meeting locally.
  // VITE_BASE overrides it; never hard-code a base anywhere else.
  base: process.env.VITE_BASE ?? "/chess/",
  plugins: [react(), tailwindcss(), spaFallback()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
      "@content": resolve(import.meta.dirname, "content"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Without this every chunk is index-<hash>.js and the build output stops
        // telling you which route grew.
        chunkFileNames: "assets/[name]-[hash].js",
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
