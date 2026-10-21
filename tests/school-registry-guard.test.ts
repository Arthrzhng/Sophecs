import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { ALL_SCHOOL_IDS } from "../src/lib/school-registry.drafts";

/**
 * Fails if a hard-coded school list or a per-school map appears outside
 * the registry.
 *
 * The registry exists because twenty-six places listed the schools and ten
 * of them would have gone on listing three for ever (see
 * docs/phase2-recon.md). Nothing stops a twenty-seventh being written
 * except this test.
 *
 * The rule: in application source, two or more school ids as string
 * literals in one file is an enumeration. One is not: a default, a demo
 * prop or a single named example is fine, and those are common.
 */

// Directories scanned. `content/` is frozen and `supabase/` is SQL rather
// than TypeScript, so the CHECK constraints there are 2C's to move; this
// test cannot see them.
const ROOTS = ["src", "scripts"];

/**
 * Files allowed to enumerate schools, each because it is part of the
 * registry or cannot be derived from it.
 *
 * A new entry here is a decision, not a formality: it means a school added
 * to the registry will not reach that file on its own.
 */
const REGISTRY_FILES: Record<string, string> = {
  "src/lib/school-registry.ts":
    "The registry's client-safe half. This is the one file the published list is written down in, and the reason the others do not.",
  "src/lib/school-registry.drafts.ts":
    "The registry's server-only half. The draft entries live here so that no draft school's id or name can reach a production client bundle.",
  "src/lib/card-tokens.ts":
    "The only file allowed a colour literal, because Satori cannot read CSS custom properties. Its maps are partial and go through totalOverSchools.",
  "src/lib/school-colors.ts":
    "Holds the Tailwind class names, which have to appear as literals or v4's scanner never generates the utilities.",
  "src/lib/judge/rubric.ts":
    "The fidelity criteria, which are judge content and Arthur's to write. Partial, and reading a school that has none throws.",
  "src/lib/arena-fixtures.ts":
    "Fixture data for /styleguide/arena, which is preview-only. Demo rows naming schools, not a list the product reads.",
  "src/app/styleguide/arena/page.tsx":
    "Preview-only. Renders one block per school deliberately, to show each colour beside the others.",
};

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
  };
  for (const root of ROOTS) walk(path.join(process.cwd(), root));
  return out.map((f) => path.relative(process.cwd(), f));
}

/**
 * Comments stripped, so the guard reads code rather than prose. A comment
 * explaining why a school id must not appear is not a school id
 * appearing.
 *
 * `//` is only treated as a comment when it is not preceded by a colon,
 * so a `https://` inside a string literal does not swallow the rest of
 * its line.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** School ids appearing as a quoted string literal, in code. */
function enumeratedIn(source: string): string[] {
  const code = withoutComments(source);
  return ALL_SCHOOL_IDS.filter((id) => {
    const quoted = new RegExp(`['"\`]${id}['"\`]`);
    return quoted.test(code);
  });
}

describe("the school registry guard", () => {
  const files = sourceFiles();

  it("has source to scan", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("finds no hard-coded school list or per-school map outside the registry", () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (file in REGISTRY_FILES) continue;
      const found = enumeratedIn(fs.readFileSync(file, "utf-8"));
      if (found.length >= 2) offenders.push(`${file}: ${found.join(", ")}`);
    }
    expect(
      offenders,
      "Read the schools from src/lib/school-registry.ts instead, or add the file to REGISTRY_FILES with a reason"
    ).toEqual([]);
  });

  it("allows only files that exist, so the list cannot rot", () => {
    for (const file of Object.keys(REGISTRY_FILES)) {
      expect(fs.existsSync(path.join(process.cwd(), file)), file).toBe(true);
    }
  });

  it("gives a reason for every file it allows", () => {
    for (const [file, reason] of Object.entries(REGISTRY_FILES)) {
      expect(reason.length, file).toBeGreaterThan(40);
    }
  });

  // The guard's own teeth, checked against text rather than the tree, so a
  // regression in the matcher shows up here and not as a quiet pass.
  it("catches a list", () => {
    expect(
      enumeratedIn('const SCHOOLS = ["stoicism", "utilitarianism", "virtue-ethics"];').length
    ).toBe(3);
  });

  it("catches a per-school map", () => {
    expect(
      enumeratedIn('const M = { stoicism: 1, "virtue-ethics": 2 };').length
    ).toBeGreaterThanOrEqual(1);
    expect(
      enumeratedIn('const M = { "stoicism": 1, "virtue-ethics": 2 };').length
    ).toBe(2);
  });

  it("catches a map keyed on a new school too", () => {
    expect(enumeratedIn('const M = { "ubuntu": 1, "buddhist": 2 };').length).toBe(2);
  });

  it("ignores school ids quoted in a comment", () => {
    expect(
      enumeratedIn('// "confucian", "ubuntu" and "buddhist" must not ship.').length
    ).toBe(0);
    expect(
      enumeratedIn('/* "stoicism" and "utilitarianism" are published. */').length
    ).toBe(0);
  });

  it("is not fooled by a url into skipping the rest of a line", () => {
    expect(
      enumeratedIn('const a = "https://x.test"; const m = { "ubuntu": 1, "buddhist": 2 };').length
    ).toBe(2);
  });

  it("leaves a single named school alone", () => {
    expect(enumeratedIn('let school: SchoolId = "stoicism";').length).toBe(1);
    expect(enumeratedIn('<Verdict school="utilitarianism" />').length).toBe(1);
  });
});
