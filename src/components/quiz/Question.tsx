import type { QuizQuestion } from "../../../content/quiz/questions";

export function Question({
  question,
  onChoose,
}: {
  question: QuizQuestion;
  onChoose: (optionId: string) => void;
}) {
  return (
    <div>
      <h1 className="font-serif text-2xl sm:text-[28px] font-medium leading-snug max-w-[32ch]">
        {question.prompt}
      </h1>
      <ul className="mt-10 space-y-3">
        {question.options.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              onClick={() => onChoose(option.id)}
              className="w-full min-h-11 text-left bg-surface border border-rule rounded-md px-5 py-4 font-serif text-[17px] leading-relaxed hover:border-ink-soft active:bg-paper transition-colors"
            >
              {option.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
