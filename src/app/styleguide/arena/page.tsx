import { notFound } from "next/navigation";
import { Page } from "@/components/layout/Page";
import { TopicList } from "@/components/debate/TopicList";
import { Verdict } from "@/components/debate/Verdict";
import { ArgumentEditor } from "@/components/debate/ArgumentEditor";
import { ChallengeInvite } from "@/components/share/ChallengeInvite";
import { getMicroLesson } from "@/lib/micro-lessons";
import { getSchool } from "@/lib/schools";
import { ObjectionBrief } from "@/components/debate/ObjectionBrief";
import { SchoolTable } from "@/components/table/SchoolTable";
import { RatingChart } from "@/components/me/RatingChart";
import { yourTableLine } from "@/lib/school-table";
import {
  FIXTURE_ARGUMENT,
  FIXTURE_MOTION,
  FIXTURE_VERDICT,
  FIXTURE_REJECTED_VERDICT,
  FIXTURE_RATINGS_MANY,
  FIXTURE_RATINGS_ONE,
  FIXTURE_TABLE_EMPTY,
  FIXTURE_TABLE_ROWS,
  FIXTURE_TABLE_TIED,
  FIXTURE_WEEK,
  fixtureTopics,
} from "@/lib/arena-fixtures";

export const metadata = {
  title: "Arena preview · Sophecs",
  robots: { index: false, follow: false },
};

