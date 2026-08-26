import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Sign in · Sophecs" };

export default function AuthPage() {
  return (
    <div className="mx-auto max-w-md px-5 pt-16">
      <h1 className="font-serif text-3xl font-medium">Sign in</h1>
      <p className="mt-3 text-ink-mid leading-relaxed">
        An account holds your school, rating, and record. Reading the lessons
        and taking the quiz never needs one.
      </p>
      <div className="mt-10">
        <AuthForm />
      </div>
    </div>
  );
}
