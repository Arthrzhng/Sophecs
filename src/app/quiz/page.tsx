import { getQuizOptions, getQuizQuestions } from "@/lib/data";
import { QuizFlow } from "@/components/quiz-flow";

export const metadata = { title: "Quiz · Sophecs" };

// The quiz is fully anonymous: no auth gate anywhere in this flow.
export default async function QuizPage() {
  const [questions, options] = await Promise.all([
    getQuizQuestions(),
    getQuizOptions(),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-5 pt-14">
      <QuizFlow questions={questions} options={options} />
    </div>
  );
}
