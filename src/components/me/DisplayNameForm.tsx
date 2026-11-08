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
      {/* In a line of its own, not the placeholder: it is too long for a
          phone's field, and the name that stands in is the reader's own
          school's adherent ("A Utilitarian"), not always "A Stoic". */}
      <p id="display-name-hint" className="mb-3 text-sm text-ink-soft">
        Optional, and shown only in your classes. Without one, you appear by your school, as in “A Stoic”.
      </p>
      {/* Stacked below sm for the same reason /login's is: a 56px field
          beside a 56px button leaves no room to read back what you typed. */}
      <form onSubmit={save} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Display name"
          aria-describedby="display-name-hint"
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
