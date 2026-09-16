"use client";

import { useState } from "react";
import { setExchangePublish } from "@/app/debate/actions";
import { track } from "@/lib/analytics/client";

// Both parties, independently, default off. The copy says the other side's
// state so nobody has to guess whether their own toggle did anything.
export function ExchangePublishToggle({
  exchangeId,
  initial,
  otherAgreed,
}: {
  exchangeId: string;
  initial: boolean;
  otherAgreed: boolean;
}) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !on;
    setBusy(true);
    const result = await setExchangePublish(exchangeId, next);
    setBusy(false);
    if (!result.ok) return;
    setOn(next);
    if (next && otherAgreed) {
      track({ name: "exchange_published", props: { exchange_id: exchangeId } });
    }
  }

  return (
    <div>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={on} disabled={busy} onChange={toggle} className="h-4 w-4" />
        Let others read this exchange
      </label>
      <p className="mt-2 font-sans text-xs text-ink-soft max-w-[52ch]">
        {on && otherAgreed
          ? "Both of you agreed. This exchange now appears under both verdicts."
          : on
            ? "You've agreed. It stays private until your counterpart does too."
            : "Off. Nobody outside this exchange can read it."}
      </p>
    </div>
  );
}
