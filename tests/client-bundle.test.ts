import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  CLIENT_DIR,
  buildDir,
  builtWithSixSchools,
  colourNeedles,
  draftNeedles,
  findDraftLeaks,
  findMissing,
} from "../scripts/check-client-bundle";
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
      expect(needles, `the adherent noun of ${entry.id}`).toContain(entry.adherent);
      expect(needles, `the plural adherent noun of ${entry.id}`).toContain(entry.adherentPlural);
    }
    // Every colour the flag-only stylesheet defines: three markers, three
    // deep shades, and the one card surface that is not its marker.
    const colours = colourNeedles();
    expect(colours).toHaveLength(7);
    for (const hex of colours) expect(needles).toContain(hex);
  });

  it("matches a colour in either case, and a name only exactly", () => {
    const dir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-bundle-check-"));
    try {
      const hex = colourNeedles()[0];
      fs.writeFileSync(path.join(dir, "a.css"), `:root{--x:${hex.toUpperCase()}}`);
      fs.writeFileSync(path.join(dir, "b.js"), `var a="${DRAFT_SCHOOLS[0].name.toLowerCase()}x";`);
      const found = findDraftLeaks(dir).map((l) => l.needle);
      expect(found).toContain(hex);
      expect(found).not.toContain(DRAFT_SCHOOLS[0].name);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
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

  it("would notice a school missing from a SIX_SCHOOLS build", () => {
    const dir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-bundle-check-"));
    try {
      fs.writeFileSync(path.join(dir, "chunk.js"), `var a={${DRAFT_SCHOOLS[0].id}:1};`);
      const missing = findMissing(dir);
      expect(missing).not.toContain(DRAFT_SCHOOLS[0].id);
      expect(missing).toContain(DRAFT_SCHOOLS[1].id);
      expect(missing).toContain(colourNeedles()[0]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads which kind of build it is checking from the build, and refuses to guess", () => {
    const dir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-bundle-check-"));
    const record = (env: unknown) =>
      fs.writeFileSync(path.join(dir, "required-server-files.json"), JSON.stringify({ config: { env } }));
    try {
      expect(() => builtWithSixSchools(dir)).toThrowError(/missing/);
      record({ SIX_SCHOOLS: "1" });
      expect(builtWithSixSchools(dir)).toBe(true);
      record({ SIX_SCHOOLS: "0" });
      expect(builtWithSixSchools(dir)).toBe(false);
      // A build from before next.config.ts passed the flag through.
      record({});
      expect(() => builtWithSixSchools(dir)).toThrowError(/not "0" or "1"/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("holds no draft school, or on a SIX_SCHOOLS build every one of them", () => {
    if (!fs.existsSync(CLIENT_DIR) || !fs.existsSync(path.join(buildDir(), "required-server-files.json"))) {
      // Nothing built, or a `next dev` build, which records no config.
      // `npm run check:bundle` is the gate that insists on a build; see the
      // note above.
      return;
    }
    if (builtWithSixSchools()) {
      expect(findMissing(), "a SIX_SCHOOLS build shows the three schools").toEqual([]);
      return;
    }
    const leaks = findDraftLeaks();
    expect(
      leaks.map((l) => `${l.needle} in ${l.file}`),
      "a draft school must not reach a client bundle: read it from school-registry.drafts.ts"
    ).toEqual([]);
  });
});
