import Link from "next/link";
import { notFound } from "next/navigation";
import { SchoolEyebrow } from "@/components/school-mark";
import { getModule } from "@/lib/content";
import {
  getMatch,
  getMicroLessonForMotion,
  getMotions,
  getProfile,
  getSubmission,
  getVerdictForMatch,
} from "@/lib/data";
import { ratingChange } from "@/lib/elo";
import { signed } from "@/lib/format";
import type { Profile, Submission, VerdictScores } from "@/lib/types";

export const metadata = { title: "Verdict · Sophecs" };

const AXES: { key: keyof VerdictScores; label: string }[] = [
  { key: "logic", label: "Logical structure" },
  { key: "sources", label: "Use of sources" },
  { key: "answers_opponent", label: "Answers opponent" },
  { key: "clarity", label: "Clarity" },
];

function ScoreColumn({
  title,
  submission,
  profile,
  scores,
  won,
}: {
  title: string;
  submission: Submission;
  profile: Profile | undefined;
  scores: VerdictScores;
  won: boolean;
}) {
  return (
    <section className="bg-surface border border-rule rounded-btn p-6">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow text-ink-soft">{title}</p>
        {won && <span className="eyebrow text-ink">Winner</span>}
      </div>
      <p className="mt-2 font-mono text-sm text-ink-mid">
        {profile ? profile.username : "the house"} · {submission.side}
      </p>
      <blockquote className="mt-4 font-serif text-[16px] leading-[1.65] text-ink">
        {submission.body}
      </blockquote>
      <dl className="mt-6 space-y-3">
        {AXES.map((axis) => (
          <div key={axis.key} className="grid grid-cols-[1fr_auto] gap-3 items-center">
            <div>
              <dt className="text-xs font-medium text-ink-mid">{axis.label}</dt>
              <div className="mt-1 h-px bg-rule relative">
                <div
                  className="absolute inset-y-0 left-0 bg-ink"
                  style={{ width: `${scores[axis.key] * 10}%`, height: "2px", top: "-0.5px" }}
                />
              </div>
            </div>
            <dd className="font-mono text-sm text-ink w-8 text-right">
              {scores[axis.key]}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default async function VerdictPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatch(id);
  if (!match) notFound();

  const verdict = await getVerdictForMatch(match.id);
  const [subA, subB, motions] = await Promise.all([
    getSubmission(match.submission_a),
    getSubmission(match.submission_b),
    getMotions(),
  ]);
  if (!verdict || !subA || !subB) notFound();

  const motion = motions.find((m) => m.id === match.motion_id);
  const module = motion ? getModule(motion.module_id) : undefined;
  const microLesson = motion
    ? await getMicroLessonForMotion(motion.id)
    : undefined;

  const [profileA, profileB] = await Promise.all([
    subA.profile_id === "system" ? undefined : getProfile(subA.profile_id),
    subB.profile_id === "system" ? undefined : getProfile(subB.profile_id),
  ]);

  const aWon = verdict.winner_submission_id === subA.id;
  const winnerProfile = aWon ? profileA : profileB;
  const loserProfile = aWon ? profileB : profileA;
  // The system opponent plays at the baseline rating.
  const winnerRating = winnerProfile?.rating ?? 1000;
  const loserRating = loserProfile?.rating ?? 1000;
  const winnerDelta = ratingChange(winnerRating, loserRating, true);
  const loserDelta = ratingChange(loserRating, winnerRating, false);

  return (
    <div className="mx-auto max-w-5xl px-5 pt-14">
      <p className="eyebrow text-ink-soft">Verdict</p>
      {motion && (
        <div className="mt-3 max-w-[63ch]">
          {module && <SchoolEyebrow school={module.school_id} />}
          <h1 className="font-serif text-2xl sm:text-3xl font-medium leading-snug mt-2">
            {motion.text}
          </h1>
        </div>
      )}

      <div className="mt-10 grid lg:grid-cols-2 gap-6 items-start">
        <ScoreColumn
          title="Affirmative"
          submission={subA}
          profile={profileA}
          scores={verdict.scores.a}
          won={aWon}
        />
        <ScoreColumn
          title="Negative"
          submission={subB}
          profile={profileB}
          scores={verdict.scores.b}
          won={!aWon}
        />
      </div>

      <section className="mt-10 max-w-[63ch]">
        <p className="eyebrow text-ink-soft mb-3">The judge&apos;s reasoning</p>
        <p className="font-serif text-[18px] leading-[1.7]">
          {verdict.rationale}
        </p>
        <div className="mt-6 flex gap-8 font-mono text-sm">
          {winnerProfile && (
            <span>
              {winnerProfile.username}{" "}
              <span className="font-medium">{signed(winnerDelta)}</span>
            </span>
          )}
          {loserProfile && (
            <span className="text-ink-mid">
              {loserProfile.username}{" "}
              <span className="font-medium">{signed(loserDelta)}</span>
            </span>
          )}
        </div>
      </section>

      {microLesson && (
        <aside className="mt-14 border-t border-rule pt-8 max-w-[63ch]">
          <p className="eyebrow text-ink-soft mb-3">While it&apos;s fresh</p>
          <p className="font-serif text-[18px] leading-[1.7]">
            {microLesson.body}
          </p>
        </aside>
      )}

      <div className="mt-12 pb-4">
        <Link
          href="/debate"
          className="text-sm font-medium text-ink-mid hover:text-ink underline underline-offset-4"
        >
          Back to the arena
        </Link>
      </div>
    </div>
  );
}
