import fs from "node:fs";
import path from "node:path";
import { DRAFT_SCHOOLS } from "../src/lib/school-registry.drafts";

/**
 * Fails if a draft school's id, name, adherent noun or colour is in the
 * production client bundle, and, on a build made with `SIX_SCHOOLS=1`, if
 * one is missing from it.
 *
 * The Phase 1B guarantee is that no draft reaches a page or a bundle. The
 * first Phase 2B registry held all six schools in one client-safe module,
 * so "confucian", "Confucianism", "ubuntu" and "buddhist" shipped in
 * thirteen chunks under .next/static, including the ones for `/`, `/quiz`
 * and `/r/[id]`. Nothing in the repository noticed. This is what notices.
 *
 * Only .next/static is checked. Server output under .next/server is
 * allowed to hold them: /styleguide/drafts is the review route and is
 * preview-gated and server-rendered.
 *
 * Stage 5 builds the three behind `SIX_SCHOOLS` (docs/stage5-plan.md),
 * which next.config.ts reads when the build starts and writes into the
 * code as a constant. Which kind of build this is comes from the build
 * itself, `config.env` in its required-server-files.json, never from the
 * environment the check runs in, so a flag-on shell cannot excuse a
 * flag-off build or the other way round.
 *
 * - Without the flag, any of the strings below in .next/static fails the
 *   check, as it always has.
 * - With it, the three are meant to be there, and the check fails unless
 *   every one of the strings is, so a flag that did not take is noticed
 *   rather than passed as a quiet production build.
 *
 * The strings come from the drafts module, which is the same whatever the
 * flag says, and from src/app/six-schools.css, so a school added as a
 * draft tomorrow, or a colour added to that file, is covered without
 * touching this one.
 */

export interface BundleLeak {
  needle: string;
  file: string;
}

/** The build directory: `.next`, or `npm run check:bundle:six`'s own. */
export function buildDir(): string {
  return path.join(process.cwd(), process.env.SOPHECS_DIST_DIR || ".next");
}

export const CLIENT_DIR = path.join(buildDir(), "static");

/** The stylesheet only a SIX_SCHOOLS build includes. */
export const SIX_SCHOOLS_CSS = path.join(process.cwd(), "src", "app", "six-schools.css");

/**
 * Whether the build in `dir` was made with SIX_SCHOOLS, from what the
 * build recorded. Throws if it recorded nothing, rather than guessing.
 */
export function builtWithSixSchools(dir: string = buildDir()): boolean {
  const file = path.join(dir, "required-server-files.json");
  if (!fs.existsSync(file)) {
    throw new Error(`${path.relative(process.cwd(), file)} is missing: is ${dir} a build?`);
  }
  const recorded = JSON.parse(fs.readFileSync(file, "utf8")) as {
    config?: { env?: Record<string, string> };
  };
  const flag = recorded.config?.env?.SIX_SCHOOLS;
  if (flag !== "0" && flag !== "1") {
    throw new Error(
      `The build in ${dir} recorded SIX_SCHOOLS as ${JSON.stringify(flag)}, not "0" or "1": ` +
        `was it built before next.config.ts passed the flag through \`env\`?`
    );
  }
  return flag === "1";
}

