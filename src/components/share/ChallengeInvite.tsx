import { ButtonLink } from "@/components/ui/Button";
import { TextLink } from "@/components/ui/TextLink";
import { SCHOOL_ADHERENT, SCHOOL_COLORS } from "@/lib/school-colors";
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
      <p className="text-sm text-ink-soft">Someone challenged you</p>
      <h1 className="mt-2 max-w-[24ch] font-serif text-xl font-medium leading-tight text-ink">
        They came out a {adherent}. Find out what you are.
      </h1>

      <p className="mt-5 max-w-[54ch] text-sm leading-relaxed text-ink-mid">
        Sophecs asks ten questions about how AI should decide things and places
        you in one of three schools of ethics, then asks you to argue for yours
        against a motion. No account needed for the questions, and about eighty
        seconds.
      </p>

      <div className="mt-8">
        <ButtonLink href={`/quiz?c=${challengeId}`}>Take the quiz</ButtonLink>
      </div>

      {/* What their school actually says, in its own words. A sentence from
          Epictetus does more to explain the thing than a paragraph about
          what the site does. */}
      <section className="mt-12 border-t border-rule pt-8">
        <p className="text-sm text-ink-soft">What they argue from</p>
        <div
          className="mt-4 border-l-2 pl-4"
          style={{ borderColor: SCHOOL_COLORS[school].surface }}
        >
          <p className="text-sm text-ink-mid">{content.name}</p>
          <p className="mt-2 max-w-[54ch] font-serif text-md leading-relaxed text-ink">
            &ldquo;{content.one_line}&rdquo;
          </p>
          <p className="mt-3 text-sm text-ink-soft">{content.one_line_attribution}</p>
        </div>
        <p className="mt-5 text-sm">
          <TextLink href={`/s/${school}`}>Read the case for {content.name}</TextLink>
        </p>
      </section>
    </>
  );
}
