"use client";

import { useState } from "react";
import { setArgumentPublic } from "@/app/debate/actions";
import { track } from "@/lib/analytics/client";

export function PublishToggle({ debateId, initial }: { debateId: string; initial: boolean }) {
  const [checked, setChecked] = useState(initial);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = !checked;
    setChecked(next);
    setPending(true);
    const result = await setArgumentPublic(debateId, next);
    if (!result.ok) {
      setChecked(!next);
    } else if (next) {
      track({ name: "argument_published", props: { debate_id: debateId } });
    }
    setPending(false);
  }

  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={toggle}
          disabled={pending}
          className="mt-0.5 h-4 w-4 shrink-0 accent-ink"
        />
        <span className="text-sm text-ink">Publish my argument on this page</span>
      </label>
      {/* Says what publishing does, where the decision is made. */}
      <p className="mt-2 max-w-[54ch] text-sm leading-relaxed text-ink-mid">
        {checked
          ? "Anyone with the link can read what you wrote. Untick it and only you can."
          : "Only you can read what you wrote. The score and the verdict are visible to anyone with the link either way."}
      </p>
    </div>
  );
}
