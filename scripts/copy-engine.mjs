/**
 * Put Stockfish where the browser can fetch it.
 *
 * The engine has to be loaded into a Worker from a real URL, which means it has
 * to be a static file rather than something the bundler inlines. Copying it out
 * of node_modules at build time keeps 650KB of binary out of the repository and
 * means the served engine can never be a different version from the installed
 * one.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const source = dirname(require.resolve("stockfish.js/package.json"));
const target = resolve(import.meta.dirname, "..", "public", "engine");

mkdirSync(target, { recursive: true });

// The loader finds the .wasm alongside itself, so both have to land together.
for (const file of ["stockfish.wasm.js", "stockfish.wasm"]) {
  copyFileSync(resolve(source, file), resolve(target, file));
}

console.log(`engine: copied stockfish.wasm.js and stockfish.wasm into public/engine/`);
