import { notFound } from "next/navigation";
import { Page } from "@/components/layout/Page";
import { EmptyState } from "@/components/ui/EmptyState";
import { getAllSchools } from "@/lib/schools";
import { getAllModules } from "@/lib/modules";
import { getAllMicroLessons } from "@/lib/micro-lessons";
import { isDraft } from "@/lib/drafts";
import { formatSource } from "@/lib/footnotes";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import { knownSchool } from "@/lib/types";

export const metadata = {
  title: "Drafts · Sophecs",
  robots: { index: false, follow: false },
};

// The review surface for unpublished content.
//
// Draft files are hidden by every loader by default (see lib/drafts.ts).
// This is the only caller that passes `includeDrafts`, and it is gated the
// same way /styleguide/arena is: on SOPHECS_PREVIEW, which lives in a
// gitignored .env.local and is never set in Vercel, or on VERCEL_ENV being
// a preview. Production builds it as a static 404, so a draft cannot be
// read by a production user even by guessing the URL.
//
// Read-only on purpose. Nothing here links into the product, nothing is
// interactive, and the point is to let a draft be read and corrected
// before anyone decides whether it ships.
export default function DraftsPage() {
  const visible =
    process.env.SOPHECS_PREVIEW === "1" || process.env.VERCEL_ENV === "preview";
  if (!visible) notFound();

  const schools = Object.values(getAllSchools({ includeDrafts: true })).filter(isDraft);
  const modules = getAllModules({ includeDrafts: true }).filter(isDraft);
  // Only the third position. A draft "before" or "after" lesson would be a
  // normal lesson that is not finished, and belongs on the arena preview
  // with the reading flow around it, not here.
  const elsewhere = getAllMicroLessons({ includeDrafts: true }).filter(
    (lesson) => lesson.position === "elsewhere"
  );

  const total = schools.length + modules.length + elsewhere.length;

  return (
    <Page width="ui">
      <h1 className="text-xl font-extrabold tracking-tight text-ink">Drafts</h1>
      <p className="mt-1 max-w-[60ch] text-base text-ink-mid">
        Content carrying <Mono>status: draft</Mono>. Hidden from every route in the product and
        from the production build. Nothing on this page is live.
      </p>
      <p className="mt-2 text-sm text-ink-soft">
        <Count n={schools.length} one="school" many="schools" />,{" "}
        <Count n={modules.length} one="module" many="modules" />,{" "}
        <Count n={elsewhere.length} one="passage" many="passages" /> from elsewhere.
      </p>

      {total === 0 && (
        <div className="mt-10">
          <EmptyState
            title="Nothing is in draft."
            body="A file becomes visible here the moment its frontmatter carries status: draft. Until then this page is the proof that the gate holds."
          />
        </div>
      )}

      {schools.length > 0 && (
        <Section title="Schools">
          {schools.map((school) => (
            <article key={school.id} className="rounded-card border-2 border-rule bg-surface p-6">
              <Band>
                <Mono>{school.id}</Mono>
                {school.colour_token && <Mono>{school.colour_token}</Mono>}
              </Band>
              <h2 className="mt-2 font-serif text-lg font-medium text-ink">{school.name}</h2>

              <Field label="one_line">
                <p className="font-serif text-md leading-relaxed text-ink">{school.one_line}</p>
                <p className="mt-1 text-sm text-ink-mid">{school.one_line_attribution}</p>
                {/* The result card's wrap margins were set against the
                    existing three, which run 52 to 96 characters. */}
                <Measure n={school.one_line?.length ?? 0} pass={[52, 96]} unit="characters" />
              </Field>

              <Field label="read">
                <Prose text={school.read} />
                <Measure n={words(school.read)} aim={[165, 175]} pass={[155, 185]} />
              </Field>

              <Field label="gets_wrong">
                <Prose text={school.gets_wrong} />
              </Field>

              <Field label="share_lines">
                <ol className="space-y-2">
                  {(school.share_lines ?? []).map((line, i) => (
                    <li key={i} className="flex gap-3 text-sm text-ink-mid">
                      <span className="font-mono tabular text-ink-soft">{i + 1}</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ol>
              </Field>

              <Field label="verdict_share_line">
                <p className="text-sm text-ink-mid">{school.verdict_share_line}</p>
              </Field>
            </article>
          ))}
        </Section>
      )}

      {modules.length > 0 && (
        <Section title="Modules">
          {modules.map((module) => (
            <article key={module.id} className="rounded-card border-2 border-rule bg-surface p-6">
              <Band>
                <Mono>{module.id}</Mono>
                <SchoolLabel school={module.school} />
              </Band>
              <h2 className="mt-2 font-serif text-lg font-medium text-ink">{module.title}</h2>
              <Field label="quiz_excerpt">
                <p className="text-sm text-ink-mid">{module.quiz_excerpt}</p>
              </Field>
              <Field label="debate_topics">
                <p className="font-mono text-sm text-ink-mid">
                  {module.debate_topics.join(", ") || "none"}
                </p>
              </Field>
              <Field label="sources">
                <ol className="space-y-1">
                  {module.sources.map((source, i) => (
                    <li key={i} className="flex gap-3 text-sm text-ink-mid">
                      <span className="font-mono tabular text-ink-soft">{i + 1}</span>
                      <span>
                        {formatSource(source)}
                        {source.translation && (
                          <span className="block text-ink-soft">
                            Translated by {source.translation}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              </Field>
              <Field label="body">
                <Prose text={module.body} />
                <Measure n={words(module.body)} />
              </Field>
            </article>
          ))}
        </Section>
      )}

      {elsewhere.length > 0 && (
        <Section title="The view from elsewhere">
          {elsewhere.map((lesson) => (
            <article key={lesson.slug} className="rounded-card border-2 border-rule bg-surface p-6">
              <Band>
                <Mono>{lesson.slug}</Mono>
                <Mono>{lesson.topic}</Mono>
                <Mono>{lesson.position}</Mono>
              </Band>
              <h2 className="mt-2 font-serif text-lg font-medium text-ink">{lesson.title}</h2>
              <p className="mt-1 text-sm text-ink-mid">
                {formatSource(lesson.source)}
                {lesson.source.translation && (
                  <span className="block text-ink-soft">
                    Translated by {lesson.source.translation}
                  </span>
                )}
              </p>
              <Field label="body">
                <Prose text={lesson.body} />
                {/* content/micro/README puts a passage at 150 to 250 words. */}
                <Measure n={words(lesson.body)} pass={[150, 250]} />
              </Field>
            </article>
          ))}
        </Section>
      )}
    </Page>
  );
}

function words(text: string | undefined): number {
  return text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 border-t border-rule pt-8">
      <p className="mb-6 text-sm text-ink-soft">{title}</p>
      <div className="space-y-8">{children}</div>
    </section>
  );
}

function Band({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-1">{children}</div>;
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-sm text-ink-soft">{children}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 border-t border-rule pt-4">
      <p className="mb-2 font-mono text-sm text-ink-soft">{label}</p>
      {children}
    </div>
  );
}

function Prose({ text }: { text: string | undefined }) {
  return (
    <div className="space-y-3">
      {(text ?? "").split("\n\n").map((para, i) => (
        <p key={i} className="max-w-[66ch] text-base leading-relaxed text-ink">
          {para}
        </p>
      ))}
    </div>
  );
}

// A draft module may name a school the product does not have yet, so the
// colour and name maps cannot be indexed before narrowing. See
// knownSchool in lib/types.
function SchoolLabel({ school }: { school: string }) {
  return <Mono>{knownSchool(school) ? SCHOOL_COLORS[school].name : school}</Mono>;
}

function Count({ n, one, many }: { n: number; one: string; many: string }) {
  return (
    <>
      <span className="font-mono tabular">{n}</span> {n === 1 ? one : many}
    </>
  );
}

// A count against the bands a draft should land in. Two of them: the aim
// is where a finished piece sits, the pass is the wider range that is
// acceptable. Neither fails anything. The page exists so a draft can be
// read and corrected, so a number out of band is a note to whoever is
// writing it, not a gate.
function Measure({
  n,
  aim,
  pass,
  unit = "words",
}: {
  n: number;
  aim?: [number, number];
  pass?: [number, number];
  unit?: string;
}) {
  const outsidePass = pass !== undefined && (n < pass[0] || n > pass[1]);
  const outsideAim = !outsidePass && aim !== undefined && (n < aim[0] || n > aim[1]);
  const tone = outsidePass ? "text-error" : outsideAim ? "text-ink-mid" : "text-ink-soft";
  return (
    <p className={`mt-2 text-sm ${tone}`}>
      <span className="font-mono tabular">{n}</span> {unit}
      {aim && (
        <>
          {" "}
          (aim <span className="font-mono tabular">{aim[0]}</span> to{" "}
          <span className="font-mono tabular">{aim[1]}</span>
        </>
      )}
      {pass && (
        <>
          {aim ? ", pass " : " (pass "}
          <span className="font-mono tabular">{pass[0]}</span> to{" "}
          <span className="font-mono tabular">{pass[1]}</span>
        </>
      )}
      {(aim || pass) && ")"}
      {outsidePass && ", outside the pass band"}
      {outsideAim && ", outside the aim"}
    </p>
  );
}
