import { QuizResultClient } from "@/components/quiz/QuizResultClient";
import { QuizResultClientV2 } from "@/components/quiz/QuizResultClientV2";
import { getAllSchools } from "@/lib/schools";
import { QUIZ_V2_ON, quizV2, quizV2MapSchools } from "@/lib/quiz-v2";

export const metadata = {
  title: "Your school · Sophecs",
  description:
    "The school of ethics your answers place you closest to, and what it commits you to.",
};

// Server wrapper only exists to hand the (fs-backed) school content down to
// the client component as plain props — everything else on this transient
// page runs client-side against sessionStorage. On a SIX_SCHOOLS build the
// result is quiz v2's, with the map's schools and axes passed the same way
// (src/lib/quiz-v2.ts).
export default function QuizResultPage() {
  const schools = getAllSchools();
  if (QUIZ_V2_ON) {
    return <QuizResultClientV2 schools={schools} mapSchools={quizV2MapSchools()} axes={quizV2().axes} />;
  }
  return <QuizResultClient schools={schools} />;
}
