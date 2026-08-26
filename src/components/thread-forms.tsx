"use client";

import { createPost, createThread } from "@/app/actions";
import { SCHOOL_IDS, schoolName } from "@/lib/schools";
import type { ForumChannel } from "@/lib/types";

export function NewThreadForm({
  defaultChannel,
}: {
  defaultChannel: ForumChannel;
}) {
  return (
    <form action={createThread} className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <label className="block">
          <span className="text-xs font-medium text-ink-mid block mb-1.5">
            Channel
          </span>
          <select
            name="channel"
            defaultValue={defaultChannel}
            className="bg-surface border border-rule rounded-btn px-3 py-2 text-sm"
          >
            {SCHOOL_IDS.map((id) => (
              <option key={id} value={id}>
                {schoolName(id)}
              </option>
            ))}
            <option value="defections">Defections</option>
          </select>
        </label>
        <label className="block flex-1 min-w-[240px]">
          <span className="text-xs font-medium text-ink-mid block mb-1.5">
            Title
          </span>
          <input
            name="title"
            required
            placeholder="Put the claim in the title"
            className="w-full bg-surface border border-rule rounded-btn px-3 py-2 font-serif text-[16px] placeholder:font-sans placeholder:text-sm placeholder:text-ink-soft"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-medium text-ink-mid block mb-1.5">
          Opening post
        </span>
        <textarea
          name="body"
          required
          rows={4}
          className="w-full bg-surface border border-rule rounded-btn px-3 py-2 font-serif text-[16px] leading-relaxed resize-y"
        />
      </label>
      <button
        type="submit"
        className="bg-ink text-surface rounded-btn px-5 py-2.5 text-sm font-medium hover:opacity-85"
      >
        Post thread
      </button>
    </form>
  );
}

export function ReplyForm({ threadId }: { threadId: string }) {
  return (
    <form action={createPost} className="space-y-3">
      <input type="hidden" name="thread_id" value={threadId} />
      <label className="block">
        <span className="eyebrow text-ink-soft block mb-3">Reply</span>
        <textarea
          name="body"
          required
          rows={4}
          className="w-full bg-surface border border-rule rounded-btn px-4 py-3 font-serif text-[17px] leading-relaxed resize-y"
        />
      </label>
      <button
        type="submit"
        className="bg-ink text-surface rounded-btn px-5 py-2.5 text-sm font-medium hover:opacity-85"
      >
        Post reply
      </button>
    </form>
  );
}
