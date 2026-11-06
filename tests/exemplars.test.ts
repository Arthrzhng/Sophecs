// "Exemplar ways to argue this motion" (Arthur, 2026-11-06): the strongest
// sample argument under each opening line, never a real reader's, shared
// evenly across the schools, up to 50.
import { describe, expect, it, vi } from "vitest";
import { FRAMES } from "../scripts/seed/banks";
import { TYPOS } from "../scripts/seed/generate";
import { EXEMPLAR_CANDIDATES_PER_SCHOOL, EXEMPLARS_PER_MOTION, SAMPLE_FRAMES, SAMPLE_TYPO, getExemplars, withoutFrame, openingOf, selectExemplars, type ExemplarCandidate } from "../src/lib/exemplars";
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

  it("keeps the strongest under each opening line in a school, and the same line in another school", () => {
    const row = (id: string, school: SchoolId, argument: string): ExemplarCandidate => ({ id, school, argument, is_sample: true });
    const chosen = selectExemplars(
      new Map([
        ["stoicism", [row("s1", "stoicism", "Deploy it. Because of A."), row("s2", "stoicism", "deploy  it. Because of B."), row("s3", "stoicism", "Do not deploy it. C.")]],
        ["utilitarianism", [row("u1", "utilitarianism", "Deploy it. Because of D.")]],
      ] as [SchoolId, ExemplarCandidate[]][]),
      ["stoicism", "utilitarianism"]
    );
    expect(chosen.get("stoicism")!.map((e) => e.id)).toEqual(["s1", "s3"]);
    expect(chosen.get("utilitarianism")!.map((e) => e.id)).toEqual(["u1"]);
  });

  it("reads the opening line after a frame sentence, so a frame never passes for a new opening", () => {
    expect([...SAMPLE_FRAMES]).toEqual(FRAMES);
    const row = (id: string, argument: string): ExemplarCandidate => ({ id, school: "stoicism", argument, is_sample: true });
    const chosen = selectExemplars(
      new Map([["stoicism", [row("plain", "I oppose the motion. Because of A."), ...FRAMES.map((f, i) => row(`framed-${i}`, `${f} I oppose the motion. Because of B${i}.`)), row("other", "Here is my answer. Deploy it. C.")]]]),
      ["stoicism"]
    ).get("stoicism")!;
    expect(chosen.map((e) => [e.id, e.opening])).toEqual([
      ["plain", "I oppose the motion."],
      ["other", "Deploy it."],
    ]);
    // The text is shown as written; only the line to open it from skips the frame.
    expect(chosen[1].argument).toBe("Here is my answer. Deploy it. C.");
    expect(withoutFrame("Here is my answer.")).toBe("Here is my answer.");
    expect(withoutFrame("Here is my answering machine. X.")).toBe("Here is my answering machine. X.");
  });

  it("drops a text already kept in another school", () => {
    const chosen = selectExemplars(
      new Map([
        ["stoicism", [{ id: "s", school: "stoicism", argument: "Same words. Here.", is_sample: true }]],
        ["utilitarianism", [{ id: "u", school: "utilitarianism", argument: "same  words. here.", is_sample: true }]],
      ] as [SchoolId, ExemplarCandidate[]][]),
      ["stoicism", "utilitarianism"]
    );
    expect(chosen.get("utilitarianism")).toEqual([]);
  });

  it("never takes an argument with one of the sample run's deliberate misspellings", () => {
    const detectable = TYPOS.map(([, typo]) => typo).filter((typo) => typo !== "its");
    expect(detectable).toHaveLength(TYPOS.length - 1);
    for (const typo of detectable) {
      expect(SAMPLE_TYPO.test(`It holds ${typo} it does.`), typo).toBe(true);
      const rows = [
        { id: "typo", school: "stoicism" as const, argument: `First, ${typo} so. More.`, is_sample: true },
        { id: "clean", school: "stoicism" as const, argument: "Second, and clean. More.", is_sample: true },
      ];
      expect(selectExemplars(new Map([["stoicism", rows]]), ["stoicism"]).get("stoicism")!.map((e) => e.id)).toEqual(["clean"]);
    }
    for (const word of ["because", "their", "which", "whether", "the theory", "argument", "it's"]) expect(SAMPLE_TYPO.test(word), word).toBe(false);
    // A misspelt strongest argument leaves its opening to the next one under it.
    const rows = [
      { id: "typo", school: "stoicism" as const, argument: "Deploy it. Becuase of A.", is_sample: true },
      { id: "clean", school: "stoicism" as const, argument: "Deploy it. Because of B.", is_sample: true },
    ];
    expect(selectExemplars(new Map([["stoicism", rows]]), ["stoicism"]).get("stoicism")!.map((e) => e.id)).toEqual(["clean"]);
  });

  it("returns no score", () => {
    const [first] = selectExemplars(new Map([["stoicism", made("stoicism", 1)]]), ["stoicism"]).get("stoicism")!;
    expect(Object.keys(first).sort()).toEqual(["argument", "id", "opening", "school"]);
  });
});

