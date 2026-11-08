// The navigation of 2026-11-06 (Arthur; docs/daily-path-copy.md, section
// 13), on a SIX_SCHOOLS build, and nothing of it on any other. Each case
// stubs the flag and loads the modules afresh, since they read it when
// they load, as the build writes it in as a constant.
import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FIXTURE_PROPS } from "./nav-six-flag-off/props";

vi.mock("posthog-js", () => ({ default: { capture: () => {} } }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/debate/opaque-benefit",
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

async function load(flag: string) {
  vi.resetModules();
  vi.stubEnv("SIX_SCHOOLS", flag);
  return {
    header: await import("../src/components/nav/SiteHeader"),
    six: await import("../src/components/nav/SiteHeaderSix"),
    footer: await import("../src/components/nav/SiteFooter"),
    topics: await import("../src/components/debate/TopicList"),
    config: await import("../next.config"),
    howItWorks: await import("../src/app/how-it-works/page"),
    schools: await import("../src/app/schools/page"),
    debate: await import("../src/app/debate/page"),
    debateSlug: await import("../src/app/debate/[slug]/page"),
    routes: await import("../src/lib/nav-routes"),
    sitemap: await import("../src/app/sitemap"),
    method: await import("../src/app/method/page"),
    rubric: await import("../src/app/debate/rubric/page"),
    table: await import("../src/components/table/SchoolTable"),
    cards: await import("../src/components/schools/SchoolCards"),
  };
}
afterEach(() => vi.unstubAllEnvs());

// Links in document order: [href, text, class].
function links(html: string): [string, string, string][] {
  return [...html.matchAll(/<a ([^>]*)>([^<]*)<\/a>/g)].map((m) => [
    /(?:^|\s)href="([^"]*)"/.exec(m[1])?.[1] ?? "",
    m[2],
    (/(?:^|\s)class="([^"]*)"/.exec(m[1])?.[1] ?? "").replace(/&amp;/g, "&"),
  ]);
}
// A source file without its comments, which name the old addresses freely.
function code(file: string): string {
  return fs
    .readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1")
    .replace(/\{\s*\}/g, "");
}
const SIGNED_IN_ONLY = "[html[data-auth=in]_&]:";
const shownSignedOut = (cls: string) => !/(^|\s)hidden(\s|$)/.test(cls);
const shownSignedIn = (cls: string) =>
  cls.includes(`${SIGNED_IN_ONLY}inline-flex`) || cls.includes(`${SIGNED_IN_ONLY}flex`) || cls.includes(`${SIGNED_IN_ONLY}block`)
    ? true
    : !cls.includes(`${SIGNED_IN_ONLY}hidden`) && shownSignedOut(cls);

