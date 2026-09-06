import { z } from "zod";

export const PROMPT_VERSION = "v1" as const;

function maxWords(max: number) {
  return (val: string) => val.trim().split(/\s+/).filter(Boolean).length <= max;
}

// What the model must return. `rejected` discriminates the two valid
// shapes — a judged verdict has every score field, a rejection has none.
// Anything else (missing fields, wrong types, a word-count breach) fails
// validation and the debates row stays verdict: null with the argument
// intact — see /api/judge.
export const VerdictSchema = z.discriminatedUnion("rejected", [
  z.object({
    rejected: z.literal(true),
    rejection_reason: z.string().min(1).max(200),
  }),
  z.object({
    rejected: z.literal(false),
    score: z.number().min(0).max(100),
    fidelity: z.number().min(0).max(10),
    rigor: z.number().min(0).max(10),
    engagement: z.number().min(0).max(10),
    strongest_move: z.string().min(1).refine(maxWords(40), "strongest_move exceeds 40 words"),
    weakest_move: z.string().min(1),
    a_stronger_version_would: z
      .string()
      .min(1)
      .refine(maxWords(60), "a_stronger_version_would exceeds 60 words"),
    verdict_line: z.string().min(1).refine(maxWords(20), "verdict_line exceeds 20 words"),
  }),
]);

export type ModelVerdict = z.infer<typeof VerdictSchema>;

// What's stored in debates.verdict — the model's response plus the version
// stamp the server adds, never the model itself (see docs/decisions.md:
// scores across prompt versions are never compared as equivalent).
export type StoredVerdict = ModelVerdict & { prompt_version: typeof PROMPT_VERSION };
