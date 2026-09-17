import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/Button";
import { TextLink } from "@/components/ui/TextLink";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { InteractiveSection } from "./StyleguideClient";

// Not linked from navigation and excluded from the sitemap. This is the
// review surface: every token and every primitive in every state, on one
// page, so a regression is visible rather than hunted for.
export const metadata = {
  title: "Styleguide · Sophecs",
  robots: { index: false, follow: false },
};

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 border-t border-rule pt-8">
      <h2 className="font-serif text-lg font-medium">{title}</h2>
      {note && <p className="mt-2 max-w-[54ch] text-sm leading-relaxed text-ink-mid">{note}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Swatch({ name, value, on = "paper" }: { name: string; value: string; on?: string }) {
  return (
    <div>
      <div
        className="h-14 w-full border border-rule"
        style={{ backgroundColor: `var(--color-${value})` }}
      />
      <p className="mt-2 text-sm text-ink">{name}</p>
      <p className="font-mono text-xs text-ink-soft">
        --color-{value} on {on}
      </p>
    </div>
  );
}

const BASE = [
  ["Paper", "paper"],
  ["Surface", "surface"],
  ["Ink", "ink"],
  ["Ink mid", "ink-mid"],
  ["Ink soft", "ink-soft"],
  ["Rule", "rule"],
  ["Rule strong", "rule-strong"],
];

const SEMANTIC = [
  ["Error", "error"],
  ["Success (= ink)", "success"],
];

const SCHOOL = [
  ["Stoic", "stoic"],
  ["Utilitarian", "utilitarian"],
  ["Virtue", "virtue"],
];

const SATURATED = [
  ["Stoic surface", "stoic-surface"],
  ["Utilitarian surface", "utilitarian-surface"],
  ["Virtue surface", "virtue-surface"],
];

const TYPE_STEPS: { step: string; px: string; sample: string; cls: string }[] = [
  { step: "xl", px: "34px", sample: "Serif 500 — page titles and motions", cls: "font-serif text-xl font-medium" },
  { step: "lg", px: "24px", sample: "Serif 500 — section headings", cls: "font-serif text-lg font-medium" },
  { step: "md", px: "19px", sample: "Serif 400 — reading body, the only step with one family", cls: "font-serif text-md" },
  { step: "base", px: "16px", sample: "Sans 400 — interface body", cls: "font-sans text-base" },
  { step: "sm", px: "14px", sample: "Sans 400 — labels, secondary prose", cls: "font-sans text-sm" },
  { step: "xs", px: "12px", sample: "Sans 400 — metadata and captions", cls: "font-sans text-xs" },
];

export default function StyleguidePage() {
  return (
    <Page width="ui">
      <h1 className="font-serif text-xl font-medium">Styleguide</h1>
      <p className="mt-3 max-w-[54ch] text-sm leading-relaxed text-ink-mid">
        Every token and every primitive in every state. Not linked from
        navigation and not indexed. If something here looks wrong, it is
        wrong everywhere.
      </p>

      <Section title="Base palette" note="One grey ramp, all four steps derived from ink so nothing reads blue or green against it.">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {BASE.map(([name, value]) => (
            <Swatch key={value} name={name} value={value} />
          ))}
        </div>
      </Section>

      <Section title="Semantic" note="Success is ink. A confirmation is a statement of fact, not a reward, and the only green in this product means Stoicism.">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {SEMANTIC.map(([name, value]) => (
            <Swatch key={value} name={name} value={value} />
          ))}
        </div>
      </Section>

      <Section
        title="School markers"
        note="Frozen values. Only ever a 2px rule, a 1px underline, a filled card, or text at 24px and above. Never a link, button, icon or focus ring."
      >
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {SCHOOL.map(([name, value]) => (
            <Swatch key={value} name={name} value={value} />
          ))}
        </div>
        <div className="mt-8 space-y-4">
          <div className="border-l-2 border-stoic pl-4">
            <p className="text-sm text-ink-mid">Permitted: a 2px left rule on a school-specific surface.</p>
            <p className="mt-1 text-sm text-ink">You argue this as a Stoic.</p>
          </div>
          <div className="border-l-2 border-utilitarian pl-4">
            <p className="text-sm text-ink-mid">The school is always named in text, never only in colour.</p>
            <p className="mt-1 text-sm text-ink">Objection from Utilitarianism.</p>
          </div>
        </div>
      </Section>

      <Section title="Saturated surfaces" note="The result card only. Any other component referencing these is a bug.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {SATURATED.map(([name, value]) => (
            <div
              key={value}
              className="p-6"
              style={{ backgroundColor: `var(--color-${value})`, color: "var(--color-on-saturated)" }}
            >
              <p className="text-sm">{name}</p>
              <p className="mt-2 font-serif text-lg font-medium">Stoicism</p>
              <p className="mt-1 font-mono text-xs">--color-{value}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type scale" note="Six steps. Serif never below 16px. Sans never above 24px. Mono only ever holds a number.">
        <div className="space-y-6">
          {TYPE_STEPS.map((t) => (
            <div key={t.step} className="border-t border-rule pt-4">
              <p className="font-mono text-xs text-ink-soft tabular">
                text-{t.step} · {t.px}
              </p>
              <p className={`mt-2 ${t.cls}`}>{t.sample}</p>
            </div>
          ))}
          <div className="border-t border-rule pt-4">
            <p className="font-mono text-xs text-ink-soft">mono, measured values only</p>
            <p className="mt-2 font-mono text-lg font-medium tabular">1206</p>
            <p className="font-mono text-base tabular">72 · 8.0 · +6</p>
          </div>
        </div>
      </Section>

      <Section title="Reading measure" note="66ch of Spectral at 19px. The brief's 60–72 band.">
        <div className="prose-reading">
          <p>
            The Enchiridion opens with a sorting. Some things are up to us and
            some are not, Epictetus says, and he gives both lists. Up to us:
            opinion, impulse, desire, aversion, &ldquo;in a word, whatever is our
            own doing.&rdquo;
          </p>
          <p>
            Notice what is on the short list. Not outcomes, and not even actions
            in the ordinary sense, since actions depend on a body that can be
            stopped.
          </p>
        </div>
      </Section>

      <Section title="Buttons" note="Three variants, one shape, 44px minimum. Focus comes from one global rule, so a new variant cannot forget it.">
        <div className="space-y-6">
          {(["primary", "secondary", "quiet"] as const).map((variant) => (
            <div key={variant}>
              <p className="font-mono text-xs text-ink-soft">{variant}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Button variant={variant}>Start the quiz</Button>
                <Button variant={variant} disabled>
                  Disabled
                </Button>
                <Button variant={variant} loading loadingLabel="Submitting…">
                  Submit argument
                </Button>
              </div>
            </div>
          ))}
          <p className="text-sm text-ink-mid">
            Hover and focus are live — tab through the row above. There is no
            hover transition: a 180ms fade between intent and acknowledgement
            buys nothing.
          </p>
        </div>
      </Section>

      <Section title="Links" note="Underlined always, not on hover. No arrow glyph is ever appended.">
        <p className="text-base text-ink">
          The rubric is <TextLink href="/debate/rubric">published in full</TextLink>, and
          every verdict links to it.
        </p>
      </Section>

      <Section title="Fields" note="The label is always a real label, never a placeholder. Error state pairs a border with a message; colour never carries the fact alone.">
        <div className="grid gap-8 sm:grid-cols-2">
          <Input id="sg-name" label="Display name" hint="Shown on published arguments." placeholder="A Stoic" />
          <Input id="sg-err" label="Email" defaultValue="not-an-email" error="That does not look like an email address." />
          <Input id="sg-disabled" label="Disabled" placeholder="Not editable" disabled />
          <Select
            id="sg-select"
            label="Status"
            options={[
              { value: "all", label: "Any status" },
              { value: "open", label: "Open" },
              { value: "judged", label: "Judged" },
            ]}
          />
          <div className="sm:col-span-2">
            <Textarea
              id="sg-textarea"
              label="Your argument"
              hint="Between 80 and 400 words."
              rows={6}
              serif
              count="163 / 400 words"
              placeholder="State what a Stoic would say about this motion."
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              id="sg-textarea-over"
              label="Over the limit"
              rows={3}
              serif
              count="431 / 400 words"
              countOverLimit
              error="Trim this to 400 words before submitting."
              defaultValue="…"
            />
          </div>
        </div>
      </Section>

      <Section title="Dialog and toast" note="Dialog is the native element — the browser supplies the focus trap, Escape and top-layer stacking. Both are allowed a shadow because they genuinely float.">
        <InteractiveSection />
      </Section>

      <Section title="Empty state" note="Says what to do first, not that something is empty.">
        <EmptyState
          title="No open motions yet."
          body="Six motions are live. Take the one for this week and you will have a verdict in about ten minutes."
          action={<Button>See the motions</Button>}
        />
      </Section>

      <Section title="Error state" note="What happened, and what to do. No apology, no exclamation mark.">
        <ErrorState
          title="The judge is unavailable."
          body="Your argument is saved. Judging is paused while we check something; come back and submit it later today."
          detail="reason: kill_switch"
          action={<Button variant="secondary">Back to the motions</Button>}
        />
      </Section>

      <Section title="Skeleton" note="Static, not shimmering. A pulse is motion that is not a response to anything the user did.">
        <div className="max-w-read space-y-3">
          <Skeleton className="h-6 w-2/3" label="Loading the motion" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </Section>

      <Section title="Radius, shadow, rule" note="Two radii applied by kind: controls are rounded, content is square. Two shadows, both for things that float.">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="rounded-control border border-rule bg-surface p-4">
            <p className="text-sm text-ink">rounded-control</p>
            <p className="mt-1 font-mono text-xs text-ink-soft">6px · buttons, inputs</p>
          </div>
          <div className="border border-rule bg-surface p-4">
            <p className="text-sm text-ink">square</p>
            <p className="mt-1 font-mono text-xs text-ink-soft">0px · content containers</p>
          </div>
          <div className="border border-rule bg-paper p-4 shadow-overlay">
            <p className="text-sm text-ink">shadow-overlay</p>
            <p className="mt-1 font-mono text-xs text-ink-soft">dialogs, share sheet</p>
          </div>
        </div>
      </Section>
    </Page>
  );
}
