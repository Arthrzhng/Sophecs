"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MicroLesson } from "./MicroLesson";
import { PublishToggle } from "./PublishToggle";
import { ShareRow } from "./ShareRow";
import { FindCounterpartButton } from "./FindCounterpartButton";
import { ChunkyLink } from "@/components/daily-path/ChunkyButton";
import { TextLink } from "@/components/ui/TextLink";
import { ErrorState } from "@/components/ui/ErrorState";
import { track } from "@/lib/analytics/client";
import { SCHOOL_ADHERENT_PLURAL, SCHOOL_ARTICLE, SCHOOL_COLORS } from "@/lib/school-colors";
import { SCHOOL_CHUNKY, shade } from "@/components/daily-path/chunky";
import { JUDGE_AXES, AXIS_MAX } from "@/lib/judge-axes";
import { SampleLabel } from "@/components/sample/SampleLabel";
import { SAMPLE_ASSESSMENT, SAMPLE_ASSESSMENT_NOTE } from "@/lib/sample";
import type { MicroLessonContent } from "@/lib/lesson-chunks";
import type { SchoolId } from "@/lib/types";

export interface VerdictData {
  rejected: boolean;
  rejection_reason?: string | null;
  score: number | null;
  fidelity: number | null;
  rigor: number | null;
  engagement: number | null;
  // Absent, and the objection's claim and why_it_stands null, when the
  // verdict is withheld (withheldVerdict in src/lib/verdict-privacy.ts, and
  // migration 0018): the judge quotes the argument, so a private
  // argument's verdict shows only its scores to anyone but its author.
  strongest_move?: string | null;
  weakest_move?: string | null;
  a_stronger_version_would?: string | null;
  verdict_line?: string | null;
  // v2 onwards. Absent on verdicts judged under v1, which exist in
  // production — every read of this is guarded.
  unanswered_objection?: {
    school: SchoolId;
    claim: string | null;
    why_it_stands: string | null;
  } | null;
  // Only ever set on a revision — the judge is shown the original and the
  // objection, and says whether the objection was actually engaged.
  objection_answered?: boolean;
  improvement_note?: string | null;
}

// docs/daily-path-copy.md, "A verdict on a private argument, seen by
// someone else".
const WITHHELD_HEADING = "The verdict on a private argument";
const WITHHELD_NOTE =
  "The judge's note can quote the argument, so only the person who wrote it can read it while the argument is private.";
const WITHHELD_REJECTED =
  "The judge set this argument aside without a score. Its reason can quote the argument, so only the person who wrote it can read it.";
// The same two, for a sample assessment, which no judge wrote.
const WITHHELD_NOTE_TEMPLATE =
  "These notes can quote the argument, so they are shown only while the argument is public.";
const WITHHELD_REJECTED_TEMPLATE =
  "This argument was set aside without a score. The reason can quote the argument, so it is shown only while the argument is public.";
// The article is the adherent noun's: every school's name begins with the
// same sound as its noun ("an Ubuntu objection", "an Ubuntu Ethicist"),
// which tests/six-schools.test.ts checks for all six.
function withheldObjection(school: SchoolId): string {
  return `The argument left ${SCHOOL_ARTICLE[school]} ${SCHOOL_COLORS[school].name} objection standing. Its wording can quote the argument, so only the person who wrote it can read it.`;
}

// The parent's four marks, so a revision can be read against its original.
export interface RevisionComparison {
  parentDebateId: string;
  first: {
    score: number | null;
    fidelity: number | null;
    rigor: number | null;
    engagement: number | null;
  };
}

// One of the judge's three paragraphs, with the label it came with. Sans
// at the small step, sentence case, no colon — a label, not a field name.
function Reading({ label, body }: { label: string; body?: string | null }) {
  if (!body) return null;
  return (
    <div>
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="prose-reading mt-1">{body}</p>
    </div>
  );
}

// A signed number, never coloured. Green for up and red for down turns a
// rating change into a reward, which is the opposite of what a rubric is
// for.
function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `\u2212${Math.abs(n)}` : "0";
}

