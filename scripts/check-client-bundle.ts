import fs from "node:fs";
import path from "node:path";
import { DRAFT_SCHOOLS } from "../src/lib/school-registry.drafts";

/**
 * Fails if a draft school's id or name is in the production client
 * bundle.
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
 * The strings come from the registry, so a school added as a draft
 * tomorrow is covered without touching this file.
 */

export interface BundleLeak {
  needle: string;
  file: string;
}

export const CLIENT_DIR = path.join(process.cwd(), ".next", "static");

/** Every string that would give a draft school away. */
export function draftNeedles(): string[] {
  const out = new Set<string>();
  for (const entry of DRAFT_SCHOOLS) {
    out.add(entry.id);
    out.add(entry.name);
    if (entry.adherent) out.add(entry.adherent);
    if (entry.adherentPlural) out.add(entry.adherentPlural);
  }
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

export function findDraftLeaks(clientDir: string = CLIENT_DIR): BundleLeak[] {
  const needles = draftNeedles();
  const leaks: BundleLeak[] = [];
  for (const file of filesUnder(clientDir)) {
    const text = fs.readFileSync(file, "latin1");
    for (const needle of needles) {
      if (text.includes(needle)) {
        leaks.push({ needle, file: path.relative(process.cwd(), file) });
      }
    }
  }
  return leaks;
}

function main() {
  if (!fs.existsSync(CLIENT_DIR)) {
    console.error(
      `No client bundle at ${path.relative(process.cwd(), CLIENT_DIR)}. ` +
        `Run \`npm run build\` first: this check has nothing to check without one.`
    );
    process.exit(1);
  }

  const needles = draftNeedles();
  const leaks = findDraftLeaks();

  if (leaks.length === 0) {
    console.log(
      `No draft school in the client bundle. ` +
        `${needles.length} strings checked against ${filesUnder(CLIENT_DIR).length} files.`
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
      `enumerating every school in a module a client component imports.`
  );
  process.exit(1);
}

// Run only as a script, not when a test imports the helpers above.
if (process.argv[1]?.includes("check-client-bundle")) main();
