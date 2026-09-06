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
    <label className="flex items-center gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={toggle} disabled={pending} className="h-4 w-4" />
      <span className="text-sm">Publish my argument on this page</span>
    </label>
  );
}
