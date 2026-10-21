/**
 * The one place the product's published schools are listed.
 *
 * Before this file there were twenty-six: three separate `SCHOOL_IDS`
 * constants, eleven `Record<SchoolId, …>` maps, five hand-written arrays
 * in components, a zod enum, a ternary chain, and four CHECK constraints
 * in the migrations. `docs/phase2-recon.md` has the inventory.
 *
 * Two lists, because the product needs two different answers:
 *
 * - `QUIZ_SCHOOLS` is what the quiz can sort somebody into. It stays the
 *   original three until there is a quiz v2, so the result triangle has
 *   three corners and the question bank's vectors keep their three keys.
 * - `PUBLISHED_SCHOOLS` is what a reader can see. Every public surface
 *   iterates it.
 *
 * **Draft schools are not here.** They are in
 * `school-registry.drafts.ts`, which is `server-only`, because a draft
 * school's id and name are unreleased product decisions and the Phase 1B
 * guarantee is that no draft reaches a page or a bundle. This file ships
 * to the browser; that one cannot. The first attempt at this registry
 * held all six entries and put "confucian", "Confucianism", "ubuntu" and
 * "buddhist" into thirteen production client chunks, which is the thing
 * the draft gate exists to prevent.
 *
 * The split is also what makes the fallback rule true by construction
 * rather than by diligence. Everything keyed by school goes through
 * `publishedLookup`, which answers for a published school and gives a
 * neutral for anything else. A draft renders in neutral ink because the
 * client does not know it, not because somebody remembered to write an
 * `?? ink`.
 *
 * `SchoolId` still names all six, which costs nothing: a type is erased
 * before the bundle exists. Only values reach the browser.
 *
 * No `server-only` and no filesystem here, so client components can
 * import it. `content/schools/*.md` remains the authority on a school's
 * name and status; `tests/school-registry.test.ts` fails if this file,
 * the drafts file and those files disagree.
 */

/** The schools the quiz sorts into. Three until quiz v2. */
export type QuizSchoolId = "stoicism" | "utilitarianism" | "virtue-ethics";

/** Every school the product knows about, published or draft. */
export type SchoolId = QuizSchoolId | "confucian" | "ubuntu" | "buddhist";

export type SchoolStatus = "published" | "draft";

export interface SchoolEntry {
  id: SchoolId;
  status: SchoolStatus;
  /** Display name, matching `name` in the school's content file. */
  name: string;
  /**
   * What you call a person arguing from the school: "what a Stoic would
   * say", not "what a Stoicism would say". Required of a published
   * school, and `tests/school-registry.test.ts` fails without it.
   */
  adherent?: string;
  adherentPlural?: string;
  /**
   * The globals.css custom property carrying the school's colour, matching
   * `colour_token` in the content file. Null for a school that has none.
   */
  colourToken: string | null;
}

/**
 * The published schools, in the order the product shows them. That order
 * is what the footer, the landing page, the lessons index, the school
 * table, the sitemap and the landing card's hairline all render.
 */
export const PUBLISHED_SCHOOLS: readonly SchoolEntry[] = [
  {
    id: "stoicism",
    status: "published",
    name: "Stoicism",
    adherent: "Stoic",
    adherentPlural: "Stoics",
    colourToken: "--color-stoic",
  },
  {
    id: "utilitarianism",
    status: "published",
    name: "Utilitarianism",
    adherent: "Utilitarian",
    adherentPlural: "Utilitarians",
    colourToken: "--color-utilitarian",
  },
  {
    id: "virtue-ethics",
    status: "published",
    name: "Virtue Ethics",
    adherent: "Virtue Ethicist",
    adherentPlural: "Virtue Ethicists",
    colourToken: "--color-virtue",
  },
];

/** What the quiz can sort into. Not derived: a school being published does not make it a quiz outcome. */
export const QUIZ_SCHOOLS: readonly QuizSchoolId[] = [
  "stoicism",
  "utilitarianism",
  "virtue-ethics",
];

/** The schools a production reader can see. Every public surface iterates this. */
export const PUBLISHED_SCHOOL_IDS: readonly SchoolId[] = PUBLISHED_SCHOOLS.map((s) => s.id);

const PUBLISHED_BY_ID = new Map<SchoolId, SchoolEntry>(
  PUBLISHED_SCHOOLS.map((s) => [s.id, s])
);

/**
 * A published school's entry, or null for one this module does not hold:
 * a draft, or a string from a database row written by a later version of
 * the app. Null is the honest answer here rather than an error, because
 * the caller's job is to render a fallback.
 */
export function publishedEntry(id: SchoolId): SchoolEntry | null {
  return PUBLISHED_BY_ID.get(id) ?? null;
}

export function isPublished(id: SchoolId): boolean {
  return PUBLISHED_BY_ID.has(id);
}

export function isQuizSchool(id: SchoolId): id is QuizSchoolId {
  return (QUIZ_SCHOOLS as readonly string[]).includes(id);
}

/**
 * The display name of a published school, or the raw id for anything
 * else.
 *
 * The id is the right fallback: it is true, it is not another school's
 * name, and it is not the string "undefined". A draft school's real name
 * comes from `schoolDisplayName` in the drafts module, which only server
 * code can reach.
 */
export function schoolName(id: SchoolId): string {
  return publishedEntry(id)?.name ?? id;
}

/** "Stoic". The display name where nobody has written one. */
export function schoolAdherent(id: SchoolId): string {
  const entry = publishedEntry(id);
  return entry?.adherent ?? schoolName(id);
}

/** "Stoics". The display name where nobody has written one. */
export function schoolAdherentPlural(id: SchoolId): string {
  const entry = publishedEntry(id);
  return entry?.adherentPlural ?? schoolName(id);
}

/**
 * A CSS `var()` reference to the school's colour, or to neutral ink for a
 * school this module has no colour for. Never another school's colour.
 */
export function schoolColourVar(id: SchoolId): string {
  const token = publishedEntry(id)?.colourToken;
  return token ? `var(${token})` : "var(--color-ink)";
}

/** The same, for the deeper shade a chunky control's bottom edge uses. */
export function schoolShadeVar(id: SchoolId): string {
  const token = publishedEntry(id)?.colourToken;
  return token ? `var(${token}-deep)` : "var(--color-ink)";
}

/**
 * A map over every school, built from the published ones alone.
 *
 * Reads as an ordinary `Record<SchoolId, T>`, which is what the sixty-odd
 * call sites and the judge path expect, but holds only the published
 * entries. A school it does not hold gets `neutral`, computed from the id
 * so a name can fall back to the id while a colour falls back to ink.
 *
 * A plain object cannot do this job. To answer for every `SchoolId` it
 * would need a key per school, and a draft school's key is an unreleased
 * product decision sitting in the production client bundle. That is
 * exactly the regression this replaced:
 * `scripts/check-client-bundle.ts` is the test that it stays replaced.
 *
 * `Object.keys` and spread see the published entries, which is what every
 * caller that enumerates wants.
 */
export function publishedLookup<T>(
  entries: Partial<Record<SchoolId, T>>,
  neutral: (id: SchoolId) => T
): Record<SchoolId, T> {
  const held = Object.fromEntries(
    PUBLISHED_SCHOOL_IDS.filter((id) => entries[id] !== undefined).map((id) => [
      id,
      entries[id] as T,
    ])
  ) as Record<SchoolId, T>;

  return new Proxy(held, {
    get(target, key: string) {
      const value = target[key as SchoolId];
      return value === undefined ? neutral(key as SchoolId) : value;
    },
    has() {
      return true;
    },
  });
}
