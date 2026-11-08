import "server-only";
import {
  PUBLISHED_SCHOOLS,
  publishedEntry,
  type SchoolEntry,
  type SchoolId,
} from "./school-registry";

/**
 * The three schools only a `SIX_SCHOOLS` build shows: drafts until the
 * launch, published since (Arthur, 2026-11-08, "Launch: approved"), with
 * the flag set for Production and Preview. The name of the list is from
 * before the launch.
 *
 * `server-only`, and that is still the point of the file: a build without
 * the flag must carry none of these ids, names or colours to a browser,
 * and importing this from a client component fails the build. The content
 * loaders read it to skip the three on such a build, `npm run
 * check:bundle` takes its strings from it (so the check never runs on an
 * empty list), and the tests check it and `school-registry.ts` against
 * `content/schools/*.md` between them.
 *
 * The same list whether or not the build has the flag. The adherent nouns,
 * accepted by Arthur at Checkpoint B (e) 1, and the colour tokens are the
 * same as the registry's `SHOWN_DRAFTS`, which a flag-on build shows, and
 * the same as the content files'.
 */
export const DRAFT_SCHOOLS: readonly SchoolEntry[] = [
  {
    id: "confucian",
    status: "published",
    name: "Confucianism",
    adherent: "Confucian",
    adherentPlural: "Confucians",
    colourToken: "--color-confucian",
  },
  {
    id: "ubuntu",
    status: "published",
    name: "Ubuntu",
    adherent: "Ubuntu Ethicist",
    adherentPlural: "Ubuntu Ethicists",
    adherentArticle: "an",
    colourToken: "--color-ubuntu",
  },
  {
    id: "buddhist",
    status: "published",
    name: "Buddhist Ethics",
    adherent: "Buddhist Ethicist",
    adherentPlural: "Buddhist Ethicists",
    colourToken: "--color-buddhist",
  },
];

/** Every school the product knows about, published first, then drafts. */
export const ALL_SCHOOLS: readonly SchoolEntry[] = [
  ...PUBLISHED_SCHOOLS,
  ...DRAFT_SCHOOLS,
];

export const ALL_SCHOOL_IDS: readonly SchoolId[] = ALL_SCHOOLS.map((s) => s.id);

export const DRAFT_SCHOOL_IDS: readonly SchoolId[] = DRAFT_SCHOOLS.map((s) => s.id);

const BY_ID = new Map<SchoolId, SchoolEntry>(ALL_SCHOOLS.map((s) => [s.id, s]));

/** Whether a string names a school the product has, draft or published. */
export function knownSchool(id: string): id is SchoolId {
  return BY_ID.has(id as SchoolId);
}

/**
 * Any school's entry, drafts included, or null for a string that is not a
 * school at all.
 */
export function schoolEntry(id: SchoolId): SchoolEntry | null {
  return BY_ID.get(id) ?? null;
}

/**
 * A school's real display name, drafts included.
 *
 * The client-safe `schoolName` falls back to the raw id for a draft,
 * because it has no name to give. Server code reviewing drafts wants the
 * name, and this is the only way to get it.
 */
export function schoolDisplayName(id: SchoolId): string {
  return schoolEntry(id)?.name ?? publishedEntry(id)?.name ?? id;
}