// One row of the revision comparison. Deliberately monospaced and
// uncoloured: a delta is a number to read, not a verdict to feel.
function DeltaRow({
  label,
  before,
  after,
}: {
  label: string;
  before: number | null;
  after: number | null;
}) {
  const delta = before != null && after != null ? after - before : null;
  const fmt = (n: number | null) => (n == null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(1));
  return (
    <tr className="border-b border-rule last:border-b-0">
      <th scope="row" className="py-3 text-left text-sm font-normal text-ink-mid">
        {label}
      </th>
      <td className="py-3 text-right font-mono text-sm tabular text-ink-soft">
        {fmt(before)}
      </td>
      <td className="py-3 pl-4 text-right font-mono text-sm tabular text-ink">{fmt(after)}</td>
      <td className="py-3 pl-6 text-right font-mono text-sm tabular text-ink-mid">
        {delta == null ? "—" : signed(Number(delta.toFixed(1)))}
      </td>
    </tr>
  );
}

export function Verdict({
  debateId,
  topicSlug,
  motion,
  school,
  verdict,
  eloDelta,
  eloAfter,
  streak,
  weekNumber,
  tableContribution,
  argument,
  isOwner,
  argumentPublic,
  afterLesson,
  showAfterLessonInitially,
  shareLine,
  hasRevision,
  comparison,
  counterpart,
  textWithheld = false,
  sample = null,
}: {
  debateId: string;
  topicSlug: string;
  motion: string;
  school: SchoolId;
  verdict: VerdictData;
  eloDelta: number | null;
  /** The rating this argument left the reader on. */
  eloAfter?: number | null;
  /** The owner's streak. Absent on someone else's verdict. */
  streak?: number | null;
  /** ISO week the argument was written in. */
  weekNumber?: number | null;
  /**
   * What this argument added to its school's row on the table: one, for a
   * judged argument, and nothing at all for a rejected one. Passed in
   * rather than assumed, so the day the table counts something other than
   * arguments this is one line, not a hunt.
   */
  tableContribution?: number | null;
  argument: string | null;
  isOwner: boolean;
  argumentPublic: boolean;
  afterLesson: MicroLessonContent | null;
  showAfterLessonInitially: boolean;
  shareLine: string;
  hasRevision?: string | null;
  comparison?: RevisionComparison | null;
  // Absent on a revision and on someone else's verdict.
  counterpart?: { seeking: boolean; exchangeId: string | null } | null;
  /**
   * Someone other than the author, looking at a private argument's verdict
   * (or a revision of a private one): the page has already cut the verdict
   * down to what cannot quote it, and this says so in place of the judge's
   * words rather than leaving the spaces empty.
   */
  textWithheld?: boolean;
  /**
   * Set on an argument a sample account made (migration 0023). It gets the
   * Sample label, no share row, and no view events. `template` is a
   * verdict written from a template rather than by the judge: it says so,
   * and nothing on the page claims the judge read it.
   */
  sample?: { template: boolean } | null;
}) {
  const [showAfter, setShowAfter] = useState(showAfterLessonInitially);
  const objection = verdict.rejected ? null : verdict.unanswered_objection ?? null;
  const template = Boolean(sample?.template);

  // elo_changed fires once, from ArgumentEditor right after judging — not
  // here, since this component also renders on every later revisit of the
  // same verdict page and would otherwise re-fire it on each view.
  // A view of a sample account's argument is not engagement with anyone's
  // work, so it is not counted (docs/sample-activity.md, "Metrics").
  useEffect(() => {
    if (sample) return;
    track({
      name: "verdict_viewed",
      props: { debate_id: debateId, score: verdict.score ?? 0, is_owner: isOwner, rejected: verdict.rejected },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (objection && !sample) {
      track({
        name: "objection_viewed",
        props: { debate_id: debateId, rival_school: objection.school, is_owner: isOwner },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showAfter && afterLesson) {
      track({ name: "micro_lesson_viewed", props: { slug: afterLesson.slug, position: "after" } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAfter]);

  if (verdict.rejected) {
    return (
      <div>
        {sample && <SampleLabel />}
        <p className="text-sm text-ink-soft">{template ? SAMPLE_ASSESSMENT : "Verdict"}</p>
        <h1 className="mt-1 max-w-[60ch] font-serif text-lg font-medium leading-snug text-ink">
          {motion}
        </h1>
        <div className="mt-8">
          <ErrorState
            title="This was not judged."
            body={
              textWithheld
                ? template
                  ? WITHHELD_REJECTED_TEMPLATE
                  : WITHHELD_REJECTED
                : (verdict.rejection_reason ??
                  (template ? "No reason was recorded." : "The judge returned no verdict for this argument."))
            }
            action={
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <TextLink href={`/debate/${topicSlug}`}>Write it again</TextLink>
                <TextLink href="/debate/rubric">What the judge is looking for</TextLink>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      {sample && <SampleLabel className="mb-4" />}
      <div className="flex flex-wrap items-center gap-6">
        {/* The composite out of 100. It is not one of the three criteria,
            which is why it sits apart from them rather than as a fourth
            row in the table below. */}
        <div
          className="chunky flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-full text-white"
          style={{ ...shade(SCHOOL_CHUNKY[school].shade), background: SCHOOL_CHUNKY[school].bg }}
        >
          <span className="text-xs font-extrabold tracking-widest uppercase opacity-90">
            Score
          </span>
          <span className="font-mono tabular text-xl font-extrabold leading-none">
            {verdict.score ?? "\u2014"}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          {weekNumber != null && (
            <p className="text-sm text-ink-mid">
              Week {weekNumber} &middot; {template ? SAMPLE_ASSESSMENT.toLowerCase() : "verdict is in"}
            </p>
          )}
          <h1 className="mt-1 max-w-[34ch] text-xl font-extrabold leading-tight tracking-tight text-ink">
            {textWithheld ? WITHHELD_HEADING : verdict.verdict_line}
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-mid">
            {eloDelta != null && eloAfter != null && (
              <span>
                Rating <span className="font-mono tabular text-ink">{signed(eloDelta)}</span>{" "}
                &rarr; <span className="font-mono tabular text-ink">{eloAfter}</span>
              </span>
            )}
            {streak != null && (
              <span>
                Streak &middot; Day <span className="font-mono tabular text-ink">{streak}</span>
              </span>
            )}
            {/* The school table exists as of stage 6, so the verdict can
                say what this argument did for the reader's side. A link,
                not a chip: the number is only worth anything next to the
                row it landed in. */}
            {tableContribution != null && tableContribution > 0 && (
              <span>
                <Link
                  href="/table"
                  className="inline-flex min-h-11 items-center text-ink underline underline-offset-4"
                >
                  <span className="font-mono tabular">+{tableContribution}</span>
                  &nbsp;for the {SCHOOL_ADHERENT_PLURAL[school]} on the table
                </Link>
              </span>
            )}
          </p>
        </div>
      </div>

      <p className="mt-6 max-w-[60ch] font-serif text-md leading-snug text-ink-mid">{motion}</p>

      {/* Three criteria, not four. The table this replaces counted the
          overall score as an axis, which is where the recurring "four
          axes" in the mockups came from; judge.v2.md defines three and one
          composite, and the composite is the circle above. */}
      <section className="mt-10 border-t-2 border-rule pt-8">
        <h2 className="text-lg font-extrabold tracking-tight text-ink">
          {template ? SAMPLE_ASSESSMENT : "How the judge scored you"}
        </h2>
        {template && (
          <p className="mt-2 max-w-[60ch] text-sm text-ink-mid">{SAMPLE_ASSESSMENT_NOTE}</p>
        )}
        <ul className="mt-5 max-w-[40rem] space-y-4">
          {JUDGE_AXES.map((axis) => {
            const value = verdict[axis.key];
            return (
              <li
                key={axis.key}
                className="flex items-baseline justify-between gap-6 border-b border-rule pb-3"
              >
                <span className="text-base font-bold text-ink">{axis.label}</span>
                {/* Fixed to one decimal so 8.0 and 6.5 line up in the
                    column, which the table this replaces also did. */}
                <span className="shrink-0 font-mono tabular text-base text-ink">
                  {value == null ? "\u2014" : value.toFixed(1)}
                  <span className="text-ink-mid"> / {AXIS_MAX}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      <p className="mt-3 text-sm">
        <TextLink href="/debate/rubric">
          {template ? "What the judge looks for" : "How this was judged"}
        </TextLink>
      </p>

      {/* The judge's reading of the argument. The one-line summary is a
          heading, and each of the three paragraphs keeps its label: without
          them the reader has to work out which paragraph is praise, which
          is the problem, and which is the instruction — information the
          judge already supplied. */}
      <div className="mt-10 border-t-2 border-rule pt-8">
        {/* The one-line verdict is the page heading now, so it is not
            repeated here; what follows is the judge's reading of the
            argument, which is what this section was always for. */}
        <h2 className="text-lg font-extrabold tracking-tight text-ink">
          {template ? "Notes on the argument" : <>The judge&apos;s note</>}
        </h2>
        {textWithheld ? (
          <p className="prose-reading mt-6">{template ? WITHHELD_NOTE_TEMPLATE : WITHHELD_NOTE}</p>
        ) : (
          <div className="mt-6 space-y-6">
            <Reading label="Strongest move" body={verdict.strongest_move} />
            <Reading label="Weakest move" body={verdict.weakest_move} />
            <Reading label="A stronger version would" body={verdict.a_stronger_version_would} />
          </div>
        )}
      </div>

      {objection && (
        <div className="mt-10 max-w-[60ch] border-t border-rule pt-8">
          <p className="text-sm text-ink-soft">The objection you left standing</p>
          {/* The rival school's colour, on the rival school's objection —
              the one place on this screen a tribal marker means something. */}
          <div
            className="mt-4 border-l-2 pl-4"
            style={{ borderColor: SCHOOL_COLORS[objection.school].surface }}
          >
            <p className="text-sm text-ink-mid">{SCHOOL_COLORS[objection.school].name}</p>
            {textWithheld ? (
              <p className="mt-2 text-sm leading-relaxed text-ink-mid">
                {withheldObjection(objection.school)}
              </p>
            ) : (
              <>
                <p className="mt-2 font-serif text-md leading-relaxed text-ink">{objection.claim}</p>
                <p className="mt-3 text-sm leading-relaxed text-ink-mid">{objection.why_it_stands}</p>
              </>
            )}
          </div>

          {/* A revision can't itself be revised — one attempt per objection,
              so the judge's new objection here is something to carry into the
              next motion rather than a button. */}
          {isOwner && comparison && (
            <p className="mt-6 text-sm text-ink-soft max-w-[50ch]">
              One revision per argument. Take this objection into your next motion.
            </p>
          )}

          {isOwner && !comparison && (
            <div className="mt-6 flex flex-wrap items-center gap-4">
              {hasRevision ? (
                <TextLink href={`/debate/${topicSlug}/${hasRevision}`} className="text-sm">
                  Answered — read the revision
                </TextLink>
              ) : (
                <>
                  {/* The reader's own school: answering the objection is
                      their action. The objecting school is named above in
                      its own colour. See docs/decisions.md. */}
                  <ChunkyLink
                    href={`/debate/${topicSlug}/${debateId}/revise`}
                    school={school}
                    onClick={() =>
                      track({ name: "objection_answer_started", props: { debate_id: debateId } })
                    }
                  >
                    Answer it
                  </ChunkyLink>
                  {/* A plain sentence, not a tooltip on a question mark. */}
                  <span className="text-sm text-ink-mid">
                    Answering does not change your ELO. Leave it and it waits on your profile.
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Below the objection block, not beside it: "Answer it" stays the
          primary move off a verdict, and this is the other thing you can do
          with the same argument. */}
      {isOwner && counterpart && !comparison && (
        <div className="mt-10 border-t border-rule pt-8">
          <p className="mb-3 text-sm text-ink-soft">Counterpart</p>
          <FindCounterpartButton
            debateId={debateId}
            topicSlug={topicSlug}
            initialSeeking={counterpart.seeking}
            existingExchangeId={counterpart.exchangeId}
          />
        </div>
      )}

      <div className="mt-10 border-t border-rule pt-8">
        {argument ? (
          <div className="max-w-[60ch]">
            <p className="font-sans text-xs text-ink-mid mb-2">The argument</p>
            <p className="font-serif text-base leading-relaxed whitespace-pre-wrap">{argument}</p>
          </div>
        ) : (
          <p className="text-sm text-ink-soft">The author has not published this argument.</p>
        )}
      </div>

      {afterLesson && (
        <div className="mt-10 border-t-2 border-rule pt-8">
          <h2 className="text-lg font-extrabold tracking-tight text-ink">Read next</h2>
          {showAfter ? (
            <div className="mt-6">
              <MicroLesson lesson={afterLesson} />
            </div>
          ) : (
            /* The title rather than "read the objection again": a reader
               who has just been handed an objection is being offered the
               passage that answers it, and naming it says which one. */
            <button
              type="button"
              onClick={() => setShowAfter(true)}
              className="mt-3 inline-flex min-h-11 max-w-[48ch] items-center text-left font-serif text-md text-ink underline underline-offset-4 hover:text-ink-mid"
            >
              {afterLesson.title}
            </button>
          )}
        </div>
      )}

      {comparison && (
        <div className="mt-10 max-w-[34rem] border-t border-rule pt-8">
          <p className="text-sm text-ink-soft">Compared with your first attempt</p>

          {/* The same four axes as the verdict above, read against the
              original. Lost its rows in the Phase 3 rewrite and rendered an
              empty heading until lint flagged DeltaRow as unused. */}
          <table className="mt-4 w-full border-t border-rule">
            <thead>
              <tr className="border-b border-rule">
                <th scope="col" className="py-2 text-left text-sm font-normal text-ink-soft">
                  Axis
                </th>
                <th scope="col" className="py-2 text-right text-sm font-normal text-ink-soft">
                  First
                </th>
                <th scope="col" className="py-2 pl-4 text-right text-sm font-normal text-ink-soft">
                  Now
                </th>
                <th scope="col" className="py-2 pl-6 text-right text-sm font-normal text-ink-soft">
                  Change
                </th>
              </tr>
            </thead>
            <tbody>
              <DeltaRow label="Overall" before={comparison.first.score} after={verdict.score} />
              <DeltaRow
                label="Fidelity"
                before={comparison.first.fidelity}
                after={verdict.fidelity}
              />
              <DeltaRow label="Rigor" before={comparison.first.rigor} after={verdict.rigor} />
              <DeltaRow
                label="Engagement"
                before={comparison.first.engagement}
                after={verdict.engagement}
              />
            </tbody>
          </table>

          {verdict.objection_answered != null && (
            <p className="mt-6 text-sm text-ink">
              {verdict.objection_answered ? "Objection answered." : "Objection still standing."}
            </p>
          )}
          {verdict.improvement_note && !textWithheld && (
            <p className="prose-reading mt-3">{verdict.improvement_note}</p>
          )}

          <p className="mt-6 text-sm">
            <TextLink href={`/debate/${topicSlug}/${comparison.parentDebateId}`}>
              Read the first attempt
            </TextLink>
          </p>
        </div>
      )}

      <div className="mt-10 border-t-2 border-rule pt-8">
        {/* Nothing to share: a sample account's argument is nobody's to
            pass on as their own. */}
        {!sample && (
          <ShareRow debateId={debateId} topicSlug={topicSlug} score={verdict.score ?? 0} shareLine={shareLine} />
        )}
        {/* After the reader's own argument, not before it, so the
            exemplars are something to compare against rather than copy
            (Arthur, 2026-11-06; src/app/debate/[slug]/exemplars/page.tsx). */}
        {isOwner && !sample && (
          <p className="mt-6">
            <TextLink href={`/debate/${topicSlug}/exemplars`}>Exemplar ways to argue this motion</TextLink>
          </p>
        )}
        {isOwner && (
          <p className="mt-6">
            <TextLink href="/today">Back to today</TextLink>
          </p>
        )}
      </div>

      {isOwner && (
        <div className="mt-8">
          <PublishToggle debateId={debateId} initial={argumentPublic} />
        </div>
      )}
    </div>
  );
}
