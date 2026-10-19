import type { TopicFile } from "./topics";

/**
 * What `npm run seed:topics` would change in `debate_topics`, worked out
 * without touching the database.
 *
 * Pure, and free of `server-only`, so the dry-run script and a unit test
 * can both use it. The seeder itself is untouched: this exists so that a
 * motion reword can be read field by field before anyone writes to a live
 * database, which is the one step in the content pipeline that has no
 * preview and no undo.
 *
 * `par_elo` and `par_n` are deliberately absent from `SEEDED_FIELDS`, for
 * the same reason they are absent from the seeder's payload. They are
 * written by /api/judge as real debates happen, and a content edit must
 * never reset them.
 */
export const SEEDED_FIELDS = [
  "title",
  "motion",
  "stances",
  "micro_before",
  "micro_after",
  "sort",
  "active",
] as const;

export type SeededField = (typeof SEEDED_FIELDS)[number];

/** A row as it stands in `debate_topics`, so far as the seeder touches it. */
export interface TopicRow {
  slug: string;
  title?: unknown;
  motion?: unknown;
  stances?: unknown;
  micro_before?: unknown;
  micro_after?: unknown;
  sort?: unknown;
  active?: unknown;
}

export interface FieldChange {
  field: SeededField;
  before: unknown;
  after: unknown;
}

export interface TopicDiff {
  slug: string;
  /** `insert` when no row carries this slug yet, otherwise `update`. */
  kind: "insert" | "update" | "unchanged";
  changes: FieldChange[];
}

export interface SeedDiff {
  topics: TopicDiff[];
  /** Rows in the table that no file claims. The seeder never deletes. */
  orphanedSlugs: string[];
}

function payloadOf(topic: TopicFile): Record<SeededField, unknown> {
  return {
    title: topic.title,
    motion: topic.motion,
    stances: topic.stances,
    micro_before: topic.micro_before,
    micro_after: topic.micro_after,
    sort: topic.sort ?? 0,
    active: topic.active ?? true,
  };
}

// Compared by value, not identity: `stances` is an object, and reading it
// back from Postgres gives a different object with the same contents. Key
// order can differ between the file and the column, so the comparison
// sorts keys rather than trusting JSON.stringify's insertion order.
function sameValue(a: unknown, b: unknown): boolean {
  return stable(a) === stable(b);
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
}

export function seedDiff(topics: TopicFile[], rows: TopicRow[]): SeedDiff {
  const bySlug = new Map(rows.map((row) => [row.slug, row]));

  const diffs: TopicDiff[] = topics.map((topic) => {
    const row = bySlug.get(topic.slug);
    const payload = payloadOf(topic);
    if (!row) {
      return {
        slug: topic.slug,
        kind: "insert",
        changes: SEEDED_FIELDS.map((field) => ({
          field,
          before: undefined,
          after: payload[field],
        })),
      };
    }
    const changes = SEEDED_FIELDS.filter(
      (field) => !sameValue(row[field], payload[field])
    ).map((field) => ({ field, before: row[field], after: payload[field] }));
    return { slug: topic.slug, kind: changes.length > 0 ? "update" : "unchanged", changes };
  });

  const claimed = new Set(topics.map((t) => t.slug));
  return {
    topics: diffs,
    orphanedSlugs: rows.map((r) => r.slug).filter((slug) => !claimed.has(slug)),
  };
}