describe("a build without SIX_SCHOOLS", () => {
  it.each(["0", ""])("keeps the header it had (SIX_SCHOOLS=%j)", async (flag) => {
    const { header, six } = await load(flag);
    expect(header.SiteHeader).not.toBe(six.SiteHeaderSix);
    const html = renderToStaticMarkup(createElement(header.SiteHeader));
    // Byte for byte as main's header renders on the same page (main at
    // 901e3a4, the same pathname mocked).
    expect(`${html}\n`).toBe(
      fs.readFileSync(path.join(process.cwd(), "tests", "nav-six-flag-off", "header.html"), "utf8")
    );
    expect(links(html).map(([href, text]) => [href, text])).toEqual([
      ["/", "Sophecs"],
      ["/quiz", "Quiz"],
      ["/debate", "Debate"],
      ["/lessons", "Lessons"],
      ["/table", "School table"],
      ["/quiz", "Quiz"],
      ["/debate", "Debate"],
      ["/lessons", "Lessons"],
      ["/table", "School table"],
      ["/me", "Me"],
    ]);
  });

  it.each(["0", ""])("sends /schools and /how-it-works to the site's own not-found page (SIX_SCHOOLS=%j)", async (flag) => {
    const { config } = await load(flag);
    // Rewritten before any page is looked up, to a path no route answers,
    // so the reader gets the not-found page main serves there, header and
    // all, rather than the bare shell a page's own notFound() returns.
    expect(await config.default.rewrites!()).toEqual({
      beforeFiles: [
        { source: "/schools", destination: "/_flag-off/schools" },
        { source: "/how-it-works", destination: "/_flag-off/how-it-works" },
        { source: "/schools.rsc", destination: "/_flag-off/schools.rsc" },
        { source: "/how-it-works.rsc", destination: "/_flag-off/how-it-works.rsc" },
      ],
      afterFiles: [],
      fallback: [],
    });
    expect(fs.existsSync(path.join(process.cwd(), "src", "app", "_flag-off"))).toBe(false);
  });

  it("adds no redirects, and has no /schools or /how-it-works, not even their titles", async () => {
    const { config, howItWorks, schools } = await load("0");
    expect(config.sixSchoolsRedirects("0")).toEqual([]);
    expect(await config.default.redirects!()).toEqual([]);
    expect(() => howItWorks.default()).toThrow();
    await expect(schools.default()).rejects.toThrow();
    // Metadata too: a static title would reach the 404 a reader sees.
    await expect(howItWorks.generateMetadata()).rejects.toThrow();
    await expect(schools.generateMetadata()).rejects.toThrow();
  });

  // Rendered from main's components before the change (tests/nav-six-flag-off).
  it("renders the pages and components it touches byte for byte as main did", async () => {
    // The fixture was taken with judging paused; with the switch off the
    // method page drops one sentence (the next test).
    vi.stubEnv("KILL_SWITCH_JUDGE", "true");
    const { method, rubric, footer, topics, table, cards } = await load("0");
    const fixture = (n: string) =>
      fs.readFileSync(path.join(process.cwd(), "tests", "nav-six-flag-off", `${n}.html`), "utf8");
    expect(`${renderToStaticMarkup(method.default())}\n`).toBe(fixture("method"));
    expect(`${renderToStaticMarkup(rubric.default())}\n`).toBe(fixture("rubric"));
    expect(`${renderToStaticMarkup(createElement(footer.SiteFooter))}\n`).toBe(fixture("footer"));
    expect(`${renderToStaticMarkup(createElement(topics.TopicList, FIXTURE_PROPS.topics as never))}\n`).toBe(
      fixture("topic-list")
    );
    expect(`${renderToStaticMarkup(createElement(table.SchoolTable, FIXTURE_PROPS.table as never))}\n`).toBe(
      fixture("school-table")
    );
    // The landing page's cards: taken from main's prerendered landing page
    // (901e3a4), less React's empty text separators, which a static render
    // does not write.
    expect(`${renderToStaticMarkup(createElement(cards.SchoolCards))}\n`).toBe(fixture("school-cards"));
  });

  it("says judging is paused on /method and /how-it-works only while the kill switch is on", async () => {
    const PAUSED = " That is why judging is paused rather than running.";
    const fixture = fs.readFileSync(path.join(process.cwd(), "tests", "nav-six-flag-off", "method.html"), "utf8");
    expect(fixture.split(PAUSED)).toHaveLength(2);
    for (const value of [undefined, "", "false", "TRUE", "1"]) {
      vi.unstubAllEnvs();
      if (value !== undefined) vi.stubEnv("KILL_SWITCH_JUDGE", value);
      const { method } = await load("0");
      expect(`${renderToStaticMarkup(method.default())}\n`, String(value)).toBe(fixture.replace(PAUSED, ""));
    }
    for (const [value, shown] of [["true", true], ["false", false]] as const) {
      vi.unstubAllEnvs();
      vi.stubEnv("KILL_SWITCH_JUDGE", value);
      const { howItWorks } = await load("1");
      const html = renderToStaticMarkup(await howItWorks.default());
      expect(html.includes("Verdict quality is still being checked against real arguments."), value).toBe(true);
      expect(html.includes(PAUSED.trim()), value).toBe(shown);
    }
  });

  it("keeps /table's own heading, and the landing page's cards at theirs", async () => {
    vi.resetModules();
    vi.stubEnv("SIX_SCHOOLS", "0");
    vi.doMock("@/lib/school-table-page", () => ({ loadSchoolTable: async () => FIXTURE_PROPS.table }));
    try {
      const page = await import("../src/app/table/page");
      const html = renderToStaticMarkup(await page.default());
      const table = fs.readFileSync(path.join(process.cwd(), "tests", "nav-six-flag-off", "school-table.html"), "utf8");
      expect(html).toContain(table.trimEnd());
      expect(page.dynamic).toBe("force-dynamic");
    } finally {
      vi.doUnmock("@/lib/school-table-page");
    }
    // The landing page draws the cards as main did (the fixture above
    // pins what that renders).
    const landing = fs.readFileSync(path.join(process.cwd(), "src", "app", "page.tsx"), "utf8");
    expect(landing.match(/<SchoolCards[^>]*\/>/g)).toEqual(["<SchoolCards />"]);
  });

  // A link written out to an old address would, on a flag-on build, lose
  // its anchor on the redirect when clicked; every one goes through
  // src/lib/nav-routes.ts. These are the only places an old address may
  // stay written out: the constants themselves, the three-school header,
  // the footer's flag-off links, and /method's own link to the rubric.
  it("writes the old addresses out nowhere but where a build without the flag needs them", () => {
    const found: Record<string, number> = {};
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const f = path.join(dir, e.name);
        if (e.isDirectory()) walk(f);
        else if (/\.tsx?$/.test(e.name)) {
          const n = (code(f).match(/["'`](?:\/debate\/rubric|\/method|\/table)["'`#]/g) ?? []).length;
          if (n) found[path.relative(process.cwd(), f)] = n;
        }
      }
    };
    walk(path.join(process.cwd(), "src"));
    expect(found).toEqual({
      "src/lib/nav-routes.ts": 5,
      "src/components/nav/SiteHeader.tsx": 1,
      "src/components/nav/SiteFooter.tsx": 2,
      "src/app/method/page.tsx": 1,
    });
  });

  // Each link that leads to the method, the rubric or the table takes its
  // address whole from src/lib/nav-routes.ts, the one it was written for:
  // the right constant, nothing added to it, no local stand-in.
  it("takes each moved page's address from nav-routes, the right one for each link", () => {
    const NAMES = "METHOD_HREF|RUBRIC_HREF|SAMPLES_HREF|COUNTERPART_RULES_HREF|TABLE_HREF";
    const found: Record<string, string[]> = {};
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const f = path.join(dir, e.name);
        if (e.isDirectory()) walk(f);
        else if (/\.tsx?$/.test(e.name) && !f.endsWith(path.join("lib", "nav-routes.ts"))) {
          const src = code(f);
          expect(src, f).not.toMatch(new RegExp(`(?:const|let|var|function)\\s+(?:${NAMES})\\b`));
          const uses = [...src.matchAll(new RegExp(`(?:${NAMES})`, "g"))].length;
          const hrefs = [...src.matchAll(/href=\{([^}]*)\}/g)].map((m) => m[1]).filter((x) => new RegExp(NAMES).test(x));
          const imports = [...src.matchAll(new RegExp(`import \\{[^}]*\\} from "@/lib/nav-routes"`, "g"))].join("");
          if (hrefs.length || uses) found[path.relative(process.cwd(), f)] = [...hrefs, `uses ${uses - (imports.match(new RegExp(NAMES, "g"))?.length ?? 0)}`];
        }
      }
    };
    walk(path.join(process.cwd(), "src"));
    expect(found).toEqual({
      "src/app/styleguide/page.tsx": ["RUBRIC_HREF", "uses 1"],
      "src/components/counterpart/ExchangeView.tsx": ["COUNTERPART_RULES_HREF", "uses 1"],
      "src/components/daily-path/AxisPanel.tsx": ["RUBRIC_HREF", "uses 1"],
      "src/components/debate/JudgingPausedNotice.tsx": ["METHOD_HREF", "uses 1"],
      "src/components/debate/Verdict.tsx": ["RUBRIC_HREF", "TABLE_HREF", "RUBRIC_HREF", "uses 3"],
      "src/components/nav/SiteFooter.tsx": ["RUBRIC_HREF", "uses 1"],
      "src/components/table/SchoolTable.tsx": ["SAMPLES_HREF", "uses 1"],
      "src/components/today/TodayCards.tsx": ["SAMPLES_HREF", "TABLE_HREF", "uses 2"],
      "src/components/today/TodayClient.tsx": ["METHOD_HREF", "uses 1"],
    });
  });

  it("counts a view of /debate/rubric on load, and of /how-it-works' rubric when its section is seen", async () => {
    const render = async (flag: string, page: string) => {
      vi.resetModules();
      vi.stubEnv("SIX_SCHOOLS", flag);
      vi.doMock("@/components/debate/RubricViewTracker", () => ({
        RubricViewTracker: () => createElement("i", { "data-tracker": "page" }),
      }));
      vi.doMock("@/components/how-it-works/RubricSectionViewTracker", () => ({
        RubricSectionViewTracker: ({ id }: { id: string }) => createElement("i", { "data-tracker": `section ${id}` }),
      }));
      try {
        const mod = await import(page);
        return renderToStaticMarkup(createElement(mod.default));
      } finally {
        vi.doUnmock("@/components/debate/RubricViewTracker");
        vi.doUnmock("@/components/how-it-works/RubricSectionViewTracker");
      }
    };
    const rubric = await render("0", "../src/app/debate/rubric/page");
    expect(rubric.match(/data-tracker="[^"]*"/g)).toEqual(['data-tracker="page"']);
    const merged = await render("1", "../src/app/how-it-works/page");
    expect(merged.match(/data-tracker="[^"]*"/g)).toEqual(['data-tracker="section rubric"']);
    // Inside the section it watches.
    expect(merged).toMatch(/<section id="rubric"[^>]*><i data-tracker="section rubric"><\/i>/);
  });

  it("links where it always has, and lists the old pages in the sitemap", async () => {
    const { routes, sitemap } = await load("0");
    expect({ ...routes }).toEqual({
      METHOD_HREF: "/method",
      RUBRIC_HREF: "/debate/rubric",
      SAMPLES_HREF: "/method#samples",
      COUNTERPART_RULES_HREF: "/debate/rubric",
      TABLE_HREF: "/table",
    });
    const urls = (await sitemap.default()).map((e) => e.url);
    expect(urls).toContain("https://sophecs.com/method");
    expect(urls).toContain("https://sophecs.com/debate/rubric");
    expect(urls).not.toContain("https://sophecs.com/how-it-works");
  });

  it("keeps the footer's labels and the debate pages' titles", async () => {
    const { footer, debate, debateSlug } = await load("0");
    const html = renderToStaticMarkup(createElement(footer.SiteFooter));
    expect(links(html).map(([href, text]) => [href, text])).toEqual(
      expect.arrayContaining([
        ["/debate", "Debate"],
        ["/method", "How the judge works"],
        ["/debate/rubric", "The rubric"],
        ["/debate/rubric", "Read the rubric"],
      ])
    );
    expect(debate.metadata.title).toBe("Debate · Sophecs");
    expect(debateSlug.metadata.title).toBe("Debate · Sophecs");
  });
});

