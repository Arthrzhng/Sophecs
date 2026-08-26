import Link from "next/link";
import { NewThreadForm } from "@/components/thread-forms";
import { SchoolStripe } from "@/components/school-mark";
import { getPosts, getProfile, getThreads } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { SCHOOL_IDS, schoolName } from "@/lib/schools";
import type { ForumChannel } from "@/lib/types";

export const metadata = { title: "Forum · Sophecs" };

const CHANNELS: { id: ForumChannel | "all"; label: string }[] = [
  { id: "all", label: "All" },
  ...SCHOOL_IDS.map((id) => ({ id, label: schoolName(id) })),
  { id: "defections" as const, label: "Defections" },
];

export default async function ForumPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>;
}) {
  const { channel: rawChannel } = await searchParams;
  const channel = CHANNELS.some((c) => c.id === rawChannel)
    ? (rawChannel as ForumChannel)
    : undefined;
  const activeId = channel ?? "all";

  const threads = await getThreads(channel === undefined ? undefined : channel);
  const rows = await Promise.all(
    threads.map(async (thread) => ({
      thread,
      author: await getProfile(thread.profile_id),
      replyCount: (await getPosts(thread.id)).length,
    }))
  );

  return (
    <div className="mx-auto max-w-4xl px-5 pt-14">
      <h1 className="font-serif text-3xl font-medium">Forum</h1>

      <nav className="mt-8 flex flex-wrap gap-2 border-b border-rule pb-4">
        {CHANNELS.map((c) => (
          <Link
            key={c.id}
            href={c.id === "all" ? "/forum" : `/forum?channel=${c.id}`}
            aria-current={activeId === c.id ? "page" : undefined}
            className={`font-mono text-xs uppercase tracking-[0.1em] rounded-btn px-3 py-1.5 border ${
              activeId === c.id
                ? "bg-ink text-surface border-ink"
                : "text-ink-mid border-rule hover:text-ink bg-surface"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </nav>

      <ul>
        {rows.map(({ thread, author, replyCount }) => (
          <li key={thread.id} className="border-b border-rule">
            <Link
              href={`/forum/${thread.id}`}
              className="flex gap-4 py-5 group items-stretch"
            >
              {thread.channel === "defections" ? (
                <span
                  aria-hidden
                  className="inline-block w-[3px] self-stretch rounded-full shrink-0 bg-rule"
                />
              ) : (
                <SchoolStripe school={thread.channel} />
              )}
              <div className="min-w-0">
                <h2 className="font-serif text-lg font-medium leading-snug group-hover:underline underline-offset-4">
                  {thread.title}
                </h2>
                <p className="mt-1.5 font-mono text-xs text-ink-mid">
                  {author?.username ?? "unknown"} ·{" "}
                  {formatDate(thread.created_at)} · {replyCount}{" "}
                  {replyCount === 1 ? "post" : "posts"}
                </p>
              </div>
            </Link>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="py-10 text-ink-mid">
            Nothing in this channel yet. The form below fixes that.
          </li>
        )}
      </ul>

      <section className="mt-12 pb-4 max-w-[63ch]">
        <p className="eyebrow text-ink-soft mb-4">Start a thread</p>
        <NewThreadForm defaultChannel={channel ?? "stoicism"} />
      </section>
    </div>
  );
}
