"use client";

import { useState } from "react";
import { setArgumentDefaultPublic } from "@/app/me/actions";

export function ArgumentVisibilityToggle({ initial }: { initial: boolean }) {
  const [checked, setChecked] = useState(initial);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = !checked;
    setChecked(next);
    setPending(true);
    const result = await setArgumentDefaultPublic(next);
    if (!result.ok) setChecked(!next); // revert on failure
    setPending(false);
  }

  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={toggle}
        disabled={pending}
        className="mt-0.5 h-4 w-4"
      />
      <span className="text-sm">
        Publish arguments by default
        <span className="block text-ink-soft text-xs mt-0.5">
          Off by default. When a debate opens, you can still publish or hide
          each argument individually on its verdict page.
        </span>
      </span>
    </label>
  );
}