describe("a build with SIX_SCHOOLS=1", () => {
  it("has the header of 2026-11-06, signed out", async () => {
    const { header } = await load("1");
    const all = links(renderToStaticMarkup(createElement(header.SiteHeader)));
    const out = all.filter(([, , cls]) => shownSignedOut(cls)).map(([href, text]) => [href, text]);
    // The wordmark, the Menu's four and its Sign in, the bar's four, the
    // button (the bar's Sign in is hidden below md, so not counted here),
    // then the Me menu's links, which are in the page but inside a hidden
    // <details>.
    expect(out.slice(0, 11)).toEqual([
      ["/", "Sophecs"],
      ["/lessons", "Lessons"],
      ["/debate", "Motions"],
      ["/schools", "Schools"],
      ["/how-it-works", "How it works"],
      ["/login", "Sign in"],
      ["/lessons", "Lessons"],
      ["/debate", "Motions"],
      ["/schools", "Schools"],
      ["/how-it-works", "How it works"],
      ["/quiz", "Take the quiz"],
    ]);
  });

  it("has the header of 2026-11-06, signed in", async () => {
    const { header } = await load("1");
    const html = renderToStaticMarkup(createElement(header.SiteHeader));
    const inLinks = links(html).filter(([, , cls]) => shownSignedIn(cls) && cls.includes(SIGNED_IN_ONLY));
    expect(inLinks.map(([href, text]) => [href, text])).toEqual([
      ["/today", "Sophecs"],
      ["/today", "Today"],
      ["/debate", "Motions"],
      ["/lessons", "Lessons"],
      ["/schools", "Schools"],
      ["/today", "Today"],
      ["/debate", "Motions"],
      ["/lessons", "Lessons"],
      ["/schools", "Schools"],
    ]);
    // The Me menu, in order, then Sign out.
    const me = html.slice(html.indexOf(">Me</summary>"));
    expect(links(me).map(([href, text]) => [href, text])).toEqual([
      ["/me", "Profile"],
      ["/me#challenges", "My debates and challenges"],
      ["/me/settings#classes", "Classes"],
      ["/me/settings", "Settings"],
      ["/quiz", "Retake the quiz"],
    ]);
    expect(me).toMatch(/<button[^>]*>Sign out<\/button>/);
    // The active page is marked in both menus, for either reader.
    expect(html.match(/aria-current="page"[^>]*>Motions/g)?.length ?? 0).toBeGreaterThan(0);
  });

  it("marks a signed-in reader from the session cookie, and no one else", async () => {
    const { AUTH_HINT_SCRIPT } = await import("../src/components/nav/auth-hint");
    const run = (cookie: string) => {
      const attrs: Record<string, string> = {};
      const document = {
        cookie,
        documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
      };
      new Function("document", AUTH_HINT_SCRIPT)(document);
      return attrs["data-auth"];
    };
    expect(run("sb-tekifezydjlgxgndkxul-auth-token=abc")).toBe("in");
    expect(run("a=1; sb-tekifezydjlgxgndkxul-auth-token.0=abc")).toBe("in");
    expect(run("anon_id=1; anon_since=2")).toBeUndefined();
    // Set when a sign-in starts, kept whether or not it finishes.
    expect(run("sb-tekifezydjlgxgndkxul-auth-token-code-verifier=abc")).toBeUndefined();
    expect(run("sb-x-auth-tokens=1")).toBeUndefined();
    expect(run("notsb-x-auth-token=1")).toBeUndefined();
    expect(run("")).toBeUndefined();
  });

  it("keeps the mark up to date as the reader moves, and takes it away on signing out", async () => {
    const { syncAuthHint } = await import("../src/components/nav/auth-hint");
    const attrs: Record<string, string> = {};
    const document = {
      cookie: "a=1; sb-x-auth-token=abc",
      documentElement: {
        setAttribute: (k: string, v: string) => (attrs[k] = v),
        removeAttribute: (k: string) => delete attrs[k],
      },
    };
    vi.stubGlobal("document", document);
    try {
      syncAuthHint();
      expect(attrs["data-auth"]).toBe("in");
      document.cookie = "a=1; sb-x-auth-token-code-verifier=abc";
      syncAuthHint();
      expect(attrs["data-auth"]).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("redirects the old addresses, keeping every one working", async () => {
    const { config } = await load("1");
    expect(config.sixSchoolsRedirects("1")).toEqual([
      { source: "/table", destination: "/schools", permanent: false },
      { source: "/method", destination: "/how-it-works", permanent: false },
      { source: "/debate/rubric", destination: "/how-it-works#rubric", permanent: false },
    ]);
    // And the config the build reads carries them, and rewrites nothing.
    expect(await config.default.redirects!()).toEqual(config.sixSchoolsRedirects("1"));
    expect(await config.default.rewrites!()).toEqual({ beforeFiles: [], afterFiles: [], fallback: [] });
  });

  it("links straight to the new pages, anchors and all, rather than through a redirect", async () => {
    const { routes, sitemap } = await load("1");
    expect({ ...routes }).toEqual({
      METHOD_HREF: "/how-it-works",
      RUBRIC_HREF: "/how-it-works#rubric",
      SAMPLES_HREF: "/how-it-works#samples",
      COUNTERPART_RULES_HREF: "/how-it-works#counterpart",
      TABLE_HREF: "/schools",
    });
    const urls = (await sitemap.default()).map((e) => e.url);
    expect(urls).toContain("https://sophecs.com/how-it-works");
    expect(urls).toContain("https://sophecs.com/schools");
    expect(urls).not.toContain("https://sophecs.com/method");
    expect(urls).not.toContain("https://sophecs.com/debate/rubric");
  });

  // Effects and handlers do not run in a static render; these were checked
  // in a browser, and are pinned here so that they cannot quietly go.
  it("re-reads the session mark on each page change, and opens one menu at a time", () => {
    const src = code(path.join(process.cwd(), "src", "components", "nav", "SiteHeaderSix.tsx"));
    expect(src).toMatch(
      /useEffect\(\(\) => \{\s*menu\.current\?\.removeAttribute\("open"\);\s*me\.current\?\.removeAttribute\("open"\);\s*syncAuthHint\(\);\s*\}, \[pathname\]\);/
    );
    expect(src).toContain('<details ref={menu} onToggle={() => closeOther(menu, me)}');
    expect(src).toContain('<details ref={me} onToggle={() => closeOther(me, menu)}');
    expect(src).toContain("onClick={(e) => closeOnLink(e, menu)}");
    expect(src).toContain("onClick={(e) => closeOnLink(e, me)}");
    expect(src).toMatch(/await createClient\(\)\.auth\.signOut\(\);\s*document\.documentElement\.removeAttribute\("data-auth"\);/);
  });

  // Arthur, 2026-11-06: a quiet text link beside "Take the quiz". Below md,
  // where it would push a phone's page sideways, it is the Menu's last item.
  it("offers Sign in to a signed-out reader only: beside the button from md, in the Menu below", async () => {
    const { header } = await load("1");
    const html = renderToStaticMarkup(createElement(header.SiteHeader)).replace(/&amp;/g, "&");
    const signIns = links(html).filter(([href, text]) => href === "/login" && text === "Sign in");
    expect(signIns).toHaveLength(2);
    // In the Menu: in a block shown only signed out, last, after the
    // signed-out four and the signed-in four.
    expect(html).toMatch(
      /Schools<\/a><div class="block \[html\[data-auth=in\]_&\]:hidden mt-1 border-t-2 border-rule pt-1"><a [^>]*href="\/login">Sign in<\/a><\/div><\/nav>/
    );
    // In the bar: hidden below md and signed in, quiet (no fill), just
    // before the button.
    const bar = signIns.find(([, , cls]) => cls.startsWith("hidden md:inline-flex"))!;
    expect(bar[2]).toContain(`${SIGNED_IN_ONLY}hidden`);
    expect(bar[2]).toContain("text-ink-mid");
    expect(bar[2].split(/\s+/).filter((c) => c === "chunky" || c === "border-2" || c.startsWith("bg-"))).toEqual([]);
    expect(bar[2].split(/\s+/).filter((c) => /extrabold|uppercase|tracking-wide/.test(c))).toEqual([]);
    expect(html).toMatch(/>Sign in<\/a><a [^>]*href="\/quiz"[^>]*>Take the quiz<\/a>/);
  });

  // "Sign in" is in the Menu exactly where the bar's is not: the Menu, the
  // bar and the bar's "Sign in" change at one breakpoint, or a width would
  // have none, or two.
  it("switches the Menu, the bar and the bar's Sign in at one breakpoint", async () => {
    const { header } = await load("1");
    const html = renderToStaticMarkup(createElement(header.SiteHeader)).replace(/&amp;/g, "&");
    const menu = /<details class="([^"]*)"><summary[^>]*>Menu<\/summary>/.exec(html)![1];
    const bar = /<nav aria-label="Main" class="([^"]*)"><a /g;
    const navs = [...html.matchAll(bar)].map((m) => m[1]);
    const signIn = links(html).find(([href, , cls]) => href === "/login" && cls.startsWith("hidden"))![2];
    const at = (cls: string, what: string) => /(?:^|\s)(sm|md|lg|xl):/.exec(cls.split(/\s+/).find((c) => c.endsWith(`:${what}`)) ?? "")?.[1];
    expect(at(menu, "hidden")).toBe("md");
    expect(navs.map((c) => at(c, "flex")).filter(Boolean)).toEqual(["md"]);
    expect(at(signIn, "inline-flex")).toBe("md");
    // And the row keeps its narrow gaps up to lg, so the bar fits at md.
    expect(html).toContain('<div class="mx-auto flex min-h-16 max-w-ui items-center gap-3 px-6 py-2 lg:gap-5">');
  });

  it("shows Take the quiz only signed out, and the Me menu only signed in", async () => {
    const { header } = await load("1");
    const html = renderToStaticMarkup(createElement(header.SiteHeader)).replace(/&amp;/g, "&");
    const quiz = links(html).find(([, text]) => text === "Take the quiz")!;
    expect(shownSignedOut(quiz[2]) && quiz[2].includes(`${SIGNED_IN_ONLY}hidden`)).toBe(true);
    const meDetails = /<details[^>]*class="([^"]*)"[^>]*>\s*<summary[^>]*>Me<\/summary>/.exec(html)!;
    expect(meDetails[1]).toMatch(/(^|\s)hidden(\s|$)/);
    expect(meDetails[1]).toContain(`${SIGNED_IN_ONLY}block`);
  });

  it("merges the method and the rubric into /how-it-works, with the anchors the redirects use", async () => {
    const { howItWorks } = await load("1");
    const html = renderToStaticMarkup(createElement(howItWorks.default));
    for (const id of ["judge", "rubric", "counterpart", "samples"]) expect(html).toContain(`id="${id}"`);
    expect(html).toContain(">How it works</h1>");
    expect(html).toContain("Known limitations");
    expect(html).toContain("What counts as faithful");
    expect(html).toContain("Questions or corrections: arthur.rzhang@gmail.com");
    // /method's closing sentence, its link now to the section here, before
    // "Questions or corrections", as on /method.
    const sentence =
      'The criteria the judge is given are published in full, including the fidelity criteria for each school. <a href="#rubric" class="font-semibold text-ink underline underline-offset-4">Read the rubric</a>.';
    expect(html).toContain(sentence);
    expect(html.indexOf(sentence)).toBeLessThan(html.indexOf("Questions or corrections"));
    // One h1; the merged pages' headings sit under their sections.
    expect(html.match(/<h1/g)).toHaveLength(1);
    const levels = [...html.matchAll(/<h([1-6])[^>]*>(.*?)<\/h\1>/g)].map(
      (m) => `h${m[1]} ${m[2].replace(/<[^>]*>/g, "")}`
    );
    expect(levels).toEqual([
      "h1 How it works",
      "h2 How the judge works",
      "h3 Known limitations",
      "h2 How this was judged",
      "h3 Fidelity",
      "h3 Rigor",
      "h3 Engagement",
      "h3 What counts as faithful",
      "h4 Stoicism",
      "h4 Utilitarianism",
      "h4 Virtue Ethics",
      // All six, as the judge is given them on this build (Arthur,
      // 2026-11-07, Gate 4 item 10; tests/gate4-content-rulings.test.tsx).
      "h4 Confucianism",
      "h4 Ubuntu",
      "h4 Buddhist Ethics",
      "h2 Counterpart rules",
      "h2 Sample accounts",
    ]);
    // The contents line links each section, by the id each has.
    const contents = /<nav aria-label="On this page"[^>]*>(.*?)<\/nav>/.exec(html)![1];
    const targets = [...contents.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    expect(targets).toEqual(["judge", "rubric", "counterpart", "samples"]);
    for (const id of targets) expect(html).toContain(`id="${id}"`);
    expect((await howItWorks.generateMetadata()).title).toBe("How it works · Sophecs");
  });

  it("says Motions, and links the merged page, in the footer and the debate titles", async () => {
    const { footer, debate, debateSlug } = await load("1");
    const html = renderToStaticMarkup(createElement(footer.SiteFooter));
    const pairs = links(html).map(([href, text]) => [href, text]);
    expect(pairs).toEqual(
      expect.arrayContaining([
        ["/debate", "Motions"],
        ["/how-it-works", "How it works"],
        ["/how-it-works#rubric", "The rubric"],
        ["/how-it-works#rubric", "Read the rubric"],
      ])
    );
    expect(pairs.map(([href]) => href)).not.toContain("/method");
    expect(debate.metadata.title).toBe("Motions · Sophecs");
    expect(debateSlug.metadata.title).toBe("Motions · Sophecs");
  });

  it("puts an Exemplars link under each motion, outside its card's link", async () => {
    const { topics } = await load("1");
    const html = renderToStaticMarkup(
      createElement(topics.TopicList, {
        topics: [
          { slug: "opaque-benefit", title: "The opaque benefit", motion: "A motion.", stances: {}, parElo: 1200, bestScore: null, status: "open", locksFor: null, isWeekly: false },
          { slug: "no-decision", title: "No decision", motion: "Another.", stances: {}, parElo: 1200, bestScore: null, status: "open", locksFor: null, isWeekly: false },
        ],
        school: null,
      } as never)
    );
    expect(html.match(/>Exemplars<\/a>/g)).toHaveLength(2);
    expect(links(html)).toContainEqual([
      "/debate/opaque-benefit/exemplars",
      "Exemplars",
      expect.stringContaining("self-start"),
    ]);
    expect(html).toContain('aria-label="Exemplars: The opaque benefit"');
    // Under the card, not beside it: each item stacks its two links.
    expect(html.match(/<li class="flex flex-col">/g)).toHaveLength(2);
    // Never nested: no <a> opens before the card's link closes.
    for (const li of html.split("<li").slice(1)) {
      const first = li.indexOf("</a>");
      expect(li.slice(li.indexOf("<a") + 2, first)).not.toContain("<a");
    }
  });

  it("gives the Me menu's anchors their targets", async () => {
    const html = await meAndSettings("1");
    expect(html).toContain('<section id="challenges" class="mt-12 border-t-2 border-rule pt-10 scroll-mt-8">');
    expect(html).toContain('<section id="debates" class="mt-12 border-t-2 border-rule pt-10 scroll-mt-8">');
    expect(html).toContain('<section id="classes" class="mt-12 border-t-2 border-rule pt-10 scroll-mt-8">');
  });

  it("sets /schools' headings in order: the page, then the cards and the table, then the table's notes", async () => {
    vi.resetModules();
    vi.stubEnv("SIX_SCHOOLS", "1");
    vi.doMock("@/lib/school-table-page", () => ({ loadSchoolTable: async () => FIXTURE_PROPS.table }));
    try {
      const page = await import("../src/app/schools/page");
      const html = renderToStaticMarkup(await page.default());
      expect(page.dynamic).toBe("force-dynamic");
      const headings = [...html.matchAll(/<h([1-6])[^>]*>(.*?)<\/h\1>/g)].map(
        (m) => `h${m[1]} ${m[2].replace(/<[^>]*>/g, "")}`
      );
      expect(headings.slice(0, 7)).toEqual([
        "h1 Schools",
        "h2 Stoicism",
        "h2 Utilitarianism",
        "h2 Virtue Ethics",
        "h2 Confucianism",
        "h2 Ubuntu",
        "h2 Buddhist Ethics",
      ]);
      expect(headings[7]).toMatch(/^h2 /);
      expect(headings.slice(8).every((h) => h.startsWith("h3 "))).toBe(true);
      expect(headings.length).toBeGreaterThan(8);
    } finally {
      vi.doUnmock("@/lib/school-table-page");
    }
  });

  it("marks the reader before the page is drawn, from the root layout", async () => {
    const { html, script } = await rootLayout("1");
    expect(html).toContain(`<html lang="en" class="f f f f"><head><script>${script}</script></head><body`);
  });
});

