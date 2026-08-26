import Link from "next/link";
import { SchoolDot } from "@/components/school-mark";
import { getCurrentProfile, getDefectionsForProfile } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { schoolName } from "@/lib/schools";

export const metadata = { title: "Profile · Sophecs" };

export default async function MePage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    return (
      <div className="mx-auto max-w-md px-5 pt-16">
        <h1 className="font-serif text-3xl font-medium">Not signed in</h1>
        <p className="mt-3 text-ink-mid leading-relaxed">
          Your school, rating, and record live on an account.
        </p>
        <Link
          href="/auth"
          className="mt-6 inline-block bg-ink text-surface rounded-btn px-5 py-2.5 text-sm font-medium hover:opacity-85"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const defections = await getDefectionsForProfile(profile.id);

  return (
    <div className="mx-auto max-w-3xl px-5 pt-14">
      <p className="eyebrow text-ink-soft">Profile</p>
      <h1 className="mt-2 font-serif text-3xl sm:text-4xl font-medium">
        {profile.username}
      </h1>
      {profile.school_id ? (
        <p className="mt-3 flex items-center gap-2 text-ink-mid">
          <SchoolDot school={profile.school_id} />
          {schoolName(profile.school_id)} · since{" "}
          {formatDate(profile.created_at)}
        </p>
      ) : (
        <p className="mt-3 text-ink-mid">
          No school yet.{" "}
          <Link href="/quiz" className="underline underline-offset-4 text-ink">
            The quiz assigns one.
          </Link>
        </p>
      )}

      <dl className="mt-12 grid grid-cols-3 max-w-md border-y border-rule divide-x divide-rule">
        <div className="py-5 pr-6">
          <dt className="eyebrow-sm text-ink-soft">Rating</dt>
          <dd className="mt-2 font-mono text-2xl">{profile.rating}</dd>
        </div>
        <div className="py-5 px-6">
          <dt className="eyebrow-sm text-ink-soft">Streak</dt>
          <dd className="mt-2 font-mono text-2xl">{profile.streak_days}d</dd>
        </div>
        <div className="py-5 pl-6">
          <dt className="eyebrow-sm text-ink-soft">Record</dt>
          <dd className="mt-2 font-mono text-2xl">
            {profile.wins}–{profile.losses}
          </dd>
        </div>
      </dl>

      <section className="mt-14 pb-4 max-w-[63ch]">
        <p className="eyebrow text-ink-soft mb-4">Defection history</p>
        {defections.length === 0 ? (
          <p className="text-ink-mid leading-relaxed">
            None. You&apos;ve held the line since{" "}
            {formatDate(profile.created_at)}.
          </p>
        ) : (
          <ul className="space-y-6">
            {defections.map((defection) => (
              <li key={defection.id} className="border-t border-rule pt-5">
                <p className="flex items-center gap-2 font-mono text-sm">
                  <SchoolDot school={defection.from_school_id} />
                  {schoolName(defection.from_school_id)}
                  <span className="text-ink-soft">to</span>
                  <SchoolDot school={defection.to_school_id} />
                  {schoolName(defection.to_school_id)}
                  <span className="text-ink-soft">
                    · {formatDate(defection.created_at)}
                  </span>
                </p>
                {defection.reason && (
                  <p className="mt-2 font-serif text-[17px] leading-[1.7] text-ink-mid">
                    &ldquo;{defection.reason}&rdquo;
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
