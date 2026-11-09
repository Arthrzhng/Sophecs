"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { requestSampleReply } from "@/app/counterpart/actions";

const FAILED = "The sample account's reply could not be written this time. Try again in a minute.";
// While another request holds the reader's claim (a reload, a second tab,
// a reply being written in another of the reader's exchanges), ask again
// this often, for longer than a claim can last: 150 seconds against
// CLAIM_SECONDS, 120 (src/lib/sample-reply.ts, migration 0030).
const WRITING_WAIT_MS = 15_000;
const WRITING_TRIES = 10;
// After a reply is in, one more ask once the page has had time to read it
// again: if the turn's hand-over did not go through, that ask makes it.
const AFTER_REPLY_MS = 4_000;

type State =
  | { kind: "writing" }
  | { kind: "replied" }
  | { kind: "waiting" }
  | { kind: "message"; text: string; retry: boolean };
type Answer = Awaited<ReturnType<typeof requestSampleReply>>;

/**
 * What the component does with an answer: what it shows, whether it asks
 * again and when, and whether it reads the page again. Pure, so it can be
 * tested without a browser. `tries` is how many times it has already asked
 * again while another request held the turn.
 */
export function afterAnswer(answer: Answer, tries: number): { state: State; askAgainInMs: number | null; refresh: boolean } {
  if (!answer.ok) return { state: { kind: "message", text: answer.message, retry: answer.retry }, askAgainInMs: null, refresh: false };
  if (answer.writing) {
    return tries < WRITING_TRIES
      ? { state: { kind: "writing" }, askAgainInMs: WRITING_WAIT_MS, refresh: false }
      : { state: { kind: "message", text: FAILED, retry: true }, askAgainInMs: null, refresh: false };
  }
  // In: said so, the page read again, and one more ask in case the turn's
  // hand-over did not go through. Not due: nothing to write.
  return answer.delivered
    ? { state: { kind: "replied" }, askAgainInMs: AFTER_REPLY_MS, refresh: true }
    : { state: { kind: "waiting" }, askAgainInMs: null, refresh: true };
}

/**
 * One ask, with its effects passed in so it can be tested without a
 * browser: shows "writing", asks, and unless the reader has left the page
 * meanwhile (`alive`), shows the answer, sets the next ask and reads the
 * page again as `afterAnswer` says.
 */
export async function askOnce(deps: {
  request: () => Promise<Answer>;
  alive: () => boolean;
  tries: { current: number };
  show: (state: State) => void;
  later: (again: () => void, ms: number) => void;
  refresh: () => void;
  again: () => void;
}): Promise<void> {
  deps.show({ kind: "writing" });
  try {
    const answer = await deps.request();
    if (!deps.alive()) return;
    const next = afterAnswer(answer, deps.tries.current);
    deps.tries.current = answer.ok && answer.writing ? deps.tries.current + 1 : 0;
    deps.show(next.state);
    if (next.askAgainInMs !== null) deps.later(deps.again, next.askAgainInMs);
    if (next.refresh) deps.refresh();
  } catch {
    if (deps.alive()) deps.show({ kind: "message", text: FAILED, retry: true });
  }
}

/**
 * Where "Waiting for your counterpart" would be, when the counterpart is a
 * sample account and its reply is due: asks for the reply once, says it is
 * being written, and reads the page again when it is in. A limit is said
 * plainly, as the server words it (src/lib/sample-reply.ts,
 * sampleReplyMessage). Asked for once per visit; "Try again" only where
 * trying again can help.
 */
export function SampleReplyRequest({ exchangeId }: { exchangeId: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "writing" });
  const asked = useRef(false);
  const tries = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // False once the reader has left the page: an answer that arrives after
  // that starts no timer and reads no page again.
  const alive = useRef(true);

  const ask = useCallback(
    (): Promise<void> =>
      askOnce({
        request: () => requestSampleReply(exchangeId),
        alive: () => alive.current,
        tries,
        show: setState,
        later: (again, ms) => {
          timer.current = setTimeout(again, ms);
        },
        refresh: () => router.refresh(),
        again: () => void ask(),
      }),
    [exchangeId, router]
  );

  useEffect(() => {
    alive.current = true;
    if (!asked.current) {
      asked.current = true;
      void ask();
    }
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [ask]);

  if (state.kind === "writing") {
    return (
      <p role="status" className="text-sm text-ink-mid">
        The sample account is writing its reply.
      </p>
    );
  }
  if (state.kind === "replied") {
    return (
      <p role="status" className="text-sm text-ink-mid">
        The sample account has replied.
      </p>
    );
  }
  if (state.kind === "waiting") {
    return <p className="text-sm text-ink-mid">Waiting for your counterpart.</p>;
  }
  return (
    <div role="status">
      <p className="max-w-[60ch] text-sm text-ink-mid">{state.text}</p>
      {state.retry && (
        <button
          type="button"
          onClick={() => {
            tries.current = 0;
            void ask();
          }}
          className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
        >
          Try again
        </button>
      )}
    </div>
  );
}
