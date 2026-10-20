import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Two aliases, and nothing else: the defaults picked the whole suite up
// fine until a test needed to import the judge path.
//
// `@/*` matches the tsconfig paths mapping, which vitest does not read.
// `server-only` is redirected to the same empty shim the standalone
// scripts use (scripts/preload-server-only-shim.cjs does it for CommonJS
// requires); without it, importing src/lib/anthropic.ts throws at module
// load, because the real package exists only to throw.
export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./scripts/server-only-shim.cjs", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
