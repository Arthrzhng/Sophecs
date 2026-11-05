// Stage 5, step 2 (docs/stage5-plan.md): what the pages that only read
// get from the content loaders and the school table, with SIX_SCHOOLS and
// without it. The modules read the flag when they load, so each case
// stubs it and loads them afresh.
import { afterEach, describe, expect, it, vi } from "vitest";

const LIVE = ["stoicism", "utilitarianism", "virtue-ethics"];
const NEW = ["confucian", "ubuntu", "buddhist"];

async function load(flag: "0" | "1") {
  vi.resetModules();
  vi.stubEnv("SIX_SCHOOLS", flag);
  return {
    drafts: await import("../src/lib/drafts"),
    schools: await import("../src/lib/schools"),
    modules: await import("../src/lib/modules"),
    micro: await import("../src/lib/micro-lessons"),
    table: await import("../src/lib/school-table"),
  };
}
afterEach(() => vi.unstubAllEnvs());

describe("without SIX_SCHOOLS", () => {
  it("loads the published schools only, and no draft module", async () => {
    const { schools, modules, drafts } = await load("0");
    expect(Object.keys(schools.getAllSchools()).sort()).toEqual([...LIVE].sort());
    for (const id of NEW) expect(() => schools.getSchool(id as never)).toThrowError(/No content/);
    expect(modules.getAllModules().filter((m) => NEW.includes(m.school))).toEqual([]);
    expect(drafts.SHOWN_DRAFT_SCHOOL_IDS).toEqual([]);
    for (const id of NEW) expect(drafts.shownDraftSchool(id)).toBe(false);
  });

  it("ranks the three published schools, as before", async () => {
    const { table } = await load("0");
    expect(table.rankSchools([], {}).map((r) => r.school).sort()).toEqual([...LIVE].sort());
  });
});

describe("with SIX_SCHOOLS=1", () => {
  it("loads each of the three's school pages", async () => {
    const { schools } = await load("1");
    expect(Object.keys(schools.getAllSchools()).sort()).toEqual([...LIVE, ...NEW].sort());
    for (const id of NEW) {
      const content = schools.getSchool(id as never);
      expect(content.id).toBe(id);
      expect(content.status).toBe("draft");
      expect(content.one_line.length).toBeGreaterThan(10);
    }
  });

  it("loads the three's draft modules, one each, and still no other draft", async () => {
    const { modules } = await load("1");
    const all = modules.getAllModules();
    const fresh = all.filter((m) => NEW.includes(m.school));
    expect(fresh.map((m) => m.school).sort()).toEqual([...NEW].sort());
    // Every module that loads is either published or one of the three's.
    for (const m of all) expect([...LIVE, ...NEW]).toContain(m.school);
    // The same drafts /styleguide/drafts reads with includeDrafts, and no
    // more: a draft belonging to a published school would stay hidden.
    const draftsOnly = modules.getAllModules({ includeDrafts: true }).filter((m) => m.status === "draft");
    expect(draftsOnly.filter((m) => !NEW.includes(m.school))).toEqual(
      all.filter((m) => m.status === "draft" && !NEW.includes(m.school))
    );
  });

  it("does not show a draft that belongs to no school, such as an elsewhere passage", async () => {
    const { micro } = await load("1");
    expect(micro.getAllMicroLessons().filter((l) => l.position === "elsewhere")).toEqual([]);
  });

  it("gives the school table six rows, the three new ones unranked with no average", async () => {
    const { table } = await load("1");
    const rows = table.rankSchools(
      [{ school: "stoicism", fidelity: 7 } as never, { school: "utilitarianism", fidelity: 6 } as never],
      {}
    );
    expect(rows.map((r) => r.school).sort()).toEqual([...LIVE, ...NEW].sort());
    for (const id of NEW) {
      const row = rows.find((r) => r.school === id);
      expect(row?.rank).toBeNull();
      expect(row?.avgFidelity).toBeNull();
      expect(row?.arguments).toBe(0);
    }
    expect(rows.slice(0, 2).map((r) => r.school)).toEqual(["stoicism", "utilitarianism"]);
  });

  it("counts a school change into one of the three", async () => {
    const { table } = await load("1");
    const now = new Date();
    const counts = table.schoolChanges(
      [{ from: "stoicism", to: "ubuntu", at: now.toISOString() } as never],
      new Date(now.getTime() - 1000),
      new Date(now.getTime() + 1000)
    );
    expect(counts.ubuntu).toEqual({ joined: 1, left: 0 });
    expect(counts.stoicism).toEqual({ joined: 0, left: 1 });
  });
});

describe("the loader rule itself", () => {
  // Asserted directly, because the content alone cannot test it: no draft
  // file today belongs to a published school, so a rule that showed one
  // would pass every test that only reads the content.
  it("shows a draft only when it is one of the three's, and only with the flag", async () => {
    const draft = { status: "draft" };
    const on = (await load("1")).drafts;
    for (const id of NEW) expect(on.excluded(draft, {}, id), id).toBe(false);
    for (const id of LIVE) expect(on.excluded(draft, {}, id), id).toBe(true);
    expect(on.excluded(draft, {}, undefined)).toBe(true);
    expect(on.excluded(draft, {}, "mohism")).toBe(true);
    expect(on.SHOWN_DRAFT_SCHOOL_IDS).toEqual(NEW);

    const off = (await load("0")).drafts;
    for (const id of [...NEW, ...LIVE]) expect(off.excluded(draft, {}, id), id).toBe(true);
    // includeDrafts is unchanged by any of it, and a published file loads.
    expect(off.excluded(draft, { includeDrafts: true }, "stoicism")).toBe(false);
    expect(on.excluded({}, {}, "stoicism")).toBe(false);
  });
});

describe("the school pages", () => {
  it("are generated for the schools each build shows", async () => {
    await load("0");
    const off = (await import("../src/app/s/[school]/page")).generateStaticParams();
    expect(off.map((p) => p.school)).toEqual(LIVE);
    await load("1");
    const on = (await import("../src/app/s/[school]/page")).generateStaticParams();
    expect(on.map((p) => p.school)).toEqual([...LIVE, ...NEW]);
  });
});

describe("countWord", () => {
  it("writes the counts the pages use as words, and larger ones as digits", async () => {
    const { countWord } = await import("../src/lib/count-word");
    expect([2, 3, 5, 6].map(countWord)).toEqual(["two", "three", "five", "six"]);
    expect(countWord(11)).toBe("11");
    expect(countWord(-1)).toBe("-1");
  });
});
