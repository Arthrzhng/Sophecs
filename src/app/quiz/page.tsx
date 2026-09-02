import { Suspense } from "react";
import { QuizShell } from "@/components/quiz/QuizShell";

export const metadata = { title: "The quiz · Sophecs" };

// Client component, questions bundled at build time, no fetch before the
// final server action on /quiz/result.
export default function QuizPage() {
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 pt-14 pb-20">
        <Suspense fallback={null}>
          <QuizShell />
        </Suspense>
      </div>
    </main>
  );
}
