import { notFound } from "next/navigation";
import { SamplePageMarker } from "@/components/sample/SamplePageMarker";
import { sampleMetadata } from "@/lib/sample";
import { Page } from "@/components/layout/Page";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { ChallengeInvite } from "@/components/share/ChallengeInvite";
import { ChallengeViewTracker } from "@/components/share/ChallengeViewTracker";
import { getSchool } from "@/lib/schools";
import type { SchoolId } from "@/lib/types";

// A sample account's challenge says so in the title too, which is what a
// link preview shows first. Its preview image is the challenger's result
// card, which draws the Sample mark for a sample result
// (src/app/r/[id]/opengraph-image.tsx); a challenge whose challenger is
// not a sample (the seed writes none) gets no image rather than an
// unmarked one.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const challenge = await getChallenge(id);
  if (!challenge?.isSample) return { title: "You've been challenged · Sophecs" };
  return sampleMetadata(
    "A sample account's challenge · Sophecs",
    challenge.challengerIsSample
      ? { url: `/r/${challenge.challengerResultId}/opengraph-image`, alt: "A sample account's result card" }
      : undefined
  );
}

async function getChallenge(id: string) {
  if (!isAdminConfigured()) return null;
  const admin = createAdminClient();
  const { data: challenge } = await admin
    .from("challenges")
    .select("id, challenger_result_id, is_sample")
    .eq("id", id)
    .single();
  if (!challenge) return null;

  const { data: result } = await admin
    .from("public_results")
    .select("school, is_sample")
    .eq("id", challenge.challenger_result_id)
    .single();
  if (!result) return null;

  return {
    school: result.school as SchoolId,
    isSample: Boolean(challenge.is_sample),
    challengerResultId: challenge.challenger_result_id as string,
    challengerIsSample: Boolean(result.is_sample),
  };
}

export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const challenge = await getChallenge(id);
  if (!challenge) notFound();

  // Back on <Page> now the daily-path wrapper is gone: the wrapper had to
  // sit on <main>, which <Page> owns. `rhythm="path"` keeps the 40/40 this
  // route has had since it was redrawn.
  return (
    <Page width="read" rhythm="path">
        {/* A sample account's challenge is labelled and not counted as a
            challenge being opened (docs/sample-activity.md, "Metrics"). */}
        {challenge.isSample ? <SamplePageMarker /> : <ChallengeViewTracker challengeId={id} />}
        <ChallengeInvite
          challengeId={id}
          school={challenge.school}
          content={getSchool(challenge.school)}
          isSample={challenge.isSample}
        />
    </Page>
  );
}
