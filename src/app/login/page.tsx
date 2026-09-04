import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "Sign in · Sophecs" };

// Reached only from the debate CTA ("Debate this" / "Debate them") per the
// Phase 2 brief — sign-in is prompted at exactly that one moment, never on
// the quiz/card/share path. See docs/decisions.md.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-sm px-6 pt-20 pb-24">
        <h1 className="font-serif text-2xl font-medium">Sign in to defend your school.</h1>
        <p className="mt-3 text-ink-mid text-sm leading-relaxed">
          No password. A link to your email, or Google.
        </p>
        <div className="mt-8">
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
