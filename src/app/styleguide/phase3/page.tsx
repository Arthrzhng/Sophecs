import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { Page } from "@/components/layout/Page";
import { ResultCard } from "@/components/card/ResultCard";
import { CardLayout } from "@/components/card/CardLayout";
import { MicroLesson } from "@/components/debate/MicroLesson";
import { SchoolMap, type MapSchool } from "@/components/phase3/SchoolMap";
import { SixSchoolTable } from "@/components/phase3/SixSchoolTable";
import { ElsewhereCard } from "@/components/phase3/ElsewhereCard";
import { PodiumIcon, RankedListIcon, StandingsIcon } from "@/components/phase3/NavIcons";
import { getAllSchools } from "@/lib/schools";
import { getAllMicroLessons } from "@/lib/micro-lessons";
import { PUBLISHED_SCHOOL_IDS, schoolColourVar, type SchoolId } from "@/lib/school-registry";
import { DRAFT_SCHOOL_IDS, schoolDisplayName } from "@/lib/school-registry.drafts";

export const metadata = {
  title: "Phase 3.0 · Sophecs",
  robots: { index: false, follow: false },
};

// Stage 4 of the brief of 2026-11-03: the Phase 3.0 pieces, built on
// /styleguide only, with fixtures, for Arthur to see before Checkpoint A.
// Gated as /styleguide/drafts is: SOPHECS_PREVIEW at build time, or a
// Vercel preview. Production builds it as a static 404, and it reads the
// draft schools on the server only, so no draft name reaches a client
// bundle (npm run check:bundle).
//
// The new schools' colours are chosen, under Arthur's ruling 16 of
// 2026-11-05 (scripts/colour-candidates.mjs); the map's positions are
// docs/quiz-v2.md's, accepted in ruling 15, and the copy is
// docs/daily-path-copy.md §12.

interface Candidate {
  hex: string;
  family: string;
  textOnHero: number;
  dotOnPaper: number;
  minDeltaE: number;
  minDeltaEBlueOrange: number;
  minDeltaEDeuteranopia: number;
  minDeltaEProtanopia: number;
  deuteranopia: string;
  protanopia: string;
  cardSurface: string;
  cardInkFull: number;
  cardInkAtLowestOpacity: number;
}
interface Candidates {
  existing: Record<string, { hex: string; deuteranopia: string; protanopia: string; textOnHero: number }>;
  candidates: Record<string, Candidate[]>;
  chosen: Record<string, string> & { worstPairAllSix: number; worstPairAmongNew: number };
  thresholds: Record<string, number>;
}

// The colour script keys the live schools by their token names.
const TOKEN_KEY: Partial<Record<SchoolId, string>> = {
  stoicism: "stoic",
  utilitarianism: "utilitarian",
  "virtue-ethics": "virtue",
};

// docs/quiz-v2.md, section 2: each school's angle on the map.
const ANGLES: Record<SchoolId, number> = {
  confucian: 50,
  "virtue-ethics": 110,
  stoicism: 165,
  utilitarianism: 245,
  buddhist: 310,
  ubuntu: 0,
};
const AXES = {
  x: ["Each person on their own", "People through each other"] as [string, string],
  y: ["How it turns out", "Who you are and what you owe"] as [string, string],
};

