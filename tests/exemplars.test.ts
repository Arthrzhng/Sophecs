// "Exemplar ways to argue this motion" (Arthur, 2026-11-06): the strongest
// sample arguments on a motion, never a real reader's, shared evenly
// across the schools, up to 50.
import { describe, expect, it } from "vitest";
import { EXEMPLARS_PER_MOTION, getExemplars, openingOf, selectExemplars, type ExemplarCandidate } from "../src/lib/exemplars";
import type { SchoolId } from "../src/lib/types";

const SCHOOLS: SchoolId[] = ["stoicism", "utilitarianism", "virtue-ethics"];
const made = (school: SchoolId, n: number, extra: Partial<ExemplarCandidate> = {}): ExemplarCandidate[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${school}-${i}`, school, argument: `${school} argument ${i}.`, is_sample: true, ...extra }));

describe("selectExemplars", () => {
  it("chooses 50 between three schools, 17, 17 and 16, strongest first", () => {
    const chosen = selectExemplars(new Map(SCHOOLS.map((s) => [s, made(s, 100)])), SCHOOLS);
    expect(EXEMPLARS_PER_MOTION).toBe(50);
    expect(SCHOOLS.map((s) => chosen.get(s)!.length)).toEqual([17, 17, 16]);
    expect(chosen.get("stoicism")!.map((e) => e.id).slice(0, 3)).toEqual(["stoicism-0", "stoicism-1", "stoicism-2"]);
  });

  it("gives a school's unfilled places to the others", () => {
    const chosen = selectExemplars(
      new Map([
        ["stoicism", made("stoicism", 100)],
        ["utilitarianism", made("utilitarianism", 5)],
        ["virtue-ethics", made("virtue-ethics", 100)],
      ] as [SchoolId, ExemplarCandidate[]][]),
      SCHOOLS
    );
    expect(SCHOOLS.map((s) => chosen.get(s)!.length)).toEqual([23, 5, 22]);
  });

  it("never takes a row that is not a sample account's", () => {
    const real = made("stoicism", 3, { is_sample: false }).map((r) => ({ ...r, id: `real-${r.id}` }));
    const chosen = selectExemplars(new Map([["stoicism", [...real, ...made("stoicism", 2)]]]), ["stoicism"]);
    expect(chosen.get("stoicism")!.map((e) => e.id)).toEqual(["stoicism-0", "stoicism-1"]);
  });

  it("drops a repeat of the same text, whatever its spacing or case, and a row filed under another school", () => {
    const rows: ExemplarCandidate[] = [
      { id: "a", school: "stoicism", argument: "The same  argument.", is_sample: true },
      { id: "b", school: "stoicism", argument: "the same argument.", is_sample: true },
      { id: "c", school: "utilitarianism", argument: "Filed wrong.", is_sample: true },
      { id: "d", school: "stoicism", argument: "   ", is_sample: true },
    ];
    expect(selectExemplars(new Map([["stoicism", rows]]), ["stoicism"]).get("stoicism")!.map((e) => e.id)).toEqual(["a"]);
  });

  it("returns no score", () => {
    const [first] = selectExemplars(new Map([["stoicism", made("stoicism", 1)]]), ["stoicism"]).get("stoicism")!;
    expect(Object.keys(first).sort()).toEqual(["argument", "id", "school"]);
  });
});

describe("getExemplars", () => {
  it("asks the database for sample accounts' judged originals on the motion only", async () => {
    const calls: { table: string; filters: [string, string, unknown][]; order: string[] }[] = [];
    const admin = {
      from(table: string) {
        const call = { table, filters: [] as [string, string, unknown][], order: [] as string[] };
        calls.push(call);
        const b: Record<string, unknown> = {};
        b.select = () => b;
        b.eq = (c: string, v: unknown) => (call.filters.push(["eq", c, v]), b);
        b.not = (c: string, op: string, v: unknown) => (call.filters.push([`not.${op}`, c, v]), b);
        b.order = (c: string) => (call.order.push(c), b);
        b.limit = () => Promise.resolve({ data: [], error: null });
        return b;
      },
    };
    await getExemplars(admin as never, "no-decision", SCHOOLS);
    expect(calls).toHaveLength(3);
    for (const [i, call] of calls.entries()) {
      expect(call.table).toBe("debates");
      expect(call.filters).toEqual(
        expect.arrayContaining([
          ["eq", "topic_slug", "no-decision"],
          ["eq", "school", SCHOOLS[i]],
          ["eq", "is_sample", true],
          ["eq", "kind", "original"],
          ["eq", "rejected", false],
          ["not.is", "verdict", null],
          ["not.is", "argument", null],
        ])
      );
      expect(call.order[0]).toBe("score");
    }
  });
});

describe("openingOf", () => {
  it("is the first sentence when it is short enough", () => {
    expect(openingOf("Count everyone affected. Then weigh it.")).toBe("Count everyone affected.");
  });
  it("cuts a long opening at a word and marks the cut", () => {
    const out = openingOf(`${"word ".repeat(60)}end.`, 40);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(41);
    expect(out).not.toMatch(/\s…$/);
  });
});
