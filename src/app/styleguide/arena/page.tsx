import { notFound } from "next/navigation";
import { Page } from "@/components/layout/Page";
import { TopicList } from "@/components/debate/TopicList";
import { Verdict } from "@/components/debate/Verdict";
import { ArgumentEditor } from "@/components/debate/ArgumentEditor";
import { ChallengeInvite } from "@/components/share/ChallengeInvite";
import { getMicroLesson } from "@/lib/micro-lessons";
import { getSchool } from "@/lib/schools";
import {
  FIXTURE_ARGUMENT,
  FIXTURE_MOTION,
  FIXTURE_VERDICT,
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
  if (process.env.SOPHECS_PREVIEW !== "1") notFound();

  const lesson = getMicroLesson("opaque-benefit-before");

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

      <Section title="5. Verdict" narrow>
        <Verdict
          debateId="preview"
          topicSlug="opaque-benefit"
          motion={FIXTURE_MOTION}
          school="stoicism"
          verdict={FIXTURE_VERDICT}
          eloDelta={18}
          argument={FIXTURE_ARGUMENT}
          isOwner
          argumentPublic
          afterLesson={null}
          showAfterLessonInitially={false}
          shareLine="Scored 71 on the opaque benefit. sophecs.com"
        />
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
