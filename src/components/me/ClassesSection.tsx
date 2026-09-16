"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClass, joinClass, leaveClass } from "@/app/me/actions";
import { track } from "@/lib/analytics/client";
import type { ClassSummary, JoinedClass } from "@/lib/classes";

const SITE_PATH = "/me/settings?join=";

export function ClassesSection({
  owned,
  joined,
  prefillCode,
}: {
  owned: ClassSummary[];
  joined: JoinedClass[];
  prefillCode?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState(prefillCode ?? "");
  const [newCode, setNewCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setMessage(null);
    const result = await createClass(name);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    track({ name: "class_created", props: {} });
    setNewCode(result.code);
    setName("");
    router.refresh();
  }

  async function join() {
    setBusy(true);
    setMessage(null);
    const result = await joinClass(code);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    track({ name: "class_joined", props: { class_id: result.classId } });
    setCode("");
    setMessage(`Joined ${result.name}.`);
    router.refresh();
  }

  async function leave(classId: string) {
    setBusy(true);
    const result = await leaveClass(classId);
    setBusy(false);
    if (result.ok) {
      track({ name: "class_left", props: { class_id: classId } });
      router.refresh();
    }
  }

  return (
    <div>
      {owned.length > 0 && (
        <ul className="mb-8 space-y-4">
          {owned.map((klass) => (
            <li key={klass.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link
                  href={`/class/${klass.code}`}
                  className="font-serif text-base text-ink hover:underline underline-offset-4"
                >
                  {klass.name}
                </Link>
                <p className="mt-1 font-mono text-xs text-ink-soft">
                  {klass.code} · {klass.memberCount}{" "}
                  {klass.memberCount === 1 ? "member" : "members"}
                </p>
              </div>
              <CopyLink code={klass.code} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[12rem]">
          <label htmlFor="class-name" className="block font-sans text-sm text-ink-mid">
            Create a class link
          </label>
          <input
            id="class-name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="Year 12 Philosophy"
            className="mt-2 w-full rounded-md border border-rule bg-surface p-3 text-base"
          />
        </div>
        <button
          type="button"
          onClick={create}
          disabled={busy || !name.trim()}
          className="min-h-11 rounded-md border border-rule bg-surface px-5 text-sm font-medium hover:border-ink-soft disabled:opacity-40"
        >
          Create
        </button>
      </div>

      {newCode && (
        <p className="mt-3 font-mono text-xs text-ink-mid">
          Code <span className="text-ink">{newCode}</span> · share{" "}
          <span className="text-ink">sophecs.com{SITE_PATH}{newCode}</span>
        </p>
      )}

      <div className="mt-10">
        {joined.length > 0 && (
          <ul className="mb-6 space-y-3">
            {joined.map((klass) => (
              <li key={klass.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-serif text-base">{klass.name}</p>
                  <p className="mt-1 font-mono text-xs text-ink-soft">
                    {klass.memberCount} {klass.memberCount === 1 ? "member" : "members"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => leave(klass.id)}
                  disabled={busy}
                  className="min-h-11 px-3 font-mono text-xs text-ink-soft underline underline-offset-4 hover:text-ink disabled:opacity-50"
                >
                  Leave
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[12rem]">
            <label htmlFor="class-code" className="block font-sans text-sm text-ink-mid">
              Join a class
            </label>
            <input
              id="class-code"
              value={code}
              maxLength={12}
              onChange={(e) => setCode(e.target.value)}
              placeholder="8-character code"
              className="mt-2 w-full rounded-md border border-rule bg-surface p-3 font-mono text-base"
            />
          </div>
          <button
            type="button"
            onClick={join}
            disabled={busy || !code.trim()}
            className="min-h-11 rounded-md border border-rule bg-surface px-5 text-sm font-medium hover:border-ink-soft disabled:opacity-40"
          >
            Join
          </button>
        </div>
        <p className="mt-3 font-sans text-sm text-ink-soft max-w-[54ch]">
          Your teacher will see which motions you&apos;ve read, argued and answered — not your
          arguments, scores or rating.
        </p>
      </div>

      {message && (
        <p role="status" className="mt-4 font-mono text-xs text-ink-mid">
          {message}
        </p>
      )}
    </div>
  );
}

function CopyLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`https://sophecs.com${SITE_PATH}${code}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // The code is on screen either way.
        }
      }}
      className="min-h-11 rounded-md border border-rule bg-surface px-4 text-sm font-medium hover:border-ink-soft"
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
