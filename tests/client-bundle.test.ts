import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  CLIENT_DIR,
  buildDir,
  builtWithSixSchools,
  SIX_SCHOOLS_CSS,
  colourNeedles,
  draftNeedles,
  findDraftLeaks,
  findMissing,
  wrongKindOfBuild,
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
    // deep shades and three card surfaces, each darker than its marker
    // (Arthur's ruling (e)2 of 2026-11-05).
    const colours = colourNeedles();
    expect(colours).toHaveLength(9);
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
      fs.writeFileSync(path.join(dir, "chunk.js"), `var a={id:"${DRAFT_SCHOOLS[0].id}"};`);
      const missing = findMissing(dir);
      expect(missing).not.toContain(DRAFT_SCHOOLS[0].id);
      expect(missing).toContain(DRAFT_SCHOOLS[1].id);
      expect(missing).toContain(colourNeedles()[0]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("counts a string as present only whole, not inside a longer one", () => {
    // The leak check is deliberately loose; presence is not. "Confucian"
    // inside "Confucianism", or an id inside a CSS custom property's name,
    // is not the registry entry a flag-on build is meant to carry.
    const entry = DRAFT_SCHOOLS[0];
    const dir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-bundle-check-"));
    try {
      fs.writeFileSync(path.join(dir, "a.js"), `var n="${entry.name}";`);
      fs.writeFileSync(path.join(dir, "b.css"), `:root{--color-${entry.id}:#000000}`);
      const missing = findMissing(dir);
      expect(missing).not.toContain(entry.name);
      expect(missing).toContain(entry.id);
      if (entry.name.includes(entry.adherent!)) expect(missing).toContain(entry.adherent);
      // The leak check, by contrast, finds the id in the property name.
      expect(findDraftLeaks(dir).map((l) => l.needle)).toContain(entry.id);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses to check a build of the other kind, in both directions", () => {
    // The production gate on a flag-on build, as a SIX_SCHOOLS=1 left in
    // a shell or .env.local would make one: refused, not passed.
    expect(wrongKindOfBuild(true, false, ".next")).toMatch(/this is the production check/);
    // --six on a production build: refused, not passed as a missing flag.
    expect(wrongKindOfBuild(false, true, ".next")).toMatch(/--six checks a build with it/);
    expect(wrongKindOfBuild(false, false, ".next")).toBeNull();
    expect(wrongKindOfBuild(true, true, ".next-six")).toBeNull();
  });

  it("refuses to run when a draft has no adherent noun to look for", () => {
    const [first, ...rest] = DRAFT_SCHOOLS;
    const withoutNoun = { ...first, adherent: undefined };
    expect(() => draftNeedles(SIX_SCHOOLS_CSS, [withoutNoun, ...rest])).toThrowError(
      new RegExp(`${first.id} has no adherent noun`)
    );
    expect(() => draftNeedles(SIX_SCHOOLS_CSS, [...DRAFT_SCHOOLS])).not.toThrow();
  });

  it("refuses to run when the stylesheet lacks one of a draft's colour tokens", () => {
    const dir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-bundle-check-"));
    try {
      const css = fs.readFileSync(SIX_SCHOOLS_CSS, "utf8");
      const id = DRAFT_SCHOOLS[2].id;
      const without = css.replace(new RegExp(`\\s*--color-${id}-deep:[^;]*;`), "");
      expect(without).not.toBe(css);
      const file = path.join(dir, "six-schools.css");
      fs.writeFileSync(file, without);
      expect(() => draftNeedles(file)).toThrowError(new RegExp(`--color-${id}-deep`));
      expect(() => draftNeedles()).not.toThrow();
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
      // `npm run check:bundle` itself refuses this build; the suite only
      // reports what is in it.
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
