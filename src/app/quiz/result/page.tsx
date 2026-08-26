import { getAllModules } from "@/lib/content";
import { ResultView } from "@/components/result-view";
import type { SchoolId } from "@/lib/types";

export const metadata = { title: "Your school · Sophecs" };

export default function QuizResultPage() {
  // The micro-lesson on the result card is the module's quiz_excerpt,
  // resolved server-side for all three schools since the outcome lives in
  // the visitor's browser.
  const excerpts = Object.fromEntries(
    getAllModules().map((mod) => [mod.school_id, mod.quiz_excerpt])
  ) as Record<SchoolId, string>;

  return (
    <div className="mx-auto max-w-3xl px-5 pt-14">
      <ResultView excerpts={excerpts} />
    </div>
  );
}
