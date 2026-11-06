import { Suspense } from "react";
import { Page } from "@/components/layout/Page";
import { QuizShell } from "@/components/quiz/QuizShell";
import { QuizShellV2 } from "@/components/quiz/QuizShellV2";
import { QUIZ_V2_ON, quizV2, quizV2MapSchools } from "@/lib/quiz-v2";

// On a SIX_SCHOOLS build the quiz is v2, which places a reader in one of
// six schools (docs/stage5-plan.md, step 4); everywhere else it is v1, as
// it was.
export const metadata = {
  title: "The quiz · Sophecs",
  description: QUIZ_V2_ON
    ? "Ten questions that place you in one of six schools of ethics, by what you already think rather than what you have read."
    : "Ten questions that place you in Stoicism, Utilitarianism or Virtue Ethics, by what you already think rather than what you have read.",
};

// Questions are bundled at build time; nothing is fetched until the server
// action on /quiz/result. v2's arrive as props from src/lib/quiz-v2.ts,
// which reads them on the server, so the client bundle never names a
// school that is not published.
//
// Widened from `narrow` to `ui`: the question now sits beside the triangle
// showing where the chosen answer moves the reader, and two columns inside
// 560px squeezed the prompt down to one word a line. The old comment here
// justified `narrow` by the landing page rendering the same block, which
// the Daily path design ends: the new landing has no inline question.
export default function QuizPage() {
  if (QUIZ_V2_ON) {
    const quiz = quizV2();
    return (
      <Page width="ui">
        <Suspense fallback={null}>
          <QuizShellV2
            questions={quiz.questions}
            schools={quiz.schools}
            mapSchools={quizV2MapSchools()}
            axes={quiz.axes}
          />
        </Suspense>
      </Page>
    );
  }
  return (
    <Page width="ui">
      <Suspense fallback={null}>
        <QuizShell />
      </Suspense>
    </Page>
  );
}
