// Migration 0022 leaves anon and authenticated only the table writes the
// site makes with a client key. A new write through the signed-in client
// would pass every other unit test and then fail in production with
// "permission denied". So this finds every `.from(...)` and `.rpc(...)` in
// src/, works out whether its receiver is the admin client, and reports
// every one that is not unless it is a read (its first method is
// `.select(`). The report is held to the site's client writes: the three
// 0022 keeps and the reading-answer upsert it does not touch.
// scripts/test-0022-client-write-grants.sh proves each still works against
// the migrated database.
//
// The admin client is a variable made by createAdminClient() in that file,
// or a parameter named `admin` typed SupabaseClient; for those helpers,
// every call's first argument must itself be the admin client.
//
// What it cannot see, none of which src/ does today: `from` destructured
// off a client, a `let` reassigned from one client to another, a client
// held on `this`, a parameter that shares its name with a variable made by
// createAdminClient() elsewhere in the same file, `.from<T>(`, and a write
// a library makes on the site's behalf.
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
  const pairs: Record<string, string> = dir === 1 ? { "(": ")", "{": "}", "[": "]" } : { ")": "(", "}": "{", "]": "[" };
  const o = src[open];
  const c = pairs[o];
  let depth = 0;
  for (let i = open; i >= 0 && i < src.length; i += dir) {
    if (src[i] === o) depth++;
    else if (src[i] === c && --depth === 0) return i;
  }
  return -1;
}

/** Skips whitespace and comments forward from `i`. */
function skip(src: string, i: number): number {
  for (;;) {
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src.startsWith("//", i)) i = src.indexOf("\n", i) === -1 ? src.length : src.indexOf("\n", i);
    else if (src.startsWith("/*", i)) i = src.indexOf("*/", i) + 2;
    else return i;
  }
}

