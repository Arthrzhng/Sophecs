import Link from "next/link";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import type { SchoolId } from "@/lib/types";

const SCHOOLS: SchoolId[] = ["stoicism", "utilitarianism", "virtue-ethics"];

// Placeholders, to be filled before the Phase 5 production deploy. They are
// left visibly unfilled rather than guessed — a made-up name or address in
// a footer is worse than an obvious gap.
const MADE_BY = "[YOUR NAME]";
const CONTACT = "[YOUR EMAIL]";

// Duplicated from src/lib/anthropic.ts's MODEL rather than imported. That
// module reads the judge prompt off disk at module scope, so importing it
// here would put the judge pipeline in the render path of every page in the
// product — and a missing prompt file would take down the footer, and with
// it the whole site. That exact failure mode (a module-scope read throwing
// inside the root layout) already cost this project a production incident.
// The judge client is frozen this phase, so the constant is copied with a
// pointer instead of extracted.
const JUDGE_MODEL = "claude-sonnet-5";

function Column({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-medium text-ink">{heading}</h2>
      <ul className="mt-3 space-y-2 text-sm">{children}</ul>
    </div>
  );
}

function Row({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-ink-mid hover:text-ink">
        {children}
      </Link>
    </li>
  );
}

// Session-free, so it renders inside the static acquisition routes.
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-rule" data-print="hide">
      <div className="mx-auto max-w-ui px-6 py-12">
        <p className="max-w-[54ch] text-sm leading-relaxed text-ink-mid">
          Sophecs is a philosophy tool for 15 to 18 year olds. Ten questions
          place you in a school of ethics, then you argue a motion from it and
          a judge scores how faithfully you argued, not whether it agrees.
        </p>

        <div className="mt-10 flex flex-wrap gap-x-16 gap-y-8">
          <Column heading="The site">
            <Row href="/quiz">Quiz</Row>
            <Row href="/debate">Debate</Row>
            <Row href="/lessons">Lessons</Row>
            <Row href="/me">Your profile</Row>
          </Column>

          <Column heading="The schools">
            {SCHOOLS.map((id) => (
              <Row key={id} href={`/s/${id}`}>
                {SCHOOL_COLORS[id].name}
              </Row>
            ))}
          </Column>

          <Column heading="About">
            <li className="text-ink-mid">Made by {MADE_BY}</li>
            <li className="text-ink-mid">{CONTACT}</li>
            <Row href="/debate/rubric">Sources and method</Row>
          </Column>
        </div>

        {/*
          The judge-model disclosure. A product that scores a teenager's
          reasoning owes them the name of the thing doing the scoring and a
          way to read the criteria, and the rubric page already exists and
          is public.
        */}
        <div className="mt-10 border-t border-rule pt-6">
          <p className="max-w-[60ch] text-sm leading-relaxed text-ink-soft">
            Arguments are scored by {JUDGE_MODEL}, an AI model made by Anthropic,
            against a published rubric. The model sees your argument, the
            motion and the criteria for your school, and nothing else about
            you. It can be wrong, which is why every verdict names the
            criteria it applied and why you get a revision.{" "}
            <Link href="/debate/rubric" className="text-ink-mid underline underline-offset-4 hover:text-ink">
              Read the rubric
            </Link>
            .
          </p>
          <p className="mt-4 max-w-[60ch] text-sm leading-relaxed text-ink-soft">
            We store your quiz result, your arguments and your verdicts. We do
            not sell data. We use PostHog for analytics. Deleting your account
            in settings removes your profile and your reading notes, and takes
            your name off everything else; arguments you chose to publish stay
            up without you attached to them.
          </p>
        </div>
      </div>
    </footer>
  );
}
