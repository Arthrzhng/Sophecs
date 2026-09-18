import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { TurnComposer } from "@/components/counterpart/TurnComposer";
import { TurnActions } from "@/components/counterpart/TurnActions";
import { ExchangePublishToggle } from "@/components/counterpart/PublishToggle";
import { isLapsed, quoteSourceForSeq, MAX_SEQ } from "@/lib/counterpart";
import { SCHOOL_COLORS, SCHOOL_TEXT_CLASS } from "@/lib/school-colors";
import type { SchoolId } from "@/lib/types";
import { Page } from "@/components/layout/Page";

export const metadata = { title: "Counterpart · Sophecs" };

interface TurnRow {
  id: string;
  author_id: string | null;
  seq: number;
  quoted_claim: string;
  body: string;
  screen_result: "pending" | "ok" | "flagged" | "removed";
}

// Participants only. A non-participant gets 404 rather than 403 — that
// someone else's private exchange exists is not information this route
// should confirm.
export default async function CounterpartPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/counterpart/${id}`)}`);

  if (!isAdminConfigured()) notFound();
  const admin = createAdminClient();

  const { data: exchange } = await admin
    .from("exchanges")
    .select(
      "id, topic_slug, debate_a, debate_b, user_a, user_b, school_a, school_b, status, publish_a, publish_b, next_turn, last_turn_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (!exchange || (exchange.user_a !== user.id && exchange.user_b !== user.id)) notFound();

  const iAmA = exchange.user_a === user.id;
  const mySchool = (iAmA ? exchange.school_a : exchange.school_b) as SchoolId;
  const theirSchool = (iAmA ? exchange.school_b : exchange.school_a) as SchoolId;
  const myDebateId = iAmA ? exchange.debate_a : exchange.debate_b;
  const theirDebateId = iAmA ? exchange.debate_b : exchange.debate_a;
  const theirUserId = iAmA ? exchange.user_b : exchange.user_a;

  // Lapse is closed on view rather than by a job: an exchange nobody opens
  // does no harm sitting open, and the only person who needs to see it
  // closed is whoever opens it.
  let status = exchange.status as string;
  if (status === "open" && isLapsed(exchange.last_turn_at as string)) {
    await admin.from("exchanges").update({ status: "lapsed", next_turn: null }).eq("id", id);
    status = "lapsed";
  }

  const [{ data: topic }, { data: debates }, { data: turnRows }] = await Promise.all([
    admin.from("debate_topics").select("motion, title").eq("slug", exchange.topic_slug).maybeSingle(),
    admin.from("debates").select("id, argument").in("id", [myDebateId, theirDebateId]),
    admin
      .from("turns")
      .select("id, author_id, seq, quoted_claim, body, screen_result")
      .eq("exchange_id", id)
      .order("seq", { ascending: true }),
  ]);
  if (!topic) notFound();

  const argumentById = new Map((debates ?? []).map((d) => [d.id as string, d.argument as string]));
  const turns = (turnRows as TurnRow[] | null) ?? [];

  // What each party may read. The admin client bypasses RLS, so the same
  // rule the policy encodes is applied here explicitly: a screened turn is
  // visible to both, an unscreened one only to its author.
  const visible = turns.filter((t) => t.screen_result === "ok" || t.author_id === user.id);
  const myHeld = turns.find((t) => t.author_id === user.id && t.screen_result === "flagged");
  const anyRemoved = turns.some((t) => t.screen_result === "removed");

  const nextSeq = turns.length + 1;
  const myTurn = status === "open" && exchange.next_turn === user.id && nextSeq <= MAX_SEQ;

  // The text the next reply must quote from.
  let sourceText = "";
  let sourceLabel = "";
  if (myTurn) {
    if (quoteSourceForSeq(nextSeq) === "argument") {
      sourceText = argumentById.get(theirDebateId as string) ?? "";
      sourceLabel = "their argument";
    } else {
      const theirLast = [...visible]
        .reverse()
        .find((t) => t.author_id !== user.id && t.screen_result === "ok");
      sourceText = theirLast?.body ?? "";
      sourceLabel = "their last reply";
    }
  }

  return (
    <Page width="read">
        <p className="eyebrow text-ink-soft mb-4">Counterpart</p>
        <h1 className="max-w-[40ch] font-serif text-xl font-medium leading-tight text-ink">
          {topic.motion}
        </h1>

        {!theirUserId && (
          <p className="mt-6 text-sm text-ink-mid">Your counterpart has left.</p>
        )}
        {anyRemoved && (
          <p className="mt-4 text-sm text-ink-mid">A reply was removed for breaking the rules.</p>
        )}

        {/* Stacked at 375 px, side by side from `sm` up. */}
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <Argument
            eyebrow={`You · ${SCHOOL_COLORS[mySchool].name}`}
            school={mySchool}
            text={argumentById.get(myDebateId as string) ?? ""}
          />
          <Argument
            eyebrow={`Counterpart · ${SCHOOL_COLORS[theirSchool].name}`}
            school={theirSchool}
            text={argumentById.get(theirDebateId as string) ?? ""}
          />
        </div>

        {visible.length > 0 && (
          <div className="mt-12 space-y-10 border-t border-rule pt-10">
            {visible.map((turn) => {
              const mine = turn.author_id === user.id;
              return (
                <div key={turn.id}>
                  <p
                    className={`eyebrow mb-3 ${
                      mine ? SCHOOL_TEXT_CLASS[mySchool] : SCHOOL_TEXT_CLASS[theirSchool]
                    }`}
                  >
                    {mine ? "You" : "Counterpart"} · Reply {turn.seq}
                    {turn.screen_result !== "ok" && " · held for review"}
                  </p>
                  <blockquote className="border-l-2 border-rule pl-4 font-serif text-base italic text-ink-mid leading-relaxed max-w-[60ch]">
                    {turn.quoted_claim}
                  </blockquote>
                  <p className="mt-4 font-serif text-base leading-relaxed whitespace-pre-wrap max-w-[60ch]">
                    {turn.body}
                  </p>
                  {!mine && <TurnActions turnId={turn.id} exchangeId={id} />}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-12 border-t border-rule pt-10">
          {myHeld ? (
            <p className="text-sm text-ink-mid">This reply was held for review.</p>
          ) : status === "blocked" ? (
            <p className="text-sm text-ink-mid">This exchange is closed.</p>
          ) : status === "lapsed" ? (
            <p className="text-sm text-ink-mid">
              This exchange lapsed after two weeks without a reply.
            </p>
          ) : status === "complete" ? (
            <div>
              <p className="text-sm text-ink-mid">
                Four replies, and it&apos;s finished. Neither of you has to concede.
              </p>
              <div className="mt-6">
                <ExchangePublishToggle
                  exchangeId={id}
                  initial={Boolean(iAmA ? exchange.publish_a : exchange.publish_b)}
                  otherAgreed={Boolean(iAmA ? exchange.publish_b : exchange.publish_a)}
                />
              </div>
            </div>
          ) : myTurn ? (
            <TurnComposer
              exchangeId={id}
              seq={nextSeq}
              userId={user.id}
              sourceLabel={sourceLabel}
              sourceText={sourceText}
            />
          ) : (
            <p className="text-sm text-ink-mid">Waiting for your counterpart.</p>
          )}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-6">
          <Link
            href={`/debate/${exchange.topic_slug}/${myDebateId}`}
            className="font-mono text-xs text-ink-mid hover:text-ink"
          >
            Your verdict →
          </Link>
          <Link href="/debate/rubric" className="font-mono text-xs text-ink-mid hover:text-ink">
            Counterpart rules →
          </Link>
        </div>
    </Page>
  );
}

function Argument({
  eyebrow,
  school,
  text,
}: {
  eyebrow: string;
  school: SchoolId;
  text: string;
}) {
  return (
    <div>
      <p className={`eyebrow mb-3 ${SCHOOL_TEXT_CLASS[school]}`}>{eyebrow}</p>
      <p className="font-serif text-base leading-relaxed whitespace-pre-wrap">
        {text || "This argument is no longer available."}
      </p>
    </div>
  );
}
