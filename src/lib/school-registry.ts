/**
 * The one place the product's schools are listed.
 *
 * Before this file there were twenty-six: three separate `SCHOOL_IDS`
 * constants, eleven `Record<SchoolId, …>` maps, five hand-written arrays
 * in components, a zod enum, a ternary chain, and four CHECK constraints
 * in the migrations. `docs/phase2-recon.md` has the inventory. The
 * compiler caught ten of them when the union widened and the tests caught
 * two; the rest would have carried on showing three schools for ever.
 *
 * Two lists, because the product needs two different answers:
 *
 * - `QUIZ_SCHOOLS` is what the quiz can sort somebody into. It stays the
 *   original three until there is a quiz v2, so the result triangle has
 *   three corners and the question bank's vectors keep their three keys.
 * - `SCHOOLS` is everything the product knows about, each with a status.
 *   A `draft` school is in the repository and reaches nothing a
 *   production reader can see.
 *
 * Nothing here is a colour. `colourToken` names a custom property
 * declared in globals.css; the literals behind those names live in
 * `card-tokens.ts`, which is the only file allowed to hold one. A school
 * with no token falls back to neutral ink everywhere, and never to
 * another school's colour.
 *
 * No `server-only` and no filesystem, so client components can import it.
 * `content/schools/*.md` is still the authority on a school's name and
 * status; `tests/school-registry.test.ts` fails if this file and those
 * files disagree.
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
   * say", not "what a Stoicism would say". Absent where nobody has
   * written one; the accessors fall back to the name, and a published
   * school without one fails the suite rather than rendering the
   * fallback.
   */
  adherent?: string;
  adherentPlural?: string;
  /**
   * The globals.css custom property carrying the school's colour, matching
   * `colour_token` in the content file. Null for a school that has no
   * colour yet.
   */
  colourToken: string | null;
}

/**
 * Every school, in the order the product shows them. The original three
 * come first and keep the order they have had since Phase 1, because that
 * order is what the footer, the landing page, the lessons index, the
 * school table and the sitemap all render.
 */
export const SCHOOLS: readonly SchoolEntry[] = [
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
  { id: "confucian", status: "draft", name: "Confucianism", colourToken: null },
  { id: "ubuntu", status: "draft", name: "Ubuntu", colourToken: null },
  { id: "buddhist", status: "draft", name: "Buddhist Ethics", colourToken: null },
];

/** What the quiz can sort into. Not derived from `SCHOOLS`: a school being published does not make it a quiz outcome. */
export const QUIZ_SCHOOLS: readonly QuizSchoolId[] = [
  "stoicism",
  "utilitarianism",
  "virtue-ethics",
];

/** Every school id, drafts included. For validating a string, not for rendering. */
export const ALL_SCHOOL_IDS: readonly SchoolId[] = SCHOOLS.map((s) => s.id);

/** The schools a production reader can see. Every public surface iterates this. */
export const PUBLISHED_SCHOOL_IDS: readonly SchoolId[] = SCHOOLS.filter(
  (s) => s.status === "published"
).map((s) => s.id);

const BY_ID = new Map<SchoolId, SchoolEntry>(SCHOOLS.map((s) => [s.id, s]));

/**
 * A school's entry. Throws on an unknown id rather than returning
 * undefined: every caller here holds a `SchoolId`, so a miss is a
 * registry that has lost a school rather than a case to render around.
 * A string from content or a URL goes through `knownSchool` first.
 */
export function schoolEntry(id: SchoolId): SchoolEntry {
  const entry = BY_ID.get(id);
  if (!entry) throw new Error(`school-registry: no entry for "${id}"`);
  return entry;
}

/** Whether a string names a school the product has, draft or published. */
export function knownSchool(id: string): id is SchoolId {
  return BY_ID.has(id as SchoolId);
}

export function isPublished(id: SchoolId): boolean {
  return schoolEntry(id).status === "published";
}

export function isQuizSchool(id: SchoolId): id is QuizSchoolId {
  return (QUIZ_SCHOOLS as readonly string[]).includes(id);
}

/** The display name. Always present. */
export function schoolName(id: SchoolId): string {
  return schoolEntry(id).name;
}

/** "Stoic". Falls back to the display name where nobody has written one. */
export function schoolAdherent(id: SchoolId): string {
  const entry = schoolEntry(id);
  return entry.adherent ?? entry.name;
}

/** "Stoics". Falls back to the display name where nobody has written one. */
export function schoolAdherentPlural(id: SchoolId): string {
  const entry = schoolEntry(id);
  return entry.adherentPlural ?? entry.name;
}

/**
 * A CSS `var()` reference to the school's colour, or to neutral ink for a
 * school that has none. Never another school's colour.
 */
export function schoolColourVar(id: SchoolId): string {
  const token = schoolEntry(id).colourToken;
  return token ? `var(${token})` : "var(--color-ink)";
}

/** The same, for the deeper shade a chunky control's bottom edge uses. */
export function schoolShadeVar(id: SchoolId): string {
  const token = schoolEntry(id).colourToken;
  return token ? `var(${token}-deep)` : "var(--color-ink)";
}

/**
 * Builds a total record over every school from a partial map, filling the
 * gaps with a neutral. The per-school maps that have to hold literals
 * (Tailwind class names, Satori hexes) stay partial and go through this,
 * so a school without an entry gets the neutral rather than the first
 * key's value or `undefined`.
 */
export function totalOverSchools<T>(
  partial: Partial<Record<SchoolId, T>>,
  neutral: T
): Record<SchoolId, T> {
  return Object.fromEntries(
    ALL_SCHOOL_IDS.map((id) => [id, partial[id] ?? neutral])
  ) as Record<SchoolId, T>;
}
