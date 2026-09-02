import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "Sign in · Sophecs" };

// Reachable only by going here directly — nothing on the quiz/card/share
// path links into it. Optional identity, not a gate. See docs/decisions.md.
export default function LoginPage() {
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-sm px-6 pt-20 pb-24">
        <h1 className="font-serif text-2xl font-medium">Sign in</h1>
        <p className="mt-3 text-ink-mid text-sm leading-relaxed">
          Not required to take the quiz or share a card — this is for later,
          if you want to keep a result attached to you.
        </p>
        <div className="mt-8">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
