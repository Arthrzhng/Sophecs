import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import { ChallengeViewTracker } from "@/components/share/ChallengeViewTracker";
import type { SchoolId } from "@/lib/types";

export const metadata = { title: "You've been challenged · Sophecs" };

async function getChallenge(id: string) {
  if (!isAdminConfigured()) return null;
  const admin = createAdminClient();
  const { data: challenge } = await admin
    .from("challenges")
    .select("id, challenger_result_id")
    .eq("id", id)
    .single();
  if (!challenge) return null;

  const { data: result } = await admin
    .from("public_results")
    .select("school")
    .eq("id", challenge.challenger_result_id)
    .single();
  if (!result) return null;

  return { school: result.school as SchoolId };
}

export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const challenge = await getChallenge(id);
  if (!challenge) notFound();

  const schoolName = SCHOOL_COLORS[challenge.school].name;

  return (
    <main className="flex-1 flex items-center">
      <div className="mx-auto max-w-xl px-6 py-20">
        <ChallengeViewTracker challengeId={id} />
        <p className="eyebrow text-ink-soft mb-6">You&apos;ve been challenged</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-medium leading-tight max-w-[16ch]">
          Someone who thinks like a {schoolName.toLowerCase()} sent you this.
        </h1>
        <p className="mt-5 text-lg text-ink-mid leading-relaxed max-w-[45ch]">
          Find out whether you agree with them.
        </p>
        <div className="mt-10">
          <Link
            href={`/quiz?c=${id}`}
            className="inline-block bg-ink text-surface rounded-md px-6 py-3 text-base font-medium hover:opacity-85 transition-opacity"
          >
            Take the quiz
          </Link>
        </div>
      </div>
    </main>
  );
}
