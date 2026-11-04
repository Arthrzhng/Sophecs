// Migration 0022 leaves anon and authenticated only the table writes the
// site makes with a client key. A new write through the signed-in client
// would pass every other unit test and then fail in production with
// "permission denied", so this finds every `.from(...)` chain in src/ that
// ends in a write, and every `.rpc(...)`, works out whether its receiver
// is the admin client, and holds the rest to the site's client writes:
// the three 0022 keeps and the reading-answer upsert it does not touch.
// scripts/test-0022-client-write-grants.sh proves each still works against
// the migrated database.
//
// What it cannot see: a client passed through a variable it cannot trace
// (it accepts a parameter only when it is named `admin` and typed
// SupabaseClient, as the helpers in src/lib are, and only if no variable
// named `admin` in that file comes from another factory), a table name
// built at run time on the admin client, or a write made by a library on
// the site's behalf. Anything it cannot classify is reported, not passed.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(name) ? [p] : [];
  });
}

/** Index of the bracket matching the one at `open`, scanning forward or back. */
function match(src: string, open: number, dir: 1 | -1): number {
  const [o, c] = dir === 1 ? ["(", ")"] : [")", "("];
  let depth = 0;
  for (let i = open; i >= 0 && i < src.length; i += dir) {
    if (src[i] === o) depth++;
    else if (src[i] === c && --depth === 0) return i;
  }
  return -1;
}

