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
    const { method, rubric, footer, topics, table } = await load("0");
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
    // The wordmark, the Menu's four, the bar's four, the button, then the
    // Me menu's links, which are in the page but inside a hidden <details>.
    expect(out.slice(0, 10)).toEqual([
      ["/", "Sophecs"],
      ["/lessons", "Lessons"],
      ["/debate", "Motions"],
      ["/schools", "Schools"],
      ["/how-it-works", "How it works"],
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
    expect(run("")).toBeUndefined();
  });

  it("redirects the old addresses, keeping every one working", async () => {
    const { config } = await load("1");
    expect(config.sixSchoolsRedirects("1")).toEqual([
      { source: "/table", destination: "/schools", permanent: false },
      { source: "/method", destination: "/how-it-works", permanent: false },
      { source: "/debate/rubric", destination: "/how-it-works#rubric", permanent: false },
    ]);
    // And the config the build reads carries them.
    expect(await config.default.redirects!()).toEqual(config.sixSchoolsRedirects("1"));
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
    // One h1; the merged pages' headings sit under their sections.
    expect(html.match(/<h1/g)).toHaveLength(1);
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
    // Never nested: no <a> opens before the card's link closes.
    for (const li of html.split("<li").slice(1)) {
      const first = li.indexOf("</a>");
      expect(li.slice(li.indexOf("<a") + 2, first)).not.toContain("<a");
    }
  });

  it("gives the Me menu's anchors their targets", () => {
    const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
    expect(read("src/components/me/ProfilePage.tsx")).toContain('<Section title="Pending challenges" id="challenges">');
    expect(read("src/components/me/SettingsPage.tsx")).toContain('<Section title="Classes" id="classes">');
  });
});