/** The receiver of a call at `at` (the index of its `.`): a variable, or "call:<callee>". */
function receiverOf(src: string, at: number): string {
  let i = at - 1;
  for (;;) {
    while (i >= 0 && /[\s!?]/.test(src[i])) i--;
    if (src[i] === ")") {
      const open = match(src, i, -1);
      let j = open - 1;
      while (j >= 0 && /[\w$]/.test(src[j])) j--;
      const callee = src.slice(j + 1, open);
      if (src[j] === ".") {
        i = src[j - 1] === "?" ? j - 2 : j - 1; // a method on something (`.` or `?.`): keep walking left
        continue;
      }
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

/** Top-level keys of an object literal argument; "?" for a spread or anything not a literal. */
function keysOf(arg: string): string[] {
  const a = arg.trim();
  if (!a.startsWith("{")) return ["?"];
  const body = a.slice(1, match(a, 0, 1));
  const keys: string[] = [];
  let depth = 0;
  let part = "";
  const flush = () => {
    const p = part.trim();
    part = "";
    if (!p) return;
    if (p.startsWith("...")) keys.push("?");
    else if (p.startsWith("[")) keys.push("?");
    else keys.push((/^["']?([\w$]+)["']?/.exec(p) ?? [, "?"])[1]!);
  };
  for (const ch of body) {
    if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth--;
    if (ch === "," && depth === 0) flush();
    else part += ch;
  }
  flush();
  return keys;
}

const HELPERS = new Set<string>();
for (const f of files("src"))
  for (const m of readFileSync(f, "utf8").matchAll(/function\s+([\w$]+)\s*\(\s*admin\s*:\s*SupabaseClient\b/g)) HELPERS.add(m[1]);

function clientWritesIn(file: string, src: string, seen?: { admin: number }, helpers: Set<string> = HELPERS): string[] {
  const declared = new Map<string, string>();
  for (const m of src.matchAll(/(?:const|let|var)\s+([\w$]+)\s*(?::[^=;]+)?=\s*(?:await\s+)?([\w$.]+)\(/g)) {
    if (declared.has(m[1]) && declared.get(m[1]) !== m[2]) declared.set(m[1], "(several)");
    else declared.set(m[1], m[2]);
  }
  const adminParam = /\badmin\s*:\s*SupabaseClient\b/.test(src) && (declared.get("admin") ?? "createAdminClient") === "createAdminClient";
  const isAdmin = (r: string) =>
    r === "call:createAdminClient" || declared.get(r) === "createAdminClient" || (r === "admin" && !declared.has("admin") && adminParam);

  const out: string[] = [];
  for (const m of src.matchAll(/\.(from|rpc)\s*\(/g)) {
    const dot = m.index!;
    const receiver = receiverOf(src, dot);
    if (/^[A-Z]/.test(receiver)) continue; // Array.from, Buffer.from and the like
    const open = dot + m[0].length - 1;
    const close = match(src, open, 1);
    const arg = src.slice(open + 1, close).trim();
    if (isAdmin(receiver)) {
      if (seen) seen.admin++;
      continue;
    }
    const who = receiver === "supabase" ? "" : ` (receiver ${receiver})`;
    if (m[1] === "rpc") {
      out.push(`${file}: rpc ${arg.split(",")[0]}${who}`);
      continue;
    }
    const lit = /^(["'`])([\w]+)\1$/.exec(arg);
    const table = lit ? lit[2] : `dynamic(${arg})`;
    let next = skip(src, close + 1);
    if (src[next] === "!") next = skip(src, next + 1);
    if (src.startsWith("?.", next)) next++;
    const method = /^\.\s*([\w$]+)\s*\(/.exec(src.slice(next));
    if (method?.[1] === "select") continue;
    if (!method) {
      out.push(`${file}: ${table} (builder kept, not read at once)${who}`);
      continue;
    }
    let cols = "";
    if (method[1] === "update") {
      const at = next + method[0].length - 1;
      cols = ` ${keysOf(src.slice(at + 1, match(src, at, 1))).join(",")}`;
    }
    out.push(`${file}: ${table} ${method[1]}${cols}${who}`);
  }
  // A helper that takes the admin client must be given it.
  for (const name of helpers) {
    for (const m of src.matchAll(new RegExp(`(?<![\\w$.])${name}\\s*\\(`, "g"))) {
      const before = src.slice(Math.max(0, m.index! - 20), m.index!);
      if (/function\s+$/.test(before)) continue;
      const open = m.index! + m[0].length - 1;
      const first = src.slice(open + 1, match(src, open, 1)).split(",")[0].trim();
      if (!isAdmin(first)) out.push(`${file}: ${name} called with ${first}`);
    }
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
    // And it does see the server's own calls, so the list above is not
    // short because the scan found nothing.
    expect(seen.admin).toBeGreaterThan(100);
  });

  it("sees a write through a session client however it is reached", () => {
    const S = "const supabase = await createSupabaseServerClient();\n";
    const cases: [string, string][] = [
      [`${S}await supabase\n  .from("debates")\n  .insert({ id });`, "debates insert"],
      ['const admin = await createSupabaseServerClient();\nawait admin.from("debates").insert({ id });', "debates insert (receiver admin)"],
      ['await (await createSupabaseServerClient()).from("debates").insert({ id });', "debates insert (receiver call:createSupabaseServerClient)"],
      [`${S}await supabase.from('quiz_results').insert({ id });`, "quiz_results insert"],
      [`${S}await supabase.schema("public").from("challenges").update({ status: "x" }).eq("id", id);`, "challenges update status"],
      [`${S}await supabase.from(t).delete().eq('id', id);`, "dynamic(t) delete"],
      [`${S}await supabase.rpc("anything", {});`, 'rpc "anything"'],
      [`${S}await supabase\n  .from("debates") // a note\n  .insert({ id });`, "debates insert"],
      [`${S}const t = supabase.from("debates");\nawait t.insert({ id });`, "debates (builder kept, not read at once)"],
      [`${S}await supabase.from("profiles").update({ display_name: n, updated_at }).eq("id", id);`, "profiles update display_name,updated_at"],
      [`${S}await supabase.from("profiles").update({ display_name: n, ...extra }).eq("id", id);`, "profiles update display_name,?"],
      [`${S}await supabase.from("profiles").update(patch).eq("id", id);`, "profiles update ?"],
      [`${S}await supabase.schema("public")?.from("debates")!.insert({ id });`, "debates insert"],
    ];
    for (const [src, want] of cases) expect(clientWritesIn("x.ts", src), src).toEqual([`x.ts: ${want}`]);
  });

  it("sees a helper that takes the admin client being given another", () => {
    const helpers = new Set(["ensureProfileSchool"]);
    const src = "const supabase = await createSupabaseServerClient();\nawait ensureProfileSchool(supabase, id, school);";
    expect(clientWritesIn("x.ts", src, undefined, helpers)).toEqual(["x.ts: ensureProfileSchool called with supabase"]);
    const ok = "const admin = createAdminClient();\nawait ensureProfileSchool(admin, id, school);";
    expect(clientWritesIn("x.ts", ok, undefined, helpers)).toEqual([]);
  });

  it("passes the admin client, a helper's admin parameter and reads", () => {
    const ok = [
      'const admin = createAdminClient();\nawait admin.from("debates").insert({ id });',
      'async function f(admin: SupabaseClient) { await admin.from("profiles").update({ elo: 1 }).eq("id", id); }',
      'const supabase = await createSupabaseServerClient();\nconst { data } = await supabase.from("profiles").select("id").eq("id", id);',
      'const supabase = await createSupabaseServerClient();\nconst { data } = await supabase\n  .from("profiles") // mine\n  .select("id");',
      "const xs = Array.from({ length: 3 }, (_, i) => i);",
    ];
    for (const src of ok) expect(clientWritesIn("x.ts", src), src).toEqual([]);
  });
});
