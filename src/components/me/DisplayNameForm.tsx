"use client";

import { useState } from "react";
import { setDisplayName } from "@/app/me/actions";
import { ChunkyButton } from "@/components/daily-path/ChunkyButton";

export function DisplayNameForm({ initial }: { initial: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await setDisplayName(value);
    setStatus(result.ok ? "Saved." : result.error);
    setPending(false);
  }

  return (
    <div>
      {/* Stacked below sm for the same reason /login's is: a 56px field
          beside a 56px button leaves no room to read back what you typed. */}
      <form onSubmit={save} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Skippable — otherwise shown as “A Stoic”"
          maxLength={60}
          className="min-h-14 flex-1 rounded-chunky border-2 border-rule-strong bg-surface px-4 text-base text-ink placeholder:text-ink-soft"
        />
        <ChunkyButton
          type="submit"
          tone="paper"
          disabled={pending}
          className="border-2 border-rule-strong"
        >
          Save
        </ChunkyButton>
      </form>
      {status && (
        <p role="status" className="mt-3 text-sm text-ink-mid">
          {status}
        </p>
      )}
    </div>
  );
}
