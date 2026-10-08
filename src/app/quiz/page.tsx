import { Suspense } from "react";
import { Page } from "@/components/layout/Page";
import { QuizShell } from "@/components/quiz/QuizShell";

export const metadata = {
  title: "The quiz · Sophecs",
  description:
    "Ten questions that place you in Stoicism, Utilitarianism or Virtue Ethics, by what you already think rather than what you have read.",
};

// Questions are bundled at build time; nothing is fetched until the server
// action on /quiz/result.
//
// Widened from `narrow` to `ui`: the question now sits beside the triangle
// showing where the chosen answer moves the reader, and two columns inside
// 560px squeezed the prompt down to one word a line. The old comment here
// justified `narrow` by the landing page rendering the same block, which
// the Daily path design ends: the new landing has no inline question.
export default function QuizPage() {
  return (
    <Page width="ui">
      <Suspense fallback={null}>
        <QuizShell />
      </Suspense>
    </Page>
  );
}
