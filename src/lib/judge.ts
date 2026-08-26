import "server-only";
import type { Motion, Submission, VerdictScores } from "./types";

export interface JudgeInput {
  submissionA: Submission;
  submissionB: Submission;
  motion: Motion;
}

export interface JudgeOutput {
  winner_submission_id: string;
  scores: { a: VerdictScores; b: VerdictScores };
  rationale: string;
}

// STUB. Returns a hardcoded plausible verdict after a fake delay. The
// signature is the contract: a real model call replaces the body of this
// function and nothing upstream changes.
export async function judge({
  submissionA,
  submissionB,
}: JudgeInput): Promise<JudgeOutput> {
  await new Promise((resolve) => setTimeout(resolve, 800));

  return {
    winner_submission_id: submissionA.id,
    scores: {
      a: { logic: 8, sources: 7, answers_opponent: 6, clarity: 8 },
      b: { logic: 6, sources: 5, answers_opponent: 7, clarity: 6 },
    },
    rationale:
      "The affirmative case builds from a stated premise to its conclusion and cites a source by name. The negative lands one good counterpunch on responsibility but never returns to the motion itself, and its final sentence introduces a claim it has no room to defend.",
  };
}
