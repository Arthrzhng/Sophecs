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

  it("loads no view from elsewhere", async () => {
    const { micro } = await load("0");
    expect(micro.getAllMicroLessons().filter((l) => l.position === "elsewhere")).toEqual([]);
    expect(micro.getMicroLesson("opaque-benefit-elsewhere")).toBeNull();
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
      // Published at the launch: no status in its front matter.
      expect(content.status).toBeUndefined();
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

  it("shows the views from elsewhere, one per motion, and no other draft passage", async () => {
    const { micro } = await load("1");
    const all = micro.getAllMicroLessons();
    const elsewhere = all.filter((l) => l.position === "elsewhere");
    expect(elsewhere.length).toBeGreaterThan(0);
    expect(new Set(elsewhere.map((l) => l.topic)).size).toBe(elsewhere.length);
    for (const l of elsewhere) expect(micro.getMicroLesson(l.slug)?.slug).toBe(l.slug);
    // Every draft that loads is an elsewhere passage.
    for (const l of all.filter((x) => x.status === "draft")) expect(l.position).toBe("elsewhere");
    // Each sits on a motion that has its before passage, which its page
    // links to as the passage that frames the question.
    for (const l of elsewhere) {
      expect(all.some((x) => x.topic === l.topic && x.position === "before"), l.slug).toBe(true);
    }
  });

  it("lists every school the build shows in the sitemap, and no elsewhere passage", async () => {
    // Production's sitemap since the launch (review pass 1 of #112): the
    // three's pages are sophecs.com's own now. An elsewhere passage's file
    // still marks it a draft, so it stays out.
    await load("1");
    const { default: sitemap } = await import("../src/app/sitemap");
    const urls = sitemap().map((e) => e.url);
    expect(urls.filter((u) => u.includes("elsewhere"))).toEqual([]);
    for (const id of NEW) expect(urls).toContain(`https://sophecs.com/s/${id}`);
    await load("0");
    const { default: three } = await import("../src/app/sitemap");
    for (const id of NEW) expect(three().map((e) => e.url)).not.toContain(`https://sophecs.com/s/${id}`);
  });

  it("gives the school table six rows, the three new ones unranked with no average", async () => {
    const { table } = await load("1");
    const twenty = (school: string, fidelity: number) => Array.from({ length: 20 }, () => ({ school, fidelity }) as never);
    const rows = table.rankSchools([...twenty("stoicism", 7), ...twenty("utilitarianism", 6)], {});
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

describe("which passages the loaders hide", () => {
  // Synthetic passages, because the content cannot test the position rule:
  // tests/drafts.test.ts allows no draft passage other than an elsewhere.
  it("shows an elsewhere draft on a SIX_SCHOOLS build only, and no other draft", async () => {
    const on = (await load("1")).micro;
    expect(on.hiddenMicroLesson({ position: "elsewhere", status: "draft" })).toBe(false);
    expect(on.hiddenMicroLesson({ position: "before", status: "draft" })).toBe(true);
    expect(on.hiddenMicroLesson({ position: "after", status: "draft" })).toBe(true);
    expect(on.hiddenMicroLesson({ position: "before" })).toBe(false);
    const off = (await load("0")).micro;
    expect(off.hiddenMicroLesson({ position: "elsewhere", status: "draft" })).toBe(true);
    expect(off.hiddenMicroLesson({ position: "elsewhere", status: "draft" }, { includeDrafts: true })).toBe(false);
  });
});

describe("a passage's place among its motion's passages", () => {
  const p = (slug: string, position: "before" | "after" | "elsewhere", topic = "t") => ({ slug, topic, position });
  const all = [p("t-before", "before"), p("t-after", "after"), p("t-elsewhere", "elsewhere"), p("u-before", "before", "u")];

  it("numbers the pair 1 and 2 of 2, whatever else the motion has", async () => {
    const { passagePlace } = await import("../src/lib/passage-place");
    expect(passagePlace(all[0], all)).toMatchObject({ index: 1, total: 2, elsewhere: false });
    expect(passagePlace(all[1], all)).toMatchObject({ index: 2, total: 2, elsewhere: false });
    expect(passagePlace(all[0], all).sibling?.slug).toBe("t-after");
    expect(passagePlace(all[1], all).sibling?.slug).toBe("t-before");
  });

  it("gives an elsewhere passage no number, and the before passage as its sibling", async () => {
    const { passagePlace } = await import("../src/lib/passage-place");
    expect(passagePlace(all[2], all)).toMatchObject({ index: null, elsewhere: true });
    expect(passagePlace(all[2], all).sibling?.slug).toBe("t-before");
  });

  it("numbers every real passage 1 or 2 of 2 on a SIX_SCHOOLS build", async () => {
    const { micro } = await load("1");
    const { passagePlace } = await import("../src/lib/passage-place");
    const lessons = micro.getAllMicroLessons();
    for (const l of lessons.filter((x) => x.position !== "elsewhere")) {
      const place = passagePlace(l, lessons);
      expect(place.total, l.slug).toBe(2);
      expect(place.index, l.slug).toBe(l.position === "before" ? 1 : 2);
    }
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
