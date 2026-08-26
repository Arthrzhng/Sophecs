import Link from "next/link";
import { notFound } from "next/navigation";
import { ReplyForm } from "@/components/thread-forms";
import { SchoolEyebrow } from "@/components/school-mark";
import { getPosts, getProfile, getThread } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Thread · Sophecs" };

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ thread: string }>;
}) {
  const { thread: threadId } = await params;
  const thread = await getThread(threadId);
  if (!thread) notFound();

  const posts = await getPosts(thread.id);
  const authors = await Promise.all(
    posts.map((post) => getProfile(post.profile_id))
  );

  return (
    <div className="mx-auto max-w-3xl px-5 pt-14">
      <Link
        href="/forum"
        className="font-mono text-xs text-ink-mid hover:text-ink"
      >
        ← Forum
      </Link>

      <div className="mt-6">
        {thread.channel === "defections" ? (
          <span className="eyebrow text-ink-mid">Defections</span>
        ) : (
          <SchoolEyebrow school={thread.channel} />
        )}
        <h1 className="font-serif text-2xl sm:text-3xl font-medium leading-snug mt-2 max-w-[63ch]">
          {thread.title}
        </h1>
      </div>

      <ul className="mt-10 space-y-8">
        {posts.map((post, i) => (
          <li key={post.id} className="border-t border-rule pt-6">
            <p className="font-mono text-xs text-ink-mid mb-3">
              {authors[i]?.username ?? "unknown"} ·{" "}
              {formatDate(post.created_at)}
            </p>
            <p className="font-serif text-[17px] leading-[1.7] max-w-[63ch]">
              {post.body}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-14 border-t border-rule pt-8 pb-4 max-w-[63ch]">
        <ReplyForm threadId={thread.id} />
      </div>
    </div>
  );
}
