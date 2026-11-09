// What an extension adds: the plan's rows that a plan ending at the run's
// previous end did not hold (Arthur, 2026-11-09, item 28: "keep hourly and
// cut what each run reads"). An extend reads and checks those, and counts
// for the rest, rather than reading the whole run back every hour.
//
// A row's place in a plan depends on one time only, the earliest end at
// which the generator keeps it (generate.ts):
// - an argument or a revision, its own time (`created_at`);
// - an account, its profile and its auth user, the sign-up;
// - a quiz result, its time or its account's sign-up, whichever is later
//   (a newcomer's first result is dated just before the sign-up and
//   written with the account);
// - everything else (challenges, exchanges and their turns, reading
//   answers, classes) belongs to the base window, which is in every plan.
// So a plan ending at T holds exactly the rows whose time is at or before
// T, and the rows new since T are those after it
// (tests/seed/window.test.ts holds the generator to that).

import type { Kind } from "./adapter";
import type { Dataset, Item } from "./generate";
import { phases } from "./engine";

/** The earliest end at which the generator keeps this row; -Infinity for the base window's own. */
export function keptFrom(kind: Kind, item: Item<Record<string, unknown>>, signups: ReadonlyMap<string, number>): number {
  const row = item.row as { created_at?: string; user_id?: string | null };
  switch (kind) {
    case "auth_user":
      return signups.get(item.rowId) ?? -Infinity;
    case "profile":
    case "debate":
      return Date.parse(String(row.created_at));
    case "quiz_result":
      return Math.max(Date.parse(String(row.created_at)), row.user_id ? (signups.get(row.user_id) ?? -Infinity) : -Infinity);
    default:
      return -Infinity;
  }
}

/** Each kind's logical ids that a plan ending at `since` did not hold. */
export function newSince(ds: Dataset, since: string): Map<Kind, Set<string>> {
  const t = Date.parse(since);
  const signups = new Map(ds.profiles.map((p) => [p.rowId, Date.parse(p.row.created_at)]));
  const out = new Map<Kind, Set<string>>();
  for (const p of phases(ds)) out.set(p.kind, new Set(p.items.filter((i) => keptFrom(p.kind, i, signups) > t).map((i) => i.logicalId)));
  return out;
}

/** The accounts with a new argument, revision or quiz result since `since`: the only profiles an extension can change. */
export function activeSince(ds: Dataset, fresh: Map<Kind, Set<string>>): Set<string> {
  const users = new Set<string>();
  const debates = fresh.get("debate") ?? new Set();
  const results = fresh.get("quiz_result") ?? new Set();
  for (const d of ds.debates) if (debates.has(d.logicalId)) users.add(d.row.user_id);
  for (const r of ds.quizResults) if (results.has(r.logicalId) && r.row.user_id) users.add(r.row.user_id);
  const profiles = fresh.get("profile") ?? new Set();
  for (const p of ds.profiles) if (profiles.has(p.logicalId)) users.add(p.rowId);
  return users;
}
