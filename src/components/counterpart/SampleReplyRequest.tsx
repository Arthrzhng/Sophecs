"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { requestSampleReply } from "@/app/counterpart/actions";

const FAILED = "The sample account's reply could not be written this time. Try again in a minute.";

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
  const [state, setState] = useState<
    { kind: "writing" } | { kind: "waiting" } | { kind: "message"; text: string; retry: boolean }
  >({ kind: "writing" });
  const asked = useRef(false);

  const ask = useCallback(async () => {
    setState({ kind: "writing" });
    try {
      const result = await requestSampleReply(exchangeId);
      if (result.ok) {
        if (!result.delivered) setState({ kind: "waiting" });
        router.refresh();
      } else {
        setState({ kind: "message", text: result.message, retry: result.retry });
      }
    } catch {
      setState({ kind: "message", text: FAILED, retry: true });
    }
  }, [exchangeId, router]);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void ask();
  }, [ask]);

  if (state.kind === "writing") {
    return (
      <p role="status" className="text-sm text-ink-mid">
        The sample account is writing its reply.
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
          onClick={() => void ask()}
          className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
        >
          Try again
        </button>
      )}
    </div>
  );
}
