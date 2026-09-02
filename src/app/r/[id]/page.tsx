import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import { ResultCard } from "@/components/card/ResultCard";
import { ShareRow } from "@/components/share/ShareRow";
import { ChallengeButton } from "@/components/share/ChallengeButton";
import { CardViewTracker } from "@/components/card/CardViewTracker";
import { getSchool, pickShareLine } from "@/lib/schools";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import type { QuizResultRow, SchoolId } from "@/lib/types";

function schoolDisplayName(id: SchoolId): string {
  return SCHOOL_COLORS[id].name;
}

export const revalidate = 86400; // s-maxage=86400 — result rows never change

async function getResult(id: string): Promise<QuizResultRow | null> {
  if (!isAdminConfigured()) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("public_results")
    .select("id, school, secondary, vector, challenge_from, created_at")
    .eq("id", id)
    .single();
  return (data as QuizResultRow) ?? null;
}

async function getOwnerAnonId(id: string): Promise<string | null> {
  if (!isAdminConfigured()) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("quiz_results").select("anon_id").eq("id", id).single();
  return (data?.anon_id as string | undefined) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getResult(id);
  if (!result) return { title: "Sophecs" };
  const school = getSchool(result.school);
  return {
    title: `${school.name} · Sophecs`,
    description: school.one_line,
    openGraph: {
      title: `${school.name} · Sophecs`,
      description: school.one_line,
      images: [`/r/${id}/opengraph-image`],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getResult(id);
  if (!result) notFound();

  const [cookieStore, headerList, ownerAnonId] = await Promise.all([
    cookies(),
    headers(),
    getOwnerAnonId(id),
  ]);
  const viewerAnonId = cookieStore.get("anon_id")?.value;
  const isOwner = Boolean(viewerAnonId && ownerAnonId && viewerAnonId === ownerAnonId);
  const referrer = headerList.get("referer") ?? "";

  const school = getSchool(result.school);
  const challenger = result.challenge_from ? await getResult(result.challenge_from) : null;
  const { text: shareLine, index: shareLineIndex } = pickShareLine(result.school, result.id);

  return (
    <main className="flex-1">
      <CardViewTracker resultId={id} school={result.school} isOwner={isOwner} referrer={referrer} />
      <div className="mx-auto max-w-2xl px-6 pt-14 pb-20">
        <p className="eyebrow text-ink-soft mb-5">
          {isOwner ? "Your result" : "Someone shared this result"}
        </p>

        <ResultCard
          school={result.school}
          oneLine={school.one_line}
          oneLineAttribution={school.one_line_attribution}
          vector={result.vector}
        />

        {challenger && (
          <div className="mt-8 grid grid-cols-2 gap-6 border-t border-rule pt-6">
            <VectorColumn label="This result" vector={result.vector} />
            <VectorColumn label="Whoever sent it" vector={challenger.vector} />
          </div>
        )}

        <div className="mt-8">
          <ShareRow resultId={id} school={result.school} shareLine={shareLine} shareLineIndex={shareLineIndex} />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <ChallengeButton resultId={id} school={result.school} />
          <Link
            href={`/s/${result.school}`}
            className="text-sm font-medium text-ink-mid hover:text-ink underline underline-offset-4"
          >
            Read the case for {schoolDisplayName(result.school)}
          </Link>
        </div>
      </div>
    </main>
  );
}

function VectorColumn({ label, vector }: { label: string; vector: QuizResultRow["vector"] }) {
  const order: SchoolId[] = ["stoicism", "utilitarianism", "virtue-ethics"];
  return (
    <div>
      <p className="eyebrow-sm text-ink-soft mb-2">{label}</p>
      <dl className="space-y-1 font-mono text-sm">
        {order.map((id) => (
          <div key={id} className="flex justify-between">
            <dt className="text-ink-mid">{schoolDisplayName(id)}</dt>
            <dd>{Math.round(vector[id] * 100)}%</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