describe("getExemplars", () => {
  // A stand-in for the admin client that records each query's filters and
  // ordering, and answers each school's read with `answer(school)`.
  const fakeAdmin = (answer: (school: unknown) => { data: unknown; error: unknown }) => {
    const calls: { table: string; filters: [string, string, unknown][]; order: [string, unknown][]; limit?: number }[] = [];
    const admin = {
      from(table: string) {
        const call = { table, filters: [] as [string, string, unknown][], order: [] as [string, unknown][], limit: undefined as number | undefined };
        calls.push(call);
        const b: Record<string, unknown> = {};
        b.select = () => b;
        b.eq = (c: string, v: unknown) => (call.filters.push(["eq", c, v]), b);
        b.not = (c: string, op: string, v: unknown) => (call.filters.push([`not.${op}`, c, v]), b);
        b.order = (c: string, o: unknown) => (call.order.push([c, o]), b);
        b.limit = (n: number) => ((call.limit = n), Promise.resolve(answer(call.filters.find(([, c]) => c === "school")?.[2])));
        return b;
      },
    };
    return { admin: admin as never, calls };
  };

  it("asks the database for sample accounts' published, judged originals on the motion only, strongest first", async () => {
    const { admin, calls } = fakeAdmin(() => ({ data: [], error: null }));
    await getExemplars(admin, "no-decision", "The motion as it reads.", SCHOOLS);
    expect(calls).toHaveLength(3);
    for (const [i, call] of calls.entries()) {
      expect(call.table).toBe("debates");
      expect(call.filters).toEqual(
        expect.arrayContaining([
          ["eq", "topic_slug", "no-decision"],
          ["eq", "motion_text", "The motion as it reads."],
          ["eq", "school", SCHOOLS[i]],
          ["eq", "is_sample", true],
          ["eq", "argument_public", true],
          ["eq", "kind", "original"],
          ["eq", "rejected", false],
          ["not.is", "verdict", null],
          ["not.is", "argument", null],
        ])
      );
      expect(call.order[0]).toEqual(["score", { ascending: false, nullsFirst: false }]);
      // Every published row, so a rarely used opening is still found.
      expect(call.limit).toBe(EXEMPLAR_CANDIDATES_PER_SCHOOL);
      expect(EXEMPLAR_CANDIDATES_PER_SCHOOL).toBe(1000);
    }
  });

  it("throws when a school cannot be read, rather than giving its places to the others", async () => {
    const { admin } = fakeAdmin((school) =>
      school === "utilitarianism" ? { data: null, error: { message: "timeout" } } : { data: made(school as SchoolId, 5), error: null }
    );
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getExemplars(admin, "no-decision", "The motion.", SCHOOLS)).rejects.toThrow("no-decision/utilitarianism");
    quiet.mockRestore();
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
