import Link from "next/link";
import { ChunkyLink } from "@/components/daily-path/ChunkyButton";
import { SCHOOL_CHUNKY } from "@/components/daily-path/chunky";
import { SCHOOL_ADHERENT } from "@/lib/school-colors";
import type { SchoolContent } from "@/lib/schools";
import type { SchoolId } from "@/lib/types";

// The body of /c/[id], split out so it can be rendered against a fixture on
// /styleguide/arena. The route itself needs a real challenge row, which
// means this screen is otherwise only visible to someone holding a live
// invite link.
//
// The one page in the product whose reader arrived from a friend rather
// than from a search, knowing nothing. One action, and enough context to
// make that action worth taking — including the quotation their friend's
// school actually rests on, because "a Utilitarian sent you this" means
// nothing to someone who has never met the word.
//
// The button is ink, not the challenger's colour. The reader has no
// school: this is the page that sends them to get one, and a button in
// the sender's colour would say the sender is about to act. Their school
// is on the page in its own colour, as a marker, which is where it
// belongs. See docs/decisions.md.
export function ChallengeInvite({
  challengeId,
  school,
  content,
}: {
  challengeId: string;
  school: SchoolId;
  content: SchoolContent;
}) {
  const adherent = SCHOOL_ADHERENT[school].toLowerCase();

  return (
    <>
      <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">
        Someone challenged you
      </p>
      <h1 className="mt-2 max-w-[24ch] text-xl font-extrabold leading-tight tracking-tight text-ink">
        They came out a {adherent}. Find out what you are.
      </h1>

      <p className="mt-5 max-w-[54ch] text-base leading-relaxed text-ink-mid">
        Sophecs asks ten questions about how AI should decide things and places
        you in one of three schools of ethics, then asks you to argue for yours
        against a motion. No account needed for the questions, and about eighty
        seconds.
      </p>

      <div className="mt-8">
        <ChunkyLink href={`/quiz?c=${challengeId}`} tone="ink">
          Take the quiz
        </ChunkyLink>
      </div>

      {/* What their school actually says, in its own words. A sentence from
          Epictetus does more to explain the thing than a paragraph about
          what the site does. */}
      <section className="mt-12 border-t-2 border-rule pt-10">
        <h2 className="text-lg font-extrabold tracking-tight text-ink">
          What they argue from
        </h2>
        <div
          className="mt-5 rounded-card border-2 border-l-4 border-rule bg-surface p-5"
          style={{ borderLeftColor: SCHOOL_CHUNKY[school].bg }}
        >
          <p className="max-w-[54ch] font-serif text-md leading-relaxed text-ink">
            &ldquo;{content.one_line}&rdquo;
          </p>
          <p className="mt-3 text-sm text-ink-mid">{content.one_line_attribution}</p>
          <p className="mt-4 text-lg font-extrabold tracking-tight text-ink">
            {content.name}
          </p>
        </div>
        <p className="mt-5">
          <Link
            href={`/s/${school}`}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
          >
            Read the case for {content.name}
          </Link>
        </p>
      </section>
    </>
  );
}
