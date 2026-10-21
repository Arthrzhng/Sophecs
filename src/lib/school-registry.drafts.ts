import "server-only";
import {
  PUBLISHED_SCHOOLS,
  publishedEntry,
  type SchoolEntry,
  type SchoolId,
} from "./school-registry";

/**
 * The schools that are in the repository and reach no reader.
 *
 * `server-only`, and that is the whole point of the file. A draft
 * school's id and name are unreleased product decisions, and the Phase 1B
 * guarantee is that no draft reaches a page or a bundle. Importing this
 * from a client component fails the build rather than shipping
 * "Confucianism" to a browser.
 *
 * Three things legitimately need to see a draft: `/styleguide/drafts`,
 * which is the preview-only review route; the content loaders, which have
 * to recognise a draft school in order to skip it; and the tests, which
 * check this file and `school-registry.ts` against `content/schools/*.md`
 * between them.
 *
 * Every entry here carries `status: "draft"`, and nothing published
 * belongs in it. `tests/school-registry.test.ts` fails if the two files
 * overlap, if either disagrees with the content files, or if a draft here
 * has a colour token.
 */
export const DRAFT_SCHOOLS: readonly SchoolEntry[] = [
  { id: "confucian", status: "draft", name: "Confucianism", colourToken: null },
  { id: "ubuntu", status: "draft", name: "Ubuntu", colourToken: null },
  { id: "buddhist", status: "draft", name: "Buddhist Ethics", colourToken: null },
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
