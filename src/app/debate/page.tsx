import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { TopicList, type TopicListItem, type TopicStatus } from "@/components/debate/TopicList";
import { DebateListViewTracker } from "@/components/debate/DebateListViewTracker";
import { Page } from "@/components/layout/Page";
import { ErrorState } from "@/components/ui/ErrorState";
import { TextLink } from "@/components/ui/TextLink";
import { getWeeklyMotion } from "@/lib/weekly-motion";
import { getCaseStates, type CaseState } from "@/lib/cases";
import { TOPIC_LOCK_DAYS } from "@/lib/debate-limits";
import type { SchoolId } from "@/lib/types";

export const metadata = { title: "Debate · Sophecs" };

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function DebatePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let school: SchoolId | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("school")
      .eq("id", user.id)
      .maybeSingle();
    school = (profile?.school as SchoolId) ?? null;
  }

  let topics: TopicListItem[] = [];
  // Distinguishes "no motions have been written" from "the list could not
  // be read". The first is an empty state with something to read instead;
  // the second is an error, and showing it as emptiness is how a broken
  // page gets mistaken for a finished one.
  let listFailed = false;

  if (isAdminConfigured()) {
    const admin = createAdminClient();
    const { data: rows, error } = await admin
      .from("debate_topics")
      .select("slug, title, motion, stances, par_elo, sort, micro_before")
      .eq("active", true)
      .order("sort", { ascending: true });
    listFailed = Boolean(error);

    const weeklySlug =
      getWeeklyMotion(
        (rows ?? []).map((r) => ({
          slug: r.slug as string,
          title: r.title as string,
          sort: Number(r.sort),
        }))
      )?.slug ?? null;

    // Best score, lock window and pending verdicts in one query rather than
    // one per topic: this was six round trips on a six-motion list, and
    // adding case states would have made it twelve.
    const bestByTopic = new Map<string, number>();
    const lockUntil = new Map<string, number>();
    const pending = new Set<string>();
    let caseStates: Record<string, CaseState> = {};

    if (user) {
      const [{ data: own }, states] = await Promise.all([
        admin
          .from("debates")
          .select("topic_slug, score, verdict, created_at, kind")
          .eq("user_id", user.id)
          .eq("kind", "original"),
        getCaseStates(
          admin,
          user.id,
          (rows ?? []).map((r) => ({
            slug: r.slug as string,
            microBefore: r.micro_before as string | null,
          }))
        ),
      ]);

      for (const row of own ?? []) {
        const slug = row.topic_slug as string;
        if (row.verdict) {
          const score = Number(row.score);
          if (Number.isFinite(score) && score > (bestByTopic.get(slug) ?? -Infinity)) {
            bestByTopic.set(slug, score);
          }
          // Same window /api/judge enforces: a judged original inside it
          // blocks a new attempt, so the list has to say so before the
          // reader writes four hundred words and is turned away.
          const opensAt = new Date(row.created_at as string).getTime() + TOPIC_LOCK_DAYS * DAY_MS;
          if (opensAt > Date.now()) lockUntil.set(slug, Math.max(opensAt, lockUntil.get(slug) ?? 0));
        } else {
          // A row with no verdict is an argument that reached the judge and
          // came back without one — a paused kill switch, a failed call.
          pending.add(slug);
        }
      }
      caseStates = states;
    }

    topics = (rows ?? []).map((row) => {
      const slug = row.slug as string;
      const locked = lockUntil.get(slug);
      const status: TopicStatus = pending.has(slug)
        ? "pending"
        : locked
          ? "locked"
          : bestByTopic.has(slug)
            ? "judged"
            : "open";
      return {
        slug,
        title: row.title as string,
        motion: row.motion as string,
        stances: row.stances as Record<SchoolId, string>,
        parElo: Number(row.par_elo),
        bestScore: bestByTopic.get(slug) ?? null,
        status,
        locksFor: locked ? Math.max(1, Math.ceil((locked - Date.now()) / DAY_MS)) : null,
        isWeekly: slug === weeklySlug,
        caseState: caseStates[slug],
      };
    });
  } else {
    listFailed = true;
  }

  // Read here rather than behind a helper: /api/judge owns the kill switch
  // and is frozen this phase, so this is a read of the same env var for
  // display only — it decides nothing.
  const judgePaused = process.env.KILL_SWITCH_JUDGE === "true";

  return (
    <Page width="ui">
      <DebateListViewTracker />
      <h1 className="font-serif text-lg font-medium text-ink">Motions</h1>
      <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-ink-mid">
        Pick a motion and argue it from your school. A judge scores how
        faithfully you argued from it, not whether it agrees with you.
      </p>

      {/* Said here rather than at submission time: the reader deserves to
          know before writing, not after.

          Suppressed when the list itself failed — two role="alert" blocks
          on one page is two assertive announcements, and the one that
          matters is the one that says there is nothing to read. */}
      {judgePaused && !listFailed && (
        <div className="mt-8">
          <ErrorState
            title="Judging is paused."
            body="Arguments are still saved, and each one is judged when judging resumes. Nothing you write now is lost, but no verdict comes back today."
            action={<TextLink href="/lessons">Read the lessons instead</TextLink>}
          />
        </div>
      )}

      <div className="mt-10">
        {listFailed ? (
          <ErrorState
            title="The motions could not be loaded."
            body="This is on our side, not yours. Reloading usually fixes it; if it does not, the lessons and the case for your school are unaffected."
            action={<TextLink href="/lessons">Read the lessons</TextLink>}
          />
        ) : (
          <TopicList topics={topics} school={school} />
        )}
      </div>
    </Page>
  );
}
