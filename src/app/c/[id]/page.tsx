import { notFound } from "next/navigation";
import { Page } from "@/components/layout/Page";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { ChallengeInvite } from "@/components/share/ChallengeInvite";
import { ChallengeViewTracker } from "@/components/share/ChallengeViewTracker";
import { getSchool } from "@/lib/schools";
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

  // Back on <Page> now the daily-path wrapper is gone: the wrapper had to
  // sit on <main>, which <Page> owns. `rhythm="path"` keeps the 40/40 this
  // route has had since it was redrawn.
  return (
    <Page width="read" rhythm="path">
        <ChallengeViewTracker challengeId={id} />
        <ChallengeInvite
          challengeId={id}
          school={challenge.school}
          content={getSchool(challenge.school)}
        />
    </Page>
  );
}