// The profile and the settings page, with a debate so that the history
// section is drawn, as a build with the flag given renders them.
async function meAndSettings(flag: string) {
  vi.resetModules();
  vi.stubEnv("SIX_SCHOOLS", flag);
  const { ProfilePage } = await import("../src/components/me/ProfilePage");
  const { SettingsPage } = await import("../src/components/me/SettingsPage");
  return (
    renderToStaticMarkup(
      createElement(ProfilePage, {
        school: null,
        displayName: null,
        elo: 1200,
        percentile: 50,
        streak: 0,
        streakUpdatedOn: null,
        today: "2026-11-06",
        ratingPoints: [],
        objections: [],
        weeklyMotion: null,
        hasAnyDebate: true,
        exchanges: [],
        pendingChallenges: [],
        debates: [{ id: "d1", topicSlug: "opaque-benefit", topicTitle: "The opaque benefit", score: 70, rejected: false }],
        caseStates: {},
        allClosed: false,
      })
    ) +
    renderToStaticMarkup(
      createElement(SettingsPage, { displayName: null, argumentDefaultPublic: false, owned: [], joined: [] })
    )
  );
}

// The root layout, its fonts, stylesheets and analytics stood in for, as a
// build with the flag given renders it.
async function rootLayout(flag: string) {
  vi.resetModules();
  vi.stubEnv("SIX_SCHOOLS", flag);
  vi.doMock("@/lib/fonts", () => ({
    spectral: { variable: "f" },
    plexSans: { variable: "f" },
    plexMono: { variable: "f" },
    bricolage: { variable: "f" },
  }));
  vi.doMock("@/components/analytics-provider", () => ({ AnalyticsProvider: () => null }));
  vi.doMock("@/components/nav/SiteHeader", () => ({ SiteHeader: () => null }));
  vi.doMock("@/components/nav/SiteFooter", () => ({ SiteFooter: () => null }));
  vi.doMock("@six-schools/tokens.css", () => ({}));
  try {
    const layout = await import("../src/app/layout");
    const { AUTH_HINT_SCRIPT } = await import("../src/components/nav/auth-hint");
    return {
      html: renderToStaticMarkup(layout.default({ children: createElement("main") })),
      script: AUTH_HINT_SCRIPT,
    };
  } finally {
    for (const m of [
      "@/lib/fonts",
      "@/components/analytics-provider",
      "@/components/nav/SiteHeader",
      "@/components/nav/SiteFooter",
      "@six-schools/tokens.css",
    ])
      vi.doUnmock(m);
  }
}

