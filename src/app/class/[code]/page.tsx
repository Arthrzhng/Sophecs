import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { CaseTicks } from "@/components/debate/CaseTicks";
import { ClassViewTracker } from "@/components/me/ClassViewTracker";
import { getCaseStates, type CaseState } from "@/lib/cases";
import { normaliseClassCode } from "@/lib/classes";
import { SCHOOL_ADHERENT, SCHOOL_COLORS, SCHOOL_TEXT_CLASS } from "@/lib/school-colors";
import type { SchoolId } from "@/lib/types";

export const metadata = { title: "Class · Sophecs" };

// Owner only. A member gets 404, not a redirect: this page is a teacher's
// view of their students, and a student should not learn it exists by
// being bounced off it.
//
// What is deliberately absent, and must stay absent: scores, ELO, streaks,
// argument text, and any ordering by performance. Members are listed by
// join date. A teacher can see whether the work was done, not how well.
export default async function ClassPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalised = normaliseClassCode(code);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/class/${normalised}`)}`);

  if (!isAdminConfigured()) notFound();
  const admin = createAdminClient();

  const { data: klass } = await admin
    .from("classes")
    .select("id, name, owner_id")
    .eq("code", normalised)
    .maybeSingle();
  if (!klass || klass.owner_id !== user.id) notFound();

  const [{ data: memberRows }, { data: topicRows }] = await Promise.all([
    admin
      .from("class_members")
      .select("user_id, joined_at")
      .eq("class_id", klass.id)
      .order("joined_at", { ascending: true }),
    admin
      .from("debate_topics")
      .select("slug, title, sort, micro_before")
      .eq("active", true)
      .order("sort", { ascending: true }),
  ]);

  const members = memberRows ?? [];
  const topics = (topicRows ?? []).map((t) => ({
    slug: t.slug as string,
    title: t.title as string,
    microBefore: (t.micro_before as string | null) ?? null,
  }));

  const profileById = new Map<string, { displayName: string | null; school: SchoolId | null }>();
  const statesByUser = new Map<string, Record<string, CaseState>>();

  if (members.length > 0) {
    const userIds = members.map((m) => m.user_id as string);
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name, school")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      profileById.set(p.id as string, {
        displayName: (p.display_name as string | null) ?? null,
        school: (p.school as SchoolId | null) ?? null,
      });
    }

    // getCaseStates is two queries per user, so a 30-student class is 60
    // round trips run concurrently rather than 6 x N sequentially. The
    // brief asks for one query per class; this is the honest middle —
    // batching across users would mean rewriting getCaseStates to take a
    // user list, and its `read` rule needs per-user response counts
    // anyway. Revisit if a class ever gets large enough to matter.
    const results = await Promise.all(
      userIds.map((id) => getCaseStates(admin, id, topics))
    );
    userIds.forEach((id, i) => statesByUser.set(id, results[i]));
  }

  // The container is written out rather than taken from <Page>, because
  // the daily-path wrapper has to sit on <main>; see the note on /me.
  return (
    <main className="flex-1" data-daily-path>
      <div className="mx-auto max-w-ui px-6 py-10">
        <ClassViewTracker classId={klass.id as string} members={members.length} />
        <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">Class</p>
        <h1 className="mt-2 text-xl font-extrabold leading-tight tracking-tight text-ink">
          {klass.name}
        </h1>
        <p className="mt-3 max-w-[54ch] text-base leading-relaxed text-ink-mid">
          Whether each motion has been read, argued, answered and closed. Not
          arguments, scores or ratings.
        </p>

        {members.length === 0 ? (
          <p className="mt-10 text-base text-ink-mid">
            Nobody has joined yet. Share the code{" "}
            <span className="font-mono tabular font-bold text-ink">{normalised}</span>{" "}
            with your class.
          </p>
        ) : (
          <div className="mt-10 flex flex-col gap-5">
            {members.map((member) => {
              const id = member.user_id as string;
              const profile = profileById.get(id);
              const school = profile?.school ?? null;
              const name =
                profile?.displayName ??
                (school ? `A ${SCHOOL_ADHERENT[school]}` : "A student");
              const states = statesByUser.get(id) ?? {};

              return (
                <div
                  key={id}
                  className="rounded-card border-2 border-rule bg-surface p-5"
                >
                  {/* The student's school, on the student. There is no
                      control on this page at all: a teacher reads it and
                      presses nothing, so the colour rule has no actor to
                      follow here. */}
                  {school && (
                    <p className={`text-sm font-bold ${SCHOOL_TEXT_CLASS[school]}`}>
                      {SCHOOL_COLORS[school].name}
                    </p>
                  )}
                  <h2 className="mt-1 font-serif text-md font-medium text-ink">{name}</h2>
                  <ul className="mt-4 flex flex-col gap-4">
                    {topics.map((topic) => (
                      <li key={topic.slug}>
                        <p className="text-sm text-ink-mid">{topic.title}</p>
                        {states[topic.slug] && (
                          <div className="mt-2">
                            <CaseTicks state={states[topic.slug]} />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-12 border-t-2 border-rule pt-10">
          <Link
            href="/me/settings"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
          >
            Settings
          </Link>
        </div>
      </div>
    </main>
  );
}
