import { notFound } from "next/navigation";
import { Page } from "@/components/layout/Page";
import { TopicList } from "@/components/debate/TopicList";
import { JudgingPausedNotice } from "@/components/debate/JudgingPausedNotice";
import { ErrorState } from "@/components/ui/ErrorState";
import { TextLink } from "@/components/ui/TextLink";
import { Verdict } from "@/components/debate/Verdict";
import { ArgumentEditor } from "@/components/debate/ArgumentEditor";
import { ChallengeInvite } from "@/components/share/ChallengeInvite";
import { getMicroLesson } from "@/lib/micro-lessons";
import { getSchool } from "@/lib/schools";
import { ObjectionBrief } from "@/components/debate/ObjectionBrief";
import { SchoolTable } from "@/components/table/SchoolTable";
import { RatingChart } from "@/components/me/RatingChart";
import { SharePage } from "@/components/share/SharePage";
import { LiveReadingCheck, ReadingCheckFrame } from "./ReadingCheckPreview";
import { StreakCard, SchoolCard } from "@/components/today/TodayCards";
import { LessonsCard, type LessonsCardModule } from "@/components/today/LessonsCard";
import { StreakBlock } from "@/components/me/StreakBlock";
import { ProfilePage } from "@/components/me/ProfilePage";
import { ExchangeView } from "@/components/counterpart/ExchangeView";
import { ClassView } from "@/components/class/ClassView";
import { SettingsPage } from "@/components/me/SettingsPage";
import { getAllModules } from "@/lib/modules";
import { splitModule } from "@/lib/module-readings";
import { SCHOOL_IDS } from "@/lib/types";
import { countsOnTable, yourTableLine } from "@/lib/school-table";
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
  FIXTURE_OLD_VERDICT_AT,
  FIXTURE_OTHER_VECTOR,
  FIXTURE_RESULT_ID,
  FIXTURE_VECTOR,
  FIXTURE_WEEK,
  FIXTURE_CHALLENGES,
  FIXTURE_CLASSES_JOINED,
  FIXTURE_CLASSES_OWNED,
  FIXTURE_DEBATES,
  FIXTURE_EXCHANGES,
  FIXTURE_OBJECTION,
  FIXTURE_HELD_TURN,
  FIXTURE_THEIR_ARGUMENT,
  FIXTURE_TURNS,
  FIXTURE_STUDENTS,
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
  // Two real questions, so the player is reviewed against the copy it will
  // actually hold rather than against something written to fit the box.
  const check = lesson?.reading_check ?? [];
  // A Wednesday, so a run of three covers Monday to Wednesday and the four
  // days after it are still open. The cards are read against a fixed date
  // rather than the real one: a fixture whose picture changes with the day
  // of the week cannot be reviewed.
  const today = "2026-10-07";

  // Everything the exchange needs that does not change between its four
  // states. Spread into each, so a state differs from its neighbour by
  // exactly the props that name it.
  const exchange = {
    exchangeId: "preview-exchange",
    userId: "preview",
    topicSlug: "opaque-benefit",
    myDebateId: FIXTURE_RESULT_ID,
    motion: FIXTURE_MOTION,
    mySchool: "stoicism" as const,
    theirSchool: "virtue-ethics" as const,
    myArgument: FIXTURE_ARGUMENT,
    theirArgument: FIXTURE_THEIR_ARGUMENT,
    counterpartLeft: false,
    anyRemoved: false,
    myHeld: false,
    myTurn: false,
    nextSeq: 3,
    sourceLabel: "",
    sourceText: "",
    publishMine: false,
    publishTheirs: false,
  };
  // The two motions the student fixtures carry progress on, named as the
  // class page names them.
  const classTopics = fixtureTopics()
    .filter((t) => t.slug === "opaque-benefit" || t.slug === "crash-arithmetic")
    .map((t) => ({ slug: t.slug, title: t.title }));

  // The real modules, in the order Today picks the next one from. A made-up
  // title here would be the one place in the restyle where the sidebar is
  // reviewed against copy the product does not have.
  const modules: LessonsCardModule[] = getAllModules()
    .sort((a, b) => SCHOOL_IDS.indexOf(a.school) - SCHOOL_IDS.indexOf(b.school))
    .map((m) => ({
      id: m.id,
      title: m.title,
      readings: splitModule(m.title, m.body, m.readings).length,
    }));
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

      <Section title="1b. Arena notices: judging paused, and the list unreadable">
        <div className="flex flex-col gap-8">
          <JudgingPausedNotice />
          {/* The shared ErrorState, unchanged. A paused judge is the state
              of the product; this is a fault, and it keeps the alert and
              the error rule. It gets its own pass when the shared UI
              components are redrawn. */}
          <ErrorState
            title="The motions could not be loaded."
            body="This is on our side, not yours. Reloading usually fixes it; if it does not, the lessons and the case for your school are unaffected."
            action={<TextLink href="/lessons">Read the lessons</TextLink>}
          />
        </div>
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

      {/* The table line is gated on countsOnTable: original, judged, and
          inside the week the table is showing. Sections 5 and 6 cover a
          qualifying original and a rejected one; these two cover the other
          two ways to miss. */}
      <Section title="7b. Verdict: a revision, which does not move the table">
        <Verdict
          debateId="preview-revision"
          topicSlug="opaque-benefit"
          motion={FIXTURE_MOTION}
          school="stoicism"
          verdict={FIXTURE_VERDICT}
          eloDelta={null}
          eloAfter={1218}
          streak={3}
          weekNumber={41}
          tableContribution={
            countsOnTable({
              kind: "revision",
              rejected: false,
              createdAt: new Date().toISOString(),
            })
              ? 1
              : null
          }
          argument={FIXTURE_ARGUMENT}
          isOwner
          argumentPublic
          afterLesson={null}
          showAfterLessonInitially={false}
          shareLine=""
        />
      </Section>

      <Section title="7c. Verdict: an older week, whose table has closed">
        <Verdict
          debateId="preview-old"
          topicSlug="opaque-benefit"
          motion={FIXTURE_MOTION}
          school="stoicism"
          verdict={FIXTURE_VERDICT}
          eloDelta={12}
          eloAfter={1206}
          streak={0}
          weekNumber={34}
          tableContribution={
            countsOnTable({
              kind: "original",
              rejected: false,
              createdAt: FIXTURE_OLD_VERDICT_AT,
            })
              ? 1
              : null
          }
          argument={FIXTURE_ARGUMENT}
          isOwner
          argumentPublic
          afterLesson={null}
          showAfterLessonInitially={false}
          shareLine=""
        />
      </Section>

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
        <div>
          <RatingChart points={FIXTURE_RATINGS_MANY} id="chart-many" />
        </div>
      </Section>

      <Section title="14. Profile chart: one week, and none yet" narrow>
        <div className="flex flex-col gap-4">
          <RatingChart points={FIXTURE_RATINGS_ONE} id="chart-one" />
          <RatingChart points={[]} id="chart-empty" />
        </div>
      </Section>

      {/* /r/[id] is the share target and the most-visited page in the
          product, and it renders nowhere without Supabase. These are its
          three shapes. The card inside them is deliberately unchanged. */}
      <Section title="15. Shared result: a cold recipient" narrow>
        <SharePage
          resultId={FIXTURE_RESULT_ID}
          school="stoicism"
          oneLine={getSchool("stoicism").one_line}
          oneLineAttribution={getSchool("stoicism").one_line_attribution}
          vector={FIXTURE_VECTOR}
          otherVector={null}
          isOwner={false}
          isSavedToProfile={false}
          showDebateThem={false}
          challengeId={null}
          isSignedIn={false}
          shareLine="Scored 71 on the opaque benefit. sophecs.com"
          shareLineIndex={0}
        />
      </Section>

      <Section title="16. Shared result: your own, saved to your profile" narrow>
        <SharePage
          resultId={FIXTURE_RESULT_ID}
          school="utilitarianism"
          oneLine={getSchool("utilitarianism").one_line}
          oneLineAttribution={getSchool("utilitarianism").one_line_attribution}
          vector={FIXTURE_VECTOR}
          otherVector={null}
          isOwner
          isSavedToProfile
          showDebateThem={false}
          challengeId={null}
          isSignedIn
          shareLine="Scored 71 on the opaque benefit. sophecs.com"
          shareLineIndex={0}
        />
      </Section>

      <Section title="17. Shared result: a challenge, both sides present" narrow>
        <SharePage
          resultId={FIXTURE_RESULT_ID}
          school="virtue-ethics"
          oneLine={getSchool("virtue-ethics").one_line}
          oneLineAttribution={getSchool("virtue-ethics").one_line_attribution}
          vector={FIXTURE_VECTOR}
          otherVector={FIXTURE_OTHER_VECTOR}
          isOwner={false}
          isSavedToProfile={false}
          showDebateThem
          challengeId="preview-challenge"
          isSignedIn
          shareLine="Scored 71 on the opaque benefit. sophecs.com"
          shareLineIndex={0}
        />
      </Section>

      {/* Guarded rather than assumed: every before-lesson carries two
          questions and a test enforces it, but a styleguide that 500s
          because content moved is worse than one that shows less. */}
      {check.length === 2 && (
        <>
        <p className="mt-12 max-w-[60ch] text-sm leading-relaxed text-ink-mid">
          The lesson player. On the route it is a modal dialog over the whole
          viewport, which cannot be shown four ways at once; these are the same
          step in a frame. Section 21 opens the real one.
        </p>

        <Section title="18. Reading check: the question, nothing picked yet">
          <div className="grid gap-6 sm:grid-cols-2">
            <ReadingCheckFrame
              question={check[0]}
              index={0}
              total={check.length}
              picked={null}
              checked={false}
              school="utilitarianism"
            />
            <ReadingCheckFrame
              question={check[0]}
              index={0}
              total={check.length}
              picked={1}
              checked={false}
              school="utilitarianism"
            />
          </div>
        </Section>

        <Section title="19. Reading check: checked right, and checked wrong">
          <div className="grid gap-6 sm:grid-cols-2">
            <ReadingCheckFrame
              question={check[0]}
              index={0}
              total={check.length}
              picked={check[0].answer}
              checked
              school="utilitarianism"
            />
            <ReadingCheckFrame
              question={check[0]}
              index={0}
              total={check.length}
              picked={(check[0].answer + 1) % check[0].options.length}
              checked
              school="utilitarianism"
            />
          </div>
        </Section>

        <Section title="20. Reading check: the last question, where the button changes">
          <div className="grid gap-6 sm:grid-cols-2">
            <ReadingCheckFrame
              question={check[1]}
              index={1}
              total={check.length}
              picked={null}
              checked={false}
              school="utilitarianism"
            />
            <ReadingCheckFrame
              question={check[1]}
              index={1}
              total={check.length}
              picked={(check[1].answer + 1) % check[1].options.length}
              checked
              school="utilitarianism"
            />
          </div>
        </Section>

        <Section title="21. Reading check: opened for real, over the site header" narrow>
          <LiveReadingCheck check={check} school="utilitarianism" />
        </Section>
        </>
      )}

      <p className="mt-12 max-w-[60ch] text-sm leading-relaxed text-ink-mid">
        The Today sidebar. Every card needs a session and a row, so they are
        rendered here against fixtures at the width the sidebar gives them.
        The week is read against Wednesday 7 October 2026 throughout.
      </p>

      <Section title="22. Streak: a run of three, ending today">
        <TodayCards>
          <StreakCard streak={3} streakUpdatedOn={today} today={today} paused={false} />
          <StreakCard streak={7} streakUpdatedOn="2026-10-11" today="2026-10-11" paused={false} />
        </TodayCards>
      </Section>

      <Section title="23. Streak: never started, and gone stale">
        <TodayCards>
          <StreakCard streak={0} streakUpdatedOn={null} today={today} paused={false} />
          {/* profiles.streak still says 4, last extended on Monday. The run
              ended before yesterday, so the card shows 0 and lights
              nothing. The stored value is untouched. */}
          <StreakCard streak={4} streakUpdatedOn="2026-10-05" today={today} paused={false} />
        </TodayCards>
      </Section>

      <Section title="24. Streak: the Monday after a live run, and judging paused">
        <TodayCards>
          {/* Live, extended last night, but none of it happened this week. */}
          <StreakCard streak={5} streakUpdatedOn="2026-10-04" today="2026-10-05" paused={false} />
          <StreakCard streak={3} streakUpdatedOn={today} today={today} paused />
        </TodayCards>
      </Section>

      <Section title="25. School card: ranked, and nothing judged yet this week">
        <TodayCards>
          <SchoolCard
            school="stoicism"
            oneLine={getSchool("stoicism").one_line}
            elo={1284}
            rank={1}
          />
          <SchoolCard
            school="virtue-ethics"
            oneLine={getSchool("virtue-ethics").one_line}
            elo={1200}
            rank={null}
          />
        </TodayCards>
      </Section>

      <Section title="26. Profile streak: live, and the same stored 4 gone stale">
        <TodayCards>
          <StreakBlock streak={4} streakUpdatedOn="2026-10-06" today={today} />
          <StreakBlock streak={4} streakUpdatedOn="2026-10-05" today={today} />
        </TodayCards>
        <p className="mt-4 max-w-[60ch] text-sm leading-relaxed text-ink-mid">
          Both have a stored streak of 4. The second was last extended on
          Monday, so by Wednesday the run is over and the block says so.
          Nothing is written either way.
        </p>
      </Section>

      <Section title="27. Lessons card: not started, part read, and all three read">
        <TodayCards>
          <LessonsCard modules={modules} />
          <LessonsCard modules={[]} />
        </TodayCards>
        <p className="mt-4 max-w-[60ch] text-sm leading-relaxed text-ink-mid">
          The first card holds the real modules and reads progress out of
          this browser, so it shows whichever one you have not finished and
          moves as you read. The second is given an empty list, which is the
          same branch as having finished them all.
        </p>
      </Section>
      <p className="mt-12 max-w-[60ch] text-sm leading-relaxed text-ink-mid">
        The profile and its settings. Both need a session and a row per
        block, so neither renders without one. The three below are the
        states worth looking at.
      </p>

      <Section title="28. Profile: signed in, nothing argued yet">
        <div className="rounded-panel border-2 border-rule">
          <ProfilePage
            school="stoicism"
            displayName={null}
            elo={1200}
            percentile={0.5}
            streak={0}
            streakUpdatedOn={null}
            today={today}
            ratingPoints={[]}
            objections={[]}
            weeklyMotion={{ slug: "opaque-benefit", title: "The opaque benefit" }}
            hasAnyDebate={false}
            exchanges={[]}
            pendingChallenges={[]}
            debates={[]}
            caseStates={{}}
            allClosed={false}
          />
        </div>
      </Section>

      <Section title="29. Profile: an objection open, a chart, and a history">
        <div className="rounded-panel border-2 border-rule">
          <ProfilePage
            school="stoicism"
            displayName="A Stoic"
            elo={1284}
            percentile={0.82}
            streak={3}
            streakUpdatedOn={today}
            today={today}
            ratingPoints={FIXTURE_RATINGS_MANY}
            objections={[FIXTURE_OBJECTION]}
            weeklyMotion={{ slug: "opaque-benefit", title: "The opaque benefit" }}
            hasAnyDebate
            exchanges={FIXTURE_EXCHANGES}
            pendingChallenges={FIXTURE_CHALLENGES}
            debates={FIXTURE_DEBATES}
            caseStates={{
              "opaque-benefit": { read: true, argued: true, answered: false, closed: false },
              "crash-arithmetic": { read: true, argued: true, answered: true, closed: true },
            }}
            allClosed={false}
          />
        </div>
      </Section>

      <Section title="30. Settings, with the deletion step open">
        <div className="rounded-panel border-2 border-rule">
          <SettingsPage
            displayName="A Stoic"
            argumentDefaultPublic={false}
            owned={FIXTURE_CLASSES_OWNED}
            joined={FIXTURE_CLASSES_JOINED}
          />
        </div>
        <p className="mt-4 max-w-[60ch] text-sm leading-relaxed text-ink-mid">
          Press &ldquo;Delete account&rdquo; at the foot to open the
          confirmation. It is the real control, so the second press really
          would delete this preview&apos;s account if one were signed in;
          nobody is, so it reports the failure instead. Every word of that
          block is frozen copy.
        </p>
      </Section>
      <p className="mt-12 max-w-[60ch] text-sm leading-relaxed text-ink-mid">
        The counterpart exchange, in its four states. It needs two accounts,
        two judged arguments and a row of turns, so it is the one screen in
        the product that two people have to build between them.
      </p>

      <Section title="31. Counterpart: your turn to reply">
        <div className="rounded-panel border-2 border-rule">
          <ExchangeView
            {...exchange}
            turns={FIXTURE_TURNS}
            status="open"
            myTurn
            nextSeq={3}
            sourceLabel="their last reply"
            sourceText={FIXTURE_TURNS[0].body}
          />
        </div>
      </Section>

      <Section title="32. Counterpart: waiting on the other person">
        <div className="rounded-panel border-2 border-rule">
          <ExchangeView {...exchange} turns={[FIXTURE_TURNS[0]]} status="open" />
        </div>
      </Section>

      <Section title="33. Counterpart: four replies in, and finished">
        <div className="rounded-panel border-2 border-rule">
          <ExchangeView
            {...exchange}
            turns={[
              ...FIXTURE_TURNS,
              { ...FIXTURE_TURNS[0], id: "preview-turn-3", seq: 3 },
              { ...FIXTURE_TURNS[1], id: "preview-turn-4", seq: 4 },
            ]}
            status="complete"
          />
        </div>
      </Section>

      <Section title="34. Counterpart: your reply held by the screening check">
        <div className="rounded-panel border-2 border-rule">
          <ExchangeView
            {...exchange}
            turns={[...FIXTURE_TURNS, FIXTURE_HELD_TURN]}
            status="open"
            myHeld
          />
        </div>
        <p className="mt-4 max-w-[60ch] text-sm leading-relaxed text-ink-mid">
          Only the author sees a held reply. The route applies that rule
          itself rather than relying on the policy, because it reads through
          the admin client; this is what the author sees while it waits.
        </p>
      </Section>

      <p className="mt-12 max-w-[60ch] text-sm leading-relaxed text-ink-mid">
        The teacher&apos;s view. It needs a class, a membership row per
        student and a case state per motion, and a class with nobody in it
        looks nothing like a class with four. The names are plainly
        invented, because the real page carries real ones.
      </p>

      <Section title="35. Class: four students across the three schools">
        <div className="rounded-panel border-2 border-rule">
          <ClassView
            name="Year 12 Philosophy"
            code="KQ47PD"
            members={FIXTURE_STUDENTS}
            topics={classTopics}
          />
        </div>
        <p className="mt-4 max-w-[60ch] text-sm leading-relaxed text-ink-mid">
          Student D joined and has done nothing since. Their motions read
          &ldquo;Not started&rdquo; rather than sitting blank: a row with
          nothing in it reads as the page failing to load their progress.
        </p>
      </Section>

      <Section title="36. Class: nobody has joined yet">
        <div className="rounded-panel border-2 border-rule">
          <ClassView
            name="Thursday ethics club"
            code="KQ47PD"
            members={[]}
            topics={classTopics}
          />
        </div>
      </Section>
    </Page>
  );
}

// The sidebar's own width, so a card fixture wraps where the real card
// wraps. Two to a row on a wide screen only because the page is wide; the
// real sidebar stacks them.
function TodayCards({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-6">
      {Array.isArray(children)
        ? children.map((child, i) => (
            <div key={i} className="w-full max-w-sm">
              {child}
            </div>
          ))
        : children}
    </div>
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
