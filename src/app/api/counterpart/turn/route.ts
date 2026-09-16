import { NextResponse } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { newId } from "@/lib/ids";
import { isBudgetExceeded } from "@/lib/budget";
import { screenAndLog, ScreenError, SCREEN_DAILY_CAP } from "@/lib/screen";
import {
  authorForSeq,
  checkBody,
  checkQuote,
  quoteSourceForSeq,
  MAX_SEQ,
  MAX_TURN_CHARS,
  MIN_TURN_CHARS,
} from "@/lib/counterpart";

// Order of checks: session, membership, exchange open, whose turn, no turn
// held against this author, quote, body, kill switch, budget, daily cap,
// insert as pending, screen, then deliver. The turn row is written before
// the model call so a screen that errors leaves a saved reply rather than
// losing what someone wrote.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { exchangeId?: string; quotedClaim?: string; body?: string }
    | null;

  if (!body?.exchangeId || typeof body.quotedClaim !== "string" || typeof body.body !== "string") {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();

  const { data: exchange } = await admin
    .from("exchanges")
    .select("id, user_a, user_b, debate_a, debate_b, status, next_turn")
    .eq("id", body.exchangeId)
    .maybeSingle();
  // 404 rather than 403: whether someone else's exchange exists is not
  // something this route should confirm.
  if (!exchange || (exchange.user_a !== user.id && exchange.user_b !== user.id)) {
    return NextResponse.json({ ok: false, error: "Unknown exchange." }, { status: 404 });
  }
  if (exchange.status !== "open") {
    return NextResponse.json({ ok: false, error: "This exchange is closed." }, { status: 409 });
  }
  if (exchange.next_turn !== user.id) {
    return NextResponse.json({ ok: false, error: "It isn't your turn." }, { status: 409 });
  }

  const { data: existingTurns } = await admin
    .from("turns")
    .select("id, seq, author_id, body, screen_result")
    .eq("exchange_id", exchange.id)
    .order("seq", { ascending: true });
  const turns = existingTurns ?? [];

  // An author with a held turn cannot post again in this exchange until it
  // is resolved — otherwise the hold is trivially routed around.
  if (turns.some((t) => t.author_id === user.id && t.screen_result === "flagged")) {
    return NextResponse.json(
      { ok: false, error: "An earlier reply of yours is being reviewed." },
      { status: 409 }
    );
  }

  const seq = turns.length + 1;
  if (seq > MAX_SEQ) {
    return NextResponse.json({ ok: false, error: "This exchange is finished." }, { status: 409 });
  }
  // `next_turn` is authoritative, but the seq-derived author is checked too:
  // the two disagreeing means a bug wrote next_turn, and letting the wrong
  // person take a slot would be unrecoverable.
  if (authorForSeq(seq, exchange.user_a as string, exchange.user_b as string) !== user.id) {
    return NextResponse.json({ ok: false, error: "It isn't your turn." }, { status: 409 });
  }

  // What the quote has to come from: the counterpart's original argument
  // for turns 1-2, their previous reply for 3-4.
  let source = "";
  if (quoteSourceForSeq(seq) === "argument") {
    const theirDebateId = exchange.user_a === user.id ? exchange.debate_b : exchange.debate_a;
    const { data: debate } = await admin
      .from("debates")
      .select("argument")
      .eq("id", theirDebateId)
      .maybeSingle();
    source = (debate?.argument as string | null) ?? "";
  } else {
    const theirLast = [...turns]
      .reverse()
      .find((t) => t.author_id !== user.id && t.screen_result === "ok");
    source = (theirLast?.body as string | null) ?? "";
  }

  const quoteProblem = checkQuote(body.quotedClaim, source);
  if (quoteProblem) {
    return NextResponse.json(
      {
        ok: false,
        error:
          quoteProblem === "not_found"
            ? "Quote the sentence you're answering."
            : quoteProblem === "too_short"
              ? "Quote a whole sentence — at least 10 characters."
              : "That quote is too long; pick one sentence.",
      },
      { status: 400 }
    );
  }

  const bodyProblem = checkBody(body.body);
  if (bodyProblem) {
    return NextResponse.json(
      {
        ok: false,
        error:
          bodyProblem === "too_short"
            ? `Write at least ${MIN_TURN_CHARS} characters.`
            : `Keep it under ${MAX_TURN_CHARS} characters.`,
      },
      { status: 400 }
    );
  }

  const quotedClaim = body.quotedClaim.trim();
  const turnBody = body.body.trim();

  // Written before the screen, deliberately: a model call that fails must
  // not cost someone what they wrote. `pending` is invisible to the
  // counterpart (RLS: turn read party requires screen_result = 'ok').
  const turnId = newId();
  const { error: insertError } = await admin.from("turns").insert({
    id: turnId,
    exchange_id: exchange.id,
    author_id: user.id,
    seq,
    quoted_claim: quotedClaim,
    body: turnBody,
    screen_result: "pending",
  });
  if (insertError) {
    // The unique index on (exchange_id, seq) is the real guard against two
    // concurrent submissions taking the same slot.
    return NextResponse.json({ ok: false, error: "It isn't your turn." }, { status: 409 });
  }

  const killed = process.env.KILL_SWITCH_SCREEN === "true";
  const overBudget = killed ? false : await isBudgetExceeded();

  let overCap = false;
  if (!killed && !overBudget) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("ai_calls")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("kind", "screen")
      .gte("created_at", since);
    overCap = (count ?? 0) >= SCREEN_DAILY_CAP;
  }

  // Never deliver an unscreened turn. Paused, over budget, over cap or a
  // failed call all land in the same place: the row stays `pending`, the
  // counterpart sees nothing, and the author is told it is saved.
  if (killed || overBudget || overCap) {
    return NextResponse.json({ ok: true, delivered: false, seq, turnId });
  }

  let screen;
  try {
    screen = await screenAndLog({ quotedClaim, body: turnBody, userId: user.id });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[screen] call failed:", err instanceof ScreenError ? err.message : String(err));
    }
    return NextResponse.json({ ok: true, delivered: false, seq, turnId });
  }

  if (screen.result !== "ok") {
    await admin
      .from("turns")
      .update({ screen_result: "flagged", screen_reason: `${screen.result}: ${screen.reason}` })
      .eq("id", turnId);
    return NextResponse.json({
      ok: true,
      delivered: false,
      held: true,
      reason: screen.result,
      seq,
      turnId,
    });
  }

  const complete = seq === MAX_SEQ;
  await admin.from("turns").update({ screen_result: "ok" }).eq("id", turnId);
  await admin
    .from("exchanges")
    .update({
      // next_turn is null once the exchange is over — nobody is owed a reply.
      next_turn: complete ? null : exchange.user_a === user.id ? exchange.user_b : exchange.user_a,
      last_turn_at: new Date().toISOString(),
      ...(complete ? { status: "complete" } : {}),
    })
    .eq("id", exchange.id);

  return NextResponse.json({ ok: true, delivered: true, complete, seq, turnId });
}