describe("a build without SIX_SCHOOLS, on the pages the header's menus reach", () => {
  it("gives the profile's and the settings page's sections no anchors", async () => {
    const html = await meAndSettings("0");
    expect(html).toContain('<section class="mt-12 border-t-2 border-rule pt-10"><h2');
    expect(html).not.toMatch(/<section id=/);
    expect(html).not.toContain("scroll-mt-8");
  });

  it("adds nothing to the root layout's head", async () => {
    const { html } = await rootLayout("0");
    // React draws an empty <head> for an <html> that has none.
    expect(html).toBe(
      '<html lang="en" class="f f f f"><head></head><body class="min-h-screen flex flex-col bg-paper text-ink"><main></main></body></html>'
    );
  });
});

describe("rubric_viewed on /how-it-works", () => {
  it("sends rubric_viewed once, when the section first reaches the window's upper half", async () => {
    const { watchSection } = await import("../src/components/how-it-works/RubricSectionViewTracker");
    let fire: (entries: { isIntersecting: boolean }[]) => void = () => {};
    const seen = { options: undefined as unknown, observed: [] as unknown[], disconnected: 0 };
    class FakeObserver {
      constructor(cb: typeof fire, options: unknown) {
        fire = cb;
        seen.options = options;
      }
      observe(el: unknown) {
        seen.observed.push(el);
      }
      disconnect() {
        seen.disconnected++;
      }
    }
    const el = { id: "rubric" };
    const onSeen = vi.fn();
    const stop = watchSection(el as never, onSeen, FakeObserver as never);
    expect(seen.observed).toEqual([el]);
    expect(seen.options).toEqual({ rootMargin: "0px 0px -50% 0px" });
    fire([{ isIntersecting: false }]);
    expect(onSeen).not.toHaveBeenCalled();
    fire([{ isIntersecting: true }]);
    expect(onSeen).toHaveBeenCalledTimes(1);
    expect(seen.disconnected).toBe(1);
    stop();
    expect(seen.disconnected).toBe(2);
  });

  it("watches the section it is given, by id, and sends nothing before it is seen", async () => {
    const { trackSection } = await import("../src/components/how-it-works/RubricSectionViewTracker");
    let fire: (entries: { isIntersecting: boolean }[]) => void = () => {};
    const observed: unknown[] = [];
    class FakeObserver {
      constructor(cb: typeof fire) {
        fire = cb;
      }
      observe(el: unknown) {
        observed.push(el);
      }
      disconnect() {}
    }
    const rubric = { id: "rubric" };
    const doc = { getElementById: (id: string) => (id === "rubric" ? rubric : null) };
    const send = vi.fn();
    trackSection("rubric", send, doc as never, FakeObserver as never);
    expect(observed).toEqual([rubric]);
    expect(send).not.toHaveBeenCalled();
    fire([{ isIntersecting: true }]);
    expect(send).toHaveBeenCalledTimes(1);
    // No such section, or no IntersectionObserver: nothing is watched or sent.
    expect(trackSection("missing", send, doc as never, FakeObserver as never)).toBeUndefined();
    expect(trackSection("rubric", send, doc as never, undefined)).toBeUndefined();
    expect(observed).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends rubric_viewed from the component, through trackSection, for the id it is given", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src", "components", "how-it-works", "RubricSectionViewTracker.tsx"),
      "utf8"
    );
    expect(src).toContain(
      'useEffect(() => trackSection(id, () => track({ name: "rubric_viewed", props: {} })), [id]);'
    );
    expect(src.match(/[^.\w]track\(/g)).toHaveLength(1);
  });
});
