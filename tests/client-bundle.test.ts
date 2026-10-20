import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { CLIENT_DIR, draftNeedles, findDraftLeaks } from "../scripts/check-client-bundle";
import { DRAFT_SCHOOLS } from "../src/lib/school-registry.drafts";

/**
 * The same check `npm run check:bundle` runs, so the suite catches a draft
 * leak for anyone who runs the tests after a build.
 *
 * The script is the enforcement, because it fails when there is no build
 * to check and the pre-push gate runs it after `npm run build`. This test
 * cannot do that: a clean checkout has no .next, and failing the whole
 * suite for that would be wrong. So it skips the bundle assertion without
 * a build, and the parts that do not need one still run.
 */
describe("the client bundle", () => {
  it("knows which strings would give a draft school away", () => {
    const needles = draftNeedles();
    expect(needles.length).toBeGreaterThan(0);
    for (const entry of DRAFT_SCHOOLS) {
      expect(needles, `the id ${entry.id}`).toContain(entry.id);
      expect(needles, `the name of ${entry.id}`).toContain(entry.name);
    }
  });

  it("would notice a leak if there were one", () => {
    // The checker against a fixture rather than against the real build, so
    // a regression in the matcher fails here instead of passing quietly.
    const dir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-bundle-check-"));
    try {
      fs.writeFileSync(path.join(dir, "chunk.js"), `var a={${DRAFT_SCHOOLS[0].id}:1};`);
      const leaks = findDraftLeaks(dir);
      expect(leaks.map((l) => l.needle)).toContain(DRAFT_SCHOOLS[0].id);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("holds no draft school", () => {
    if (!fs.existsSync(CLIENT_DIR)) {
      // Nothing built. `npm run check:bundle` is the gate that insists on
      // a build; see the note above.
      return;
    }
    const leaks = findDraftLeaks();
    expect(
      leaks.map((l) => `${l.needle} in ${l.file}`),
      "a draft school must not reach a client bundle: read it from school-registry.drafts.ts"
    ).toEqual([]);
  });
});
