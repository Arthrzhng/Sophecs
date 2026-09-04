"use client";

import { useState } from "react";
import { setDisplayName } from "@/app/me/actions";

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
      <form onSubmit={save} className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Skippable — otherwise shown as “A Stoic”"
          maxLength={60}
          className="flex-1 min-h-11 bg-surface border border-rule rounded-md px-3 text-sm placeholder:text-ink-soft"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 px-4 bg-ink text-surface rounded-md text-sm font-medium hover:opacity-85 disabled:opacity-60"
        >
          Save
        </button>
      </form>
      {status && (
        <p role="status" className="mt-2 font-mono text-xs text-ink-mid">
          {status}
        </p>
      )}
    </div>
  );
}