/** The receiver of a call at `at` (the index of its `.`): a variable, or "call:<callee>". */
function receiverOf(src: string, at: number): string {
  let i = at - 1;
  for (;;) {
    while (i >= 0 && /\s/.test(src[i])) i--;
    if (src[i] === ")") {
      const open = match(src, i, -1);
      let j = open - 1;
      while (j >= 0 && /[\w$]/.test(src[j])) j--;
      const callee = src.slice(j + 1, open);
      if (src[j] === ".") {
        i = j - 1; // a method on something: keep walking left
        continue;
      }
      // (await f()) or f() or (x)
      if (!callee) {
        const inner = src.slice(open + 1, i).replace(/^\s*await\s+/, "").trim();
        const m = /^([\w$.]+)\(/.exec(inner);
        return m ? `call:${m[1]}` : `expr:${inner}`;
      }
      return `call:${callee}`;
    }
    let j = i;
    while (j >= 0 && /[\w$]/.test(src[j])) j--;
    return src.slice(j + 1, i + 1);
  }
}

const KEPT = new Set(["createAdminClient"]);

function clientWritesIn(file: string, src: string, seen?: { admin: number }): string[] {
  const declared = new Map<string, string>();
  for (const m of src.matchAll(/(?:const|let|var)\s+([\w$]+)\s*(?::[^=;]+)?=\s*(?:await\s+)?([\w$.]+)\(/g)) {
    if (declared.has(m[1]) && declared.get(m[1]) !== m[2]) declared.set(m[1], "(several)");
    else declared.set(m[1], m[2]);
  }
  const adminParam = /\badmin\s*:\s*SupabaseClient\b/.test(src) && (declared.get("admin") ?? "createAdminClient") === "createAdminClient";
  const isAdmin = (r: string) =>
    r === "call:createAdminClient" || KEPT.has(declared.get(r) ?? "") || (r === "admin" && !declared.has("admin") && adminParam);

  const out: string[] = [];
  for (const m of src.matchAll(/\.(from|rpc)\s*\(/g)) {
    const dot = m.index!;
    const open = dot + m[0].length - 1;
    const close = match(src, open, 1);
    const arg = src.slice(open + 1, close).trim();
    const receiver = receiverOf(src, dot);
    if (m[1] === "rpc") {
      if (!isAdmin(receiver)) out.push(`${file}: rpc ${arg.split(",")[0]} (receiver ${receiver})`);
      continue;
    }
    // Array.from, Buffer.from and the like.
    if (/^[A-Z]/.test(receiver)) continue;
    // The rest of this chain, up to the end of the statement.
    let end = close + 1;
    for (let depth = 0; end < src.length; end++) {
      const ch = src[end];
      if (ch === "(" || ch === "{" || ch === "[") depth++;
      else if (ch === ")" || ch === "}" || ch === "]") {
        if (depth === 0) break;
        depth--;
      } else if (ch === ";" && depth === 0) break;
    }
    const chain = src.slice(close + 1, end);
    const w = /^\s*(?:\.\s*\w+\s*\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)\s*)*?\.\s*(insert|update|upsert|delete)\s*\(/.exec(chain);
    if (!w) continue;
    if (isAdmin(receiver)) {
      if (seen) seen.admin++;
      continue;
    }
    const lit = /^(["'`])([\w]+)\1$/.exec(arg);
    const table = lit ? lit[2] : `dynamic(${arg})`;
    let cols = "";
    if (w[1] === "update") {
      const at = close + 1 + w.index! + w[0].length - 1;
      const body = src.slice(at + 1, match(src, at, 1));
      cols = ` ${[...body.matchAll(/([\w$]+)\s*:/g)].map((c) => c[1]).join(",")}`;
    }
    out.push(`${file}: ${table} ${w[1]}${cols}${receiver === "supabase" ? "" : ` (receiver ${receiver})`}`);
  }
  return out;
}

const seen = { admin: 0 };
function clientWrites() {
  seen.admin = 0;
  return files("src")
    .flatMap((f) => clientWritesIn(f.replaceAll("\\", "/"), readFileSync(f, "utf8"), seen))
    .sort();
}

describe("writes made with a client key (migration 0022)", () => {
  it("are the three 0022 keeps and the reading-answer upsert, and no other", () => {
    expect(clientWrites()).toEqual([
      "src/app/debate/actions.ts: reading_responses upsert",
      "src/app/me/actions.ts: class_members delete",
      "src/app/me/actions.ts: profiles update argument_default_public",
      "src/app/me/actions.ts: profiles update display_name",
    ]);
    // And it does see the server's own writes, so the list above is not
    // short because the scan found nothing.
    expect(seen.admin).toBeGreaterThan(40);
  });

  it("sees a write through a session client however it is reached", () => {
    const cases: [string, string][] = [
      ['const supabase = await createSupabaseServerClient();\nawait supabase\n  .from("debates")\n  .insert({ id });', "debates insert"],
      ['const admin = await createSupabaseServerClient();\nawait admin.from("debates").insert({ id });', "debates insert (receiver admin)"],
      ['await (await createSupabaseServerClient()).from("debates").insert({ id });', "debates insert (receiver call:createSupabaseServerClient)"],
      ["const supabase = await createSupabaseServerClient();\nawait supabase.from('quiz_results').insert({ id });", "quiz_results insert"],
      ['const supabase = await createSupabaseServerClient();\nawait supabase.schema("public").from("challenges").update({ status: "x" }).eq("id", id);', "challenges update status"],
      ["const supabase = await createSupabaseServerClient();\nawait supabase.from(t).delete().eq('id', id);", "dynamic(t) delete"],
      ['const supabase = await createSupabaseServerClient();\nawait supabase.rpc("anything", {});', 'rpc "anything" (receiver supabase)'],
    ];
    for (const [src, want] of cases) expect(clientWritesIn("x.ts", src), src).toEqual([`x.ts: ${want}`]);
  });

  it("passes the admin client, a helper's admin parameter and reads", () => {
    const ok = [
      'const admin = createAdminClient();\nawait admin.from("debates").insert({ id });',
      'async function f(admin: SupabaseClient) { await admin.from("profiles").update({ elo: 1 }).eq("id", id); }',
      'const supabase = await createSupabaseServerClient();\nconst { data } = await supabase.from("profiles").select("id").eq("id", id);',
      "const xs = Array.from({ length: 3 }, (_, i) => i);",
    ];
    for (const src of ok) expect(clientWritesIn("x.ts", src), src).toEqual([]);
  });
});
