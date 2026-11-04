// Migration 0022 leaves anon and authenticated only the table writes the
// site makes with a client key. A new write through the signed-in client
// would pass every unit test here and then fail in production with
// "permission denied", so this lists every write in src/ that is not made
// with the admin client and holds it to the four 0022 keeps.
// scripts/test-0022-client-write-grants.sh proves each of the four still
// works against the migrated database.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(name) ? [p] : [];
  });
}

const WRITE = /(\w+)\s*\.from\("(\w+)"\)\s*\.(insert|update|upsert|delete)\(\s*(\{[^}]*\})?/g;

function clientWrites() {
  const out: string[] = [];
  for (const f of files("src")) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(WRITE)) {
      if (m[1] === "admin") continue;
      const cols = m[3] === "update" && m[4] ? ` ${[...m[4].matchAll(/(\w+)\s*:/g)].map((c) => c[1]).join(",")}` : "";
      out.push(`${f.replaceAll("\\", "/")}: ${m[2]} ${m[3]}${cols}`);
    }
  }
  return out.sort();
}

describe("writes made with a client key (migration 0022)", () => {
  it("are the four 0022 keeps, and no other", () => {
    expect(clientWrites()).toEqual([
      "src/app/debate/actions.ts: reading_responses upsert",
      "src/app/me/actions.ts: class_members delete",
      "src/app/me/actions.ts: profiles update argument_default_public",
      "src/app/me/actions.ts: profiles update display_name",
    ]);
  });

  it("finds a write through the signed-in client", () => {
    const src = 'const { error } = await supabase\n  .from("debates")\n  .insert({ id });';
    expect([...src.matchAll(WRITE)].map((m) => `${m[1]} ${m[2]} ${m[3]}`)).toEqual(["supabase debates insert"]);
  });
});
