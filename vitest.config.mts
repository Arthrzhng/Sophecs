import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// The defaults picked the whole suite up fine until a test needed to
// import the judge path and another needed to render a component.
//
// `@/*` matches the tsconfig paths mapping, which vitest does not read.
// `server-only` is redirected to the same empty shim the standalone
// scripts use (scripts/preload-server-only-shim.cjs does it for CommonJS
// requires); without it, importing src/lib/anthropic.ts throws at module
// load, because the real package exists only to throw.
export default defineConfig({
  test: {
    // The reviewer agents in CONTRIBUTING.md's review loop work in git
    // worktrees under .claude/worktrees/, each a full copy of the
    // repository on its own branch. Without this the suite globbed into
    // them and ran several copies of itself at once, failing where two
    // branches disagreed about tests neither branch under review
    // contained. A run that reported green off a stale agent checkout is
    // the same bug with the opposite sign.
    //
    // No test count is quoted here: it differs per branch and goes stale.
    // This comment said 29 where the branch had 28, which is the error
    // docs/review-charter.md's own rule 1 is about. The incident's
    // numbers live there.
    exclude: [...configDefaults.exclude, ".claude/**"],
    // Every test sees a build without SIX_SCHOOLS unless it stubs the flag
    // itself (tests/six-schools.test.ts), so a SIX_SCHOOLS=1 left in the
    // shell cannot fail unrelated tests under misleading names.
    env: { SIX_SCHOOLS: "0" },
  },
  // tsconfig sets `jsx: "preserve"`, which is right for Next and leaves
  // vitest unable to parse a component on its own. Vite 8 transforms with
  // Oxc rather than esbuild, so this is where that is overridden, and only
  // for tests: the build's own tsconfig is untouched.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./scripts/server-only-shim.cjs", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // The root layout imports the new schools' tokens by a name only
      // next.config.ts resolves (docs/stage5-plan.md). A test that imports
      // the layout reads its metadata, never its styles, so the name points
      // at the empty stylesheet whatever SIX_SCHOOLS says.
      "@six-schools/tokens.css": fileURLToPath(
        new URL("./src/app/six-schools.off.css", import.meta.url)
      ),
    },
  },
});
