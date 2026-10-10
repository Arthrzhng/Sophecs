import { LoginForm } from "@/components/auth/LoginForm";
import { Page } from "@/components/layout/Page";

export const metadata = {
  title: "Sign in · Sophecs",
  description: "Sign in to argue a motion and keep your verdicts.",
};

// Reached only from the debate CTA ("Debate this" / "Debate them") per the
// Phase 2 brief — sign-in is prompted at exactly that one moment, never on
// the quiz/card/share path. See docs/decisions.md.
//
// The container is written out rather than taken from <Page>, because the
// daily-path wrapper has to sit on <main>; /today, /table and /s/[school]
// do the same, and all four go back to <Page> in the stage that deletes
// the wrapper.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Back on <Page> now the daily-path wrapper is gone: the wrapper had to
  // sit on <main>, which <Page> owns. `rhythm="path"` keeps the 40/40 this
  // route has had since it was redrawn.
  return (
    <Page width="narrow" rhythm="path">
        <h1 className="max-w-[20ch] text-xl font-extrabold leading-tight tracking-tight text-ink">
          Sign in to defend your school.
        </h1>
        <p className="mt-3 max-w-[40ch] text-base leading-relaxed text-ink-mid">
          No password. A link to your email, or Google.
        </p>
        <div className="mt-8">
          <LoginForm next={next} />
        </div>
    </Page>
  );
}