// Local-only. Every arena screen needs a session and rows in Supabase, so
// none of them renders on a machine that has neither, and the debate
// surface is the one part of the product that cannot be looked at while it
// is being built. This renders the same components against fixtures so it
// can be.
//
// Gated on an env var rather than NODE_ENV: `next build` sets NODE_ENV to
// production, so a NODE_ENV check would hide this from the production build
// that is being reviewed locally as well as from Vercel. SOPHECS_PREVIEW
// lives in .env.local, which is gitignored and never set in Vercel, so this
// route is a 404 everywhere it is deployed — which is also why the client
// components below can fire their analytics on mount without polluting
// anything.
export default function ArenaPreviewPage() {
  // Also visible on Vercel preview deployments, not only locally.
  //
  // The verdict and revision screens cannot be reached on a preview at all:
  // they need a session, a judged row, and an ANTHROPIC_API_KEY that is
  // production-only, so "send to the judge" fails there and the screens
  // behind it are unreviewable. Rendering them here against fixtures is the
  // only way to see them before a merge.
  //
  // Production still 404s, which is the part CONTRIBUTING.md actually cares
  // about: the fixtures are not real data and have no business on the live
  // site. Previews are behind Vercel's own sign-in.
  const visible =
    process.env.SOPHECS_PREVIEW === "1" || process.env.VERCEL_ENV === "preview";
  if (!visible) notFound();

  const lesson = getMicroLesson("opaque-benefit-before");
  const afterLesson = getMicroLesson("opaque-benefit-after");
  const objection = FIXTURE_VERDICT.unanswered_objection ?? null;

  return (
    <Page width="ui">
      <h1 className="font-serif text-lg font-medium text-ink">Arena preview</h1>
      <p className="mt-2 max-w-[54ch] text-sm leading-relaxed text-ink-mid">
        The debate surface rendered against fixtures. Not reachable on any
        deployment.
      </p>

      <Section title="1. Arena index, with motions">
        <TopicList topics={fixtureTopics()} school="stoicism" />
      </Section>

      <Section title="2. Arena index, no open motions">
        <TopicList topics={[]} school="stoicism" />
      </Section>

      <Section title="3. Write an argument, first time" narrow>
        <ArgumentEditor
          topicSlug="opaque-benefit"
          motion={FIXTURE_MOTION}
          school="stoicism"
          userId="preview"
          isFirstArgument
          microBefore={lesson}
          readingNotes={[
            "That what is up to me is the assent, not the outcome.",
            "Chrysippus's cylinder — the push is external, the shape is mine.",
          ]}
        />
      </Section>

      <Section title="4. Challenge invite" narrow>
        <ChallengeInvite
          challengeId="preview"
          school="utilitarianism"
          content={getSchool("utilitarianism")}
        />
      </Section>

      {/* Not `narrow` any more: the verdict route moved to the 960 UI
          container when it gained its second column. */}
      <Section title="5. Verdict: three axes, and an objection left standing">
        <Verdict
          debateId="preview"
          topicSlug="opaque-benefit"
          motion={FIXTURE_MOTION}
          school="stoicism"
          verdict={FIXTURE_VERDICT}
          eloDelta={18}
          eloAfter={1218}
          streak={3}
          weekNumber={41}
          tableContribution={1}
          argument={FIXTURE_ARGUMENT}
          isOwner
          argumentPublic
          afterLesson={afterLesson}
          showAfterLessonInitially={false}
          shareLine="Scored 71 on the opaque benefit. sophecs.com"
        />
      </Section>

      <Section title="6. Verdict: rejected, nothing scored">
        <Verdict
          debateId="preview-rejected"
          topicSlug="opaque-benefit"
          motion={FIXTURE_MOTION}
          school="stoicism"
          verdict={FIXTURE_REJECTED_VERDICT}
          eloDelta={null}
          eloAfter={null}
          streak={3}
          weekNumber={41}
          argument={FIXTURE_ARGUMENT}
          isOwner
          argumentPublic={false}
          afterLesson={null}
          showAfterLessonInitially={false}
          shareLine=""
        />
      </Section>

      {objection && (
        <Section title="7. Face the objection, then revise once" narrow>
          <ObjectionBrief objection={objection} />
          <ArgumentEditor
            topicSlug="opaque-benefit"
            motion={FIXTURE_MOTION}
            school="stoicism"
            userId="preview"
            mode="revision"
            parentDebateId="preview"
            initialArgument={FIXTURE_ARGUMENT}
          />
        </Section>
      )}

      <Section title="8. School table: a week with a clear order, your line argued">
        <SchoolTable
          week={FIXTURE_WEEK}
          rows={FIXTURE_TABLE_ROWS}
          yourSchool="stoicism"
          yourLine={yourTableLine(3, "Stoicism")}
          emptyWeek={false}
          paused={false}
        />
      </Section>

      <Section title="9. School table: two schools tied, your line not argued yet">
        <SchoolTable
          week={FIXTURE_WEEK}
          rows={FIXTURE_TABLE_TIED}
          yourSchool="virtue-ethics"
          yourLine={yourTableLine(0, "Virtue Ethics")}
          emptyWeek={false}
          paused={false}
        />
      </Section>

      <Section title="10. School table: nothing judged yet this week">
        <SchoolTable
          week={FIXTURE_WEEK}
          rows={FIXTURE_TABLE_EMPTY}
          yourSchool="utilitarianism"
          yourLine={yourTableLine(0, "Utilitarianism")}
          emptyWeek
          paused={false}
        />
      </Section>

      <Section title="11. School table: judging paused">
        <SchoolTable
          week={FIXTURE_WEEK}
          rows={FIXTURE_TABLE_EMPTY}
          yourSchool="stoicism"
          yourLine={yourTableLine(0, "Stoicism")}
          emptyWeek
          paused
        />
      </Section>

      {/* Signed out: the table is public, the line about you is not. */}
      <Section title="12. School table: signed out, no line about you">
        <SchoolTable
          week={FIXTURE_WEEK}
          rows={FIXTURE_TABLE_ROWS}
          yourSchool={null}
          yourLine={null}
          emptyWeek={false}
          paused={false}
        />
      </Section>

      <Section title="13. Profile chart: several weeks" narrow>
        <div data-daily-path>
          <RatingChart points={FIXTURE_RATINGS_MANY} id="chart-many" />
        </div>
      </Section>

      <Section title="14. Profile chart: one week, and none yet" narrow>
        <div data-daily-path className="flex flex-col gap-4">
          <RatingChart points={FIXTURE_RATINGS_ONE} id="chart-one" />
          <RatingChart points={[]} id="chart-empty" />
        </div>
      </Section>
    </Page>
  );
}

// `narrow` mirrors the reading container the real route uses, so a
// screenshot of a section is the width that screen actually renders at:
// /debate is the 960 UI container, the write and verdict screens are the
// 720 reading one.
function Section({
  title,
  narrow = false,
  children,
}: {
  title: string;
  narrow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 border-t border-rule pt-8">
      <p className="mb-6 text-sm text-ink-soft">{title}</p>
      <div className={narrow ? "max-w-read" : undefined}>{children}</div>
    </section>
  );
}
