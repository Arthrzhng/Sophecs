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
    <label className="flex cursor-pointer items-start gap-4 rounded-card border-2 border-rule bg-surface p-5">
      <input
        type="checkbox"
        checked={checked}
        onChange={toggle}
        disabled={pending}
        className="mt-0.5 size-5 shrink-0 accent-[color:var(--color-ink)]"
      />
      <span className="min-w-0">
        <span className="block text-base font-bold text-ink">
          Publish arguments by default
        </span>
        <span className="mt-1 block max-w-[54ch] text-sm leading-relaxed text-ink-mid">
          Off by default. When a debate opens, you can still publish or hide
          each argument individually on its verdict page.
        </span>
      </span>
    </label>
  );
}
