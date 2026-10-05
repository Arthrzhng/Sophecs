import { Suspense } from "react";
import { Page } from "@/components/layout/Page";
import { QuizShell } from "@/components/quiz/QuizShell";

export const metadata = {
  title: "The quiz · Sophecs",
  description:
    "Ten questions that place you in Stoicism, Utilitarianism or Virtue Ethics, by what you already think rather than what you have read.",
};

// Questions are bundled at build time; nothing is fetched until the server
// action on /quiz/result. The narrow container is the one the landing page
// uses for the same block, so the step between them is not a step.
export default function QuizPage() {
  return (
    <Page width="narrow">
      <Suspense fallback={null}>
        <QuizShell />
      </Suspense>
    </Page>
  );
}
