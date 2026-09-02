import Link from "next/link";
import { ClosesIn } from "@/components/closes-in";
import { SchoolEyebrow } from "@/components/school-mark";
import { SubmissionBox } from "@/components/submission-box";
import { getDebateTopic, getModule } from "@/lib/content";
import {
  getCurrentProfile,
  getLatestJudgedMatch,
  getOpenMotion,
  getProfile,
  getSubmissionsForMotion,
} from "@/lib/data";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Arena · Sophecs" };

export default async function DebatePage() {
  const [motion, profile] = await Promise.all([
    getOpenMotion(),
    getCurrentProfile(),
  ]);

  if (!motion) {
    return (
      <div className="mx-auto max-w-3xl px-5 pt-14">
        <p className="eyebrow text-ink-soft mb-4">Arena</p>
        <h1 className="font-serif text-3xl font-medium">
          No motion is open right now.
        </h1>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-5 pt-14 max-w-[55ch]">
        <p className="eyebrow text-ink-soft mb-4">Arena</p>
        <h1 className="font-serif text-3xl font-medium leading-snug">
          Debating needs an account and a school.
        </h1>
        <p className="mt-4 text-ink-mid leading-relaxed">
          The quiz assigns the school; an account carries your rating.
        </p>
        <div className="mt-6 flex gap-4">
          <Link
            href="/auth"
            className="bg-ink text-surface rounded-btn px-5 py-2.5 text-sm font-medium hover:opacity-85"
          >
            Sign in
          </Link>
          <Link
            href="/quiz"
            className="text-sm font-medium text-ink-mid hover:text-ink underline underline-offset-4 self-center"
          >
            Take the quiz first
          </Link>
        </div>
      </div>
    );
  }

  const module = getModule(motion.module_id);
  const motionText = getDebateTopic(motion.id)?.topic.text ?? "";
  // Your school's module authored the motion: you argue for it. Otherwise you
  // take the opposition bench.
  const side = profile.school_id === module?.school_id ? "for" : "against";
  const opponentSide = side === "for" ? "against" : "for";

  const [submissions, lastMatch] = await Promise.all([
    getSubmissionsForMotion(motion.id),
    getLatestJudgedMatch(),
  ]);
  const mine = submissions.find((s) => s.profile_id === profile.id);
  const opponent = submissions.find((s) => s.side === opponentSide);
  const opponentProfile =
    opponent && opponent.profile_id !== "system"
      ? await getProfile(opponent.profile_id)
      : undefined;

  return (
    <div className="mx-auto max-w-5xl px-5 pt-14">
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-rule pb-4">
        <p className="eyebrow text-ink-soft">Open round</p>
        <div className="flex gap-6 font-mono text-xs text-ink-mid">
          <span>
            rating <span className="text-ink font-medium">{profile.rating}</span>
          </span>
          <span>
            streak{" "}
            <span className="text-ink font-medium">{profile.streak_days}d</span>
          </span>
          <span>
            closes in{" "}
            <span className="text-ink font-medium">
              <ClosesIn closesAt={motion.closes_at} />
            </span>
          </span>
        </div>
      </div>

      <div className="mt-10 max-w-[63ch]">
        {module && <SchoolEyebrow school={module.school_id} />}
        <h1 className="font-serif text-2xl sm:text-3xl font-medium leading-snug mt-3">
          {motionText}
        </h1>
      </div>

      <div className="mt-12 grid lg:grid-cols-2 gap-10 items-start">
        <section>
          {mine ? (
            <div>
              <p className="eyebrow text-ink-soft mb-3">
                Your argument · {mine.side}
              </p>
              <blockquote className="bg-surface border border-rule rounded-btn px-5 py-4 font-serif text-[17px] leading-relaxed">
                {mine.body}
              </blockquote>
              <p className="mt-3 font-mono text-xs text-ink-soft">
                submitted {formatDate(mine.created_at)} · one argument per round
              </p>
            </div>
          ) : (
            <SubmissionBox motionId={motion.id} side={side} />
          )}
        </section>

        <section className="lg:border-l lg:border-rule lg:pl-10">
          <p className="eyebrow text-ink-soft mb-3">Opposition</p>
          {opponent ? (
            <div>
              <blockquote className="font-serif text-[17px] leading-relaxed max-w-[55ch]">
                {opponent.body}
              </blockquote>
              <p className="mt-3 font-mono text-xs text-ink-mid">
                {opponentProfile ? (
                  <>
                    {opponentProfile.username} ·{" "}
                    {opponentProfile.rating}
                  </>
                ) : (
                  "the house · system opponent"
                )}
              </p>
            </div>
          ) : (
            <p className="text-ink-mid leading-relaxed max-w-[45ch]">
              Nobody has taken the other side yet. If no one does before the
              round closes, the house argues back and the verdict counts all
              the same.
            </p>
          )}
        </section>
      </div>

      {lastMatch && (
        <div className="mt-16 border-t border-rule pt-6 pb-4">
          <Link
            href={`/debate/verdict/${lastMatch.id}`}
            className="text-sm font-medium text-ink-mid hover:text-ink underline underline-offset-4"
          >
            Read the last verdict
          </Link>
        </div>
      )}
    </div>
  );
}