/** Every hex colour the flag-only stylesheet defines, lower-cased. */
export function colourNeedles(cssFile: string = SIX_SCHOOLS_CSS): string[] {
  const css = fs.readFileSync(cssFile, "utf8");
  return [...new Set((css.match(/#[0-9a-f]{6}\b/gi) ?? []).map((h) => h.toLowerCase()))];
}

/**
 * Every string that would give a draft school away.
 *
 * Throws rather than return a short list: a draft with no adherent noun,
 * or a flag-only stylesheet with no colour, would let both directions of
 * the check pass without looking for what a flag-on build actually holds.
 */
export function draftNeedles(): string[] {
  const out = new Set<string>();
  for (const entry of DRAFT_SCHOOLS) {
    if (!entry.adherent || !entry.adherentPlural) {
      throw new Error(
        `${entry.id} has no adherent noun in school-registry.drafts.ts, ` +
          `so the check could not look for the one a SIX_SCHOOLS build shows.`
      );
    }
    out.add(entry.id);
    out.add(entry.name);
    out.add(entry.adherent);
    out.add(entry.adherentPlural);
  }
  const colours = colourNeedles();
  if (DRAFT_SCHOOLS.length > 0 && colours.length === 0) {
    throw new Error(`${path.relative(process.cwd(), SIX_SCHOOLS_CSS)} defines no colour to look for.`);
  }
  for (const hex of colours) out.add(hex);
  return [...out];
}

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(dir);
  return out;
}

// A colour is matched in any case, since a minifier may print either; a
// name or id exactly, as before.
function holds(text: string, lower: string, needle: string): boolean {
  return needle.startsWith("#") ? lower.includes(needle) : text.includes(needle);
}

/** Every needle found, with the file it was found in. */
export function findDraftLeaks(clientDir: string = CLIENT_DIR): BundleLeak[] {
  const needles = draftNeedles();
  const leaks: BundleLeak[] = [];
  for (const file of filesUnder(clientDir)) {
    const text = fs.readFileSync(file, "latin1");
    const lower = text.toLowerCase();
    for (const needle of needles) {
      if (holds(text, lower, needle)) {
        leaks.push({ needle, file: path.relative(process.cwd(), file) });
      }
    }
  }
  return leaks;
}

/** The needles a SIX_SCHOOLS build should hold and does not. */
export function findMissing(clientDir: string = CLIENT_DIR): string[] {
  const found = new Set(findDraftLeaks(clientDir).map((l) => l.needle));
  return draftNeedles().filter((n) => !found.has(n));
}

function main() {
  const dir = buildDir();
  if (!fs.existsSync(CLIENT_DIR)) {
    console.error(
      `No client bundle at ${path.relative(process.cwd(), CLIENT_DIR)}. ` +
        `Run \`npm run build\` first: this check has nothing to check without one.`
    );
    process.exit(1);
  }

  const needles = draftNeedles();
  const files = filesUnder(CLIENT_DIR).length;

  if (builtWithSixSchools(dir)) {
    const missing = findMissing();
    if (missing.length === 0) {
      console.log(
        `SIX_SCHOOLS build: every draft school is in the client bundle, as meant. ` +
          `${needles.length} strings found among ${files} files.`
      );
      return;
    }
    console.error(
      `SIX_SCHOOLS build, but these are missing from the client bundle:\n\n` +
        missing.map((n) => `  "${n}"`).join("\n") +
        `\n\nA build with the flag shows the three schools. If none of them is ` +
        `here, the flag did not reach the code: check \`env\` in next.config.ts.`
    );
    process.exit(1);
  }

  const leaks = findDraftLeaks();

  if (leaks.length === 0) {
    console.log(
      `No draft school in the client bundle. ` + `${needles.length} strings checked against ${files} files.`
    );
    return;
  }

  console.error(`Draft schools found in the production client bundle:\n`);
  const byNeedle = new Map<string, string[]>();
  for (const leak of leaks) {
    byNeedle.set(leak.needle, [...(byNeedle.get(leak.needle) ?? []), leak.file]);
  }
  for (const [needle, files] of byNeedle) {
    console.error(`  "${needle}" in ${files.length} file(s):`);
    for (const file of files.slice(0, 5)) console.error(`      ${file}`);
    if (files.length > 5) console.error(`      and ${files.length - 5} more`);
  }
  console.error(
    `\nA draft school must not reach a client bundle. Read it from ` +
      `src/lib/school-registry.drafts.ts, which is server-only, rather than ` +
      `enumerating every school in a module a client component imports; or, ` +
      `for Stage 5, put it behind \`process.env.SIX_SCHOOLS === "1"\` in the ` +
      `module that holds it (see SHOWN_DRAFTS in src/lib/school-registry.ts).`
  );
  process.exit(1);
}

// Run only as a script, not when a test imports the helpers above.
if (process.argv[1]?.includes("check-client-bundle")) main();