export default function Phase3Page() {
  const visible = process.env.SOPHECS_PREVIEW === "1" || process.env.VERCEL_ENV === "preview";
  if (!visible) notFound();

  const colours = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "docs/phase3-styleguide/colour-candidates.json"), "utf8")
  ) as Candidates;
  const schools = getAllSchools({ includeDrafts: true });
  const elsewhere = getAllMicroLessons({ includeDrafts: true }).filter((l) => l.position === "elsewhere");
  const ALL: SchoolId[] = [...PUBLISHED_SCHOOL_IDS, ...DRAFT_SCHOOL_IDS];
  const nameOf = (id: SchoolId) => schoolDisplayName(id);
  // A live school's own token; a draft school's chosen colour.
  const colourOf = (id: SchoolId) =>
    (PUBLISHED_SCHOOL_IDS as readonly SchoolId[]).includes(id) ? schoolColourVar(id) : colours.chosen[id];
  const chosenOf = (id: SchoolId) => colours.candidates[id].find((c) => c.hex === colours.chosen[id])!;
  const withoutAlternatives = DRAFT_SCHOOL_IDS.filter((id) => colours.candidates[id].length === 1).map(nameOf);
  const mapSchools: MapSchool[] = ALL.map((id) => ({
    id,
    name: nameOf(id),
    angle: ANGLES[id],
    colour: colourOf(id),
  }));

  return (
    <Page width="ui">
      <h1 className="text-xl font-extrabold tracking-tight text-ink">Phase 3.0</h1>
      <p className="mt-1 max-w-[60ch] text-base text-ink-mid">
        Stage 4 of the brief of 3 November: the six-school pieces, on fixtures. Nothing on this
        page is live.
      </p>

      <Section title="The new schools' colours">
        <p className="max-w-[62ch] text-sm leading-relaxed text-ink-mid">
          Chosen by <Mono>scripts/colour-candidates.mjs</Mono> under Arthur&apos;s ruling of 5
          November: the three come from different hue families, at least{" "}
          {colours.thresholds.MIN_HUE_GAP} degrees of hue apart, and each stays at least{" "}
          {colours.thresholds.MIN_DE_CVD} (CIEDE2000) from every live school under simulated
          deuteranopia and protanopia. The other constraints are as before: white hero text at AA, a
          dot that shows on paper, {colours.thresholds.MIN_DE} from the live schools and{" "}
          {colours.thresholds.MIN_DE_OTHERS} from the judge&apos;s blue and the step-done orange in
          normal vision, and none of a school&apos;s stereotyped hues. Each set that passes is scored
          by its closest pair among all six schools under the worst of the three views, rounded to a
          whole unit; of the sets with the best score, this is the one whose three new colours are
          furthest from each other ({colours.chosen.worstPairAmongNew}). Its closest pair is{" "}
          {colours.chosen.worstPairAllSix}. Names always sit beside the colours.
        </p>
        <h3 className="mt-6 text-base font-extrabold text-ink">The six, side by side</h3>
        <ViewRow
          label="Normal vision"
          swatches={ALL.map((id) => ({ name: nameOf(id), colour: colourOf(id) }))}
        />
        {(["deuteranopia", "protanopia"] as const).map((view) => (
          <ViewRow
            key={view}
            label={view === "deuteranopia" ? "Deuteranopia, simulated" : "Protanopia, simulated"}
            swatches={ALL.map((id) => ({
              name: nameOf(id),
              colour: (PUBLISHED_SCHOOL_IDS as readonly SchoolId[]).includes(id)
                ? colours.existing[TOKEN_KEY[id]!][view]
                : chosenOf(id)[view],
            }))}
          />
        ))}
        <p className="mt-8 max-w-[62ch] text-sm leading-relaxed text-ink-mid">
          Beside each chosen colour, the best alternatives for that school with the other two held
          where they are, under the same rules, each at least {colours.thresholds.MIN_DE_BETWEEN} from
          the chosen one.
          {withoutAlternatives.length > 0 &&
            ` ${withoutAlternatives.join(" and ")} ${withoutAlternatives.length === 1 ? "has" : "have"} none that far away.`}
        </p>
        {DRAFT_SCHOOL_IDS.map((id) => (
          <div key={id} className="mt-8">
            <h3 className="text-base font-extrabold text-ink">{nameOf(id)}</h3>
            <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4">
              {colours.candidates[id].map((c) => (
                <CandidateCard
                  key={c.hex}
                  school={nameOf(id)}
                  candidate={c}
                  chosen={c.hex === colours.chosen[id]}
                />
              ))}
            </div>
          </div>
        ))}
      </Section>

      <Section title="The map, in the quiz preview">
        <SchoolMap
          title="Where this answer moves you, on the six-school map"
          schools={mapSchools}
          axes={AXES}
          reader={{ x: -0.18, y: 0.22 }}
          preview={{ x: 0.06, y: 0.31 }}
          caption="Where this answer moves you"
        />
      </Section>

      <Section title="The map, in Profile history">
        <SchoolMap
          title="Where your answers have put you, on the six-school map"
          schools={mapSchools}
          axes={AXES}
          history={[
            { x: 0.32, y: -0.41 },
            { x: 0.12, y: -0.12 },
            { x: -0.2, y: 0.18 },
          ]}
          reader={{ x: -0.2, y: 0.18 }}
          caption="Where your answers have put you"
        />
      </Section>

      <Section title="School table, six rows">
        <p className="mb-4 max-w-[62ch] text-sm text-ink-mid">
          Fixture rows. A school is ranked once it has 20 judged original arguments in the week
          (Arthur&apos;s ruling of 2026-11-05), as on the live table.
        </p>
        <SixSchoolTable
          rows={ALL.map((id, i) => ({
            id,
            name: nameOf(id),
            colour: colourOf(id),
            arguments: [41, 33, 27, 6, 11, 0][i],
            fidelity: [7.4, 6.9, 7.1, 8.0, 6.5, null][i],
          }))}
        />
      </Section>

      <Section title="Today: a view from elsewhere">
        {elsewhere[0] ? <ElsewhereCard lesson={elsewhere[0]} /> : <p>No elsewhere passage in draft.</p>}
      </Section>

      <Section title="Lesson player: a view from elsewhere">
        <p className="mb-4 max-w-[62ch] text-sm text-ink-mid">
          The passage on its own, with no reading check after it.
        </p>
        {elsewhere[0] && (
          <div className="rounded-panel border-2 border-rule bg-surface p-6">
            <MicroLesson lesson={elsewhere[0]} />
          </div>
        )}
      </Section>

      <Section title="Result cards, six schools">
        <p className="mb-4 max-w-[62ch] text-sm text-ink-mid">
          Each school&apos;s own one_line at the card&apos;s 1200 by 630. The new schools&apos; card
          surfaces are darker than their markers by the same step the live schools&apos; are: in
          OKLCH, 0.044 lower in lightness at 0.955 of the chroma, the same hue (Arthur&apos;s
          ruling of 2026-11-05).
        </p>
        <div className="grid gap-6">
          {ALL.map((id) => {
            const s = schools[id];
            const draft = (DRAFT_SCHOOL_IDS as readonly SchoolId[]).includes(id);
            return draft ? (
              <div key={id} style={{ containerType: "inline-size" }} className="w-full overflow-hidden">
                <CardLayout
                  school={id}
                  oneLine={s.one_line}
                  oneLineAttribution={s.one_line_attribution}
                  width={1200}
                  height={630}
                  fonts={{
                    serif: "var(--font-spectral), Georgia, serif",
                    sans: "var(--font-plex-sans), system-ui, sans-serif",
                  }}
                  unit="cqw"
                  surface={chosenOf(id).cardSurface}
                  schoolName={nameOf(id)}
                />
              </div>
            ) : (
              <ResultCard key={id} school={id} oneLine={s.one_line} oneLineAttribution={s.one_line_attribution} />
            );
          })}
        </div>
      </Section>

      <Section title="Result card images, as the OG route renders them">
        <p className="mb-4 max-w-[62ch] text-sm text-ink-mid">
          The same cards through Satori, which is what a shared link shows, so a line that wraps
          differently there is caught here.
        </p>
        <div className="grid gap-6">
          {ALL.map((id) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={id}
              src={`/styleguide/phase3/card/${id}`}
              alt={`Result card image for ${nameOf(id)}`}
              width={1200}
              height={630}
              className="h-auto w-full rounded-card border-2 border-rule"
            />
          ))}
        </div>
      </Section>

      <Section title="Lesson filter chips, six schools">
        <div role="group" aria-label="Filter by school" className="flex flex-wrap gap-2">
          {["All", ...ALL.map(nameOf)].map((label, i) => (
            <button
              type="button"
              key={label}
              aria-pressed={i === 0}
              className={`inline-flex min-h-11 items-center rounded-full border-2 px-4 text-sm font-bold ${
                i === 0 ? "border-ink bg-ink text-paper" : "border-rule-strong bg-surface text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Nav icon for School table">
        <p className="mb-4 max-w-[62ch] text-sm text-ink-mid">
          Three neutral candidates. Each says a table of standings and favours no school&apos;s
          shape.
        </p>
        <ul className="flex flex-wrap gap-4">
          {[
            ["Standings", <StandingsIcon key="s" />],
            ["Ranked list", <RankedListIcon key="r" />],
            ["Podium", <PodiumIcon key="p" />],
          ].map(([label, icon]) => (
            <li key={label as string} className="flex flex-col items-start gap-2">
              <span className="inline-flex min-h-11 items-center gap-2 rounded-chunky bg-paper px-3 text-sm font-bold text-ink">
                {icon}
                School table
              </span>
              <span className="text-xs text-ink-mid">{label}</span>
            </li>
          ))}
        </ul>
      </Section>
    </Page>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 border-t-2 border-rule pt-8">
      <h2 className="mb-4 text-lg font-extrabold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-sm">{children}</span>;
}

function ViewRow({ label, swatches }: { label: string; swatches: { name: string; colour: string }[] }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">{label}</p>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
        {swatches.map((s) => (
          <li key={s.name} className="flex items-center gap-2 text-sm font-bold text-ink">
            <span aria-hidden="true" className="size-4 shrink-0 rounded-full" style={{ background: s.colour }} />
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CandidateCard({
  school,
  candidate: c,
  chosen,
}: {
  school: string;
  candidate: Candidate;
  chosen: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-card border-2 border-rule bg-surface">
      <div className="p-4 text-white" style={{ background: c.hex }}>
        <p className="text-xs font-extrabold tracking-widest uppercase opacity-90">This week&apos;s motion</p>
        <p className="mt-1 text-base font-extrabold leading-tight">The hero banner, in {school}&apos;s colour</p>
      </div>
      <div className="space-y-2 p-4 text-sm text-ink">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bold">
          <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ background: c.hex }} />
          {school} <span className="font-mono text-xs text-ink-mid">{c.hex}</span>
          <span className="text-xs text-ink-mid">{c.family}</span>
          {chosen && <span className="text-xs font-extrabold uppercase text-ink-mid">chosen</span>}
        </p>
        <p className="font-mono text-xs text-ink-mid">
          White text {c.textOnHero}:1 &middot; dot {c.dotOnPaper}:1
          <br />
          Live schools {c.minDeltaE} &middot; blue/orange {c.minDeltaEBlueOrange} &middot; deut{" "}
          {c.minDeltaEDeuteranopia} &middot; prot {c.minDeltaEProtanopia}
          <br />
          Card surface {c.cardSurface === c.hex ? "as marker" : c.cardSurface} &middot; card text at 0.8{" "}
          {c.cardInkAtLowestOpacity}:1
        </p>
        <p className="flex items-center gap-3 text-xs text-ink-mid">
          <span className="flex items-center gap-1">
            <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ background: c.deuteranopia }} />
            deut
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ background: c.protanopia }} />
            prot
          </span>
        </p>
      </div>
    </div>
  );
}
