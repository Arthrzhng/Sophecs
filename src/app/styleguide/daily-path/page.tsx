import { ChunkyButton, ChunkyLink } from "@/components/daily-path/ChunkyButton";
import { ChunkyCard } from "@/components/daily-path/ChunkyCard";
import { StatTile } from "@/components/daily-path/StatTile";
import { AxisPanel } from "@/components/daily-path/AxisPanel";
import { SCHOOL_CHUNKY } from "@/components/daily-path/chunky";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import type { SchoolId } from "@/lib/types";
import { InteractivePath, InteractiveCheck, CelebrationDemo } from "./DailyPathClient";

// Stage 1 of the Daily path restyle, and the only place it is visible. Not
// linked from navigation, not in the sitemap, noindex. Everything below is
// wrapped in `data-daily-path`, which is what swaps the palette and the
// interface face in; no other route changes until its own stage lands.
export const metadata = {
  title: "Daily path styleguide · Sophecs",
  robots: { index: false, follow: false },
};

const SCHOOLS: SchoolId[] = ["stoicism", "utilitarianism", "virtue-ethics"];

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 border-t-2 border-rule pt-8">
      <h2 className="text-lg font-extrabold tracking-tight text-ink">{title}</h2>
      {note && <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-ink-mid">{note}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Swatch({ token, label }: { token: string; label: string }) {
  return (
    <div>
      <div
        className="h-14 w-full rounded-chunky border-2 border-rule"
        style={{ backgroundColor: `var(--color-${token})` }}
      />
      <p className="mt-2 text-sm text-ink">{label}</p>
      <p className="font-mono text-xs text-ink-soft">--color-{token}</p>
    </div>
  );
}

export default function DailyPathStyleguide() {
  return (
    <div data-daily-path className="min-h-screen">
      <div className="mx-auto max-w-ui px-6 py-12">
        <p className="text-sm text-ink-mid">Stage 1</p>
        <h1 className="mt-1 text-xl font-extrabold tracking-tight text-ink">
          Daily path: tokens and components
        </h1>
        <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-ink-mid">
          Every token and every shared component in every state, on one page.
          Nothing here is wired to real data yet, and no other screen in the
          product has changed. Copy is taken from docs/daily-path-copy.md and
          from the reading check in content/micro.
        </p>

        <Section
          title="Base palette"
          note="These override the existing paper/ink/rule tokens inside this wrapper only. Outside it the product keeps its current colours until each screen's own stage."
        >
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-5">
            <Swatch token="paper" label="Paper" />
            <Swatch token="surface" label="Surface" />
            <Swatch token="ink" label="Ink" />
            <Swatch token="ink-mid" label="Muted" />
            <Swatch token="rule" label="Line" />
            <Swatch token="rule-strong" label="Line strong" />
          </div>
        </Section>

        <Section
          title="New semantic colours"
          note="Right is blue, not green: the only green in this product means Stoicism. Right and wrong are never carried by colour alone, which the sheet below shows."
        >
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-5">
            <Swatch token="correct" label="Correct" />
            <Swatch token="correct-tint" label="Correct tint" />
            <Swatch token="wrong" label="Wrong" />
            <Swatch token="wrong-tint" label="Wrong tint" />
            <Swatch token="streak" label="Streak" />
            <Swatch token="step-done" label="Step done" />
            <Swatch token="step-done-deep" label="Step done deep" />
            <Swatch token="stoic-deep" label="Stoic deep" />
            <Swatch token="utilitarian-deep" label="Utilitarian deep" />
            <Swatch token="virtue-deep" label="Virtue deep" />
          </div>
        </Section>

        <Section
          title="Type"
          note="Bricolage Grotesque carries the interface. Spectral still carries every passage, quotation and argument. Every number is mono."
        >
          <div className="flex flex-col gap-4">
            <p className="text-xl font-extrabold text-ink">Bricolage Grotesque 800</p>
            <p className="text-lg font-semibold text-ink">Bricolage Grotesque 600</p>
            <p className="text-base font-medium text-ink">Bricolage Grotesque 500</p>
            <p className="font-serif text-md text-ink">
              Of things some are in our power, and others are not.
            </p>
            <p className="font-mono tabular text-md text-ink">1200 · 84 · 7/10</p>
          </div>
        </Section>

        <Section
          title="Chunky buttons"
          note="The primary action takes the reader's own school colour. Press any of them: the button travels the full 5px down onto its edge."
        >
          <div className="flex flex-wrap items-center gap-5">
            {SCHOOLS.map((s) => (
              <ChunkyButton key={s} school={s}>
                {SCHOOL_COLORS[s].name}
              </ChunkyButton>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-5">
            <ChunkyButton tone="paper">Open the case</ChunkyButton>
            <ChunkyButton tone="correct">Next question</ChunkyButton>
            <ChunkyButton tone="wrong">Next question</ChunkyButton>
            <ChunkyButton disabled>Check</ChunkyButton>
            <ChunkyLink href="/styleguide/daily-path" tone="paper">
              A link, same shape
            </ChunkyLink>
          </div>
        </Section>

        <Section
          title="Cards"
          note="Only a card that carries its own colour is raised. Giving every card an edge would flatten the hierarchy the edge exists to create."
        >
          <div className="flex flex-col gap-6">
            <ChunkyCard
              raised
              background={SCHOOL_CHUNKY.stoicism.bg}
              shadeColor={SCHOOL_CHUNKY.stoicism.shade}
              className="text-white"
            >
              <p className="text-xs font-extrabold tracking-widest uppercase opacity-90">
                This week&apos;s motion
              </p>
              <p className="mt-2 text-lg font-extrabold">Does the model decide?</p>
            </ChunkyCard>
            <ChunkyCard>
              <p className="text-sm text-ink-mid">
                A flat card. Two-pixel rule, no edge.
              </p>
            </ChunkyCard>
            <div className="grid max-w-md grid-cols-2 gap-3.5">
              <StatTile label="Reading check" value="2/2" />
              <StatTile label="Notes written" value="2/2" />
            </div>
          </div>
        </Section>

        <Section
          title="The path"
          note="Six nodes, done / up next / locked. A locked node stays a real disabled button so it keeps its place and its name for a screen reader. Steps 3 to 6 are shown locked by judging, which is their real state today."
        >
          <InteractivePath />
        </Section>

        <Section
          title="Check your reading"
          note="One real question in the lesson player, framed at phone height; the route opens the same step as a full-screen overlay. Pick an option and press Check. The result is carried by the heading, by the mark in the right-hand column (tick against cross), by the sentence under the heading and by colour, so no one of them is load-bearing alone. The X leaves without recording anything."
        >
          <InteractiveCheck />
        </Section>

        <Section
          title="Celebration"
          note="No streak tile and no flame on this screen: reading does not extend a streak. The burst is decorative and is the first thing reduced motion removes."
        >
          <CelebrationDemo />
        </Section>

        <Section
          title="What the judge looks for"
          note="Three criteria, not four. The composite score out of 100 is not one of them: on the verdict it is the large circle. Shown on the argue screen beside the editor."
        >
          <div className="max-w-sm">
            <AxisPanel />
          </div>
        </Section>

        <Section
          title="Reduced motion"
          note="Everything above that moves is opt-in under prefers-reduced-motion: no-preference. With reduced motion asked for, the bob, the ring, the pop, the flame, the sheet slide and the confetti are all simply absent and the content is already in place."
        >
          <p className="text-sm text-ink-mid">
            Turn the preference on in your operating system and reload to check.
          </p>
        </Section>
      </div>
    </div>
  );
}
