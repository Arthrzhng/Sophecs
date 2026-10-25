/**
 * Where a golden run finds its API key.
 *
 * Claude Code's cloud sessions withhold any environment variable named
 * ANTHROPIC_API_KEY. Checked on 2026-10-25: Arthur set ANTHROPIC_API_KEY and
 * SOPHECS_CHECK side by side in the environment's variables, and a fresh
 * session saw SOPHECS_CHECK and not the key. Presumably because Claude Code
 * runs on Anthropic's API itself, and a key under that name would collide
 * with its own sign-in.
 *
 * So the eval key goes in as SOPHECS_EVAL_KEY, and the runner hands it to
 * the client. `src/lib/anthropic.ts` builds its client lazily, on the first
 * call, from ANTHROPIC_API_KEY, so setting that inside the runner's own
 * process before the first call is enough and the frozen file is untouched.
 * Production on Vercel reads ANTHROPIC_API_KEY as it always has, and
 * nothing in src/ may mention SOPHECS_EVAL_KEY; tests/draft-criteria.test.ts
 * checks that.
 *
 * ANTHROPIC_API_KEY is still accepted where it is not withheld, for a run on
 * a machine of one's own. SOPHECS_EVAL_KEY wins when both are set, because
 * it can only mean the eval key.
 *
 * Nothing here ever returns, logs or throws the key itself. Every message
 * describes it by length and shape only.
 */

export const EVAL_KEY_NAME = "SOPHECS_EVAL_KEY";
const FALLBACK_NAME = "ANTHROPIC_API_KEY";

export type EvalKey =
  | { ok: true; key: string; from: typeof EVAL_KEY_NAME | typeof FALLBACK_NAME }
  | { ok: false; reason: string };

/**
 * The problem with a key's shape, or null if it looks like an Anthropic
 * API key. Each check is one somebody could plausibly get wrong pasting it
 * into a settings form, and each says what to fix without echoing the key.
 */
export function keyShapeProblem(value: string): string | null {
  if (/^bearer\s/i.test(value.trim())) {
    return 'it starts with "Bearer ", which Anthropic does not take; set the key alone';
  }
  if (/^["']|["']$/.test(value.trim())) {
    return "it is wrapped in quote marks; set the key alone, without them";
  }
  if (/\s/.test(value.trim())) {
    return "it contains a space or a line break";
  }
  if (!value.trim().startsWith("sk-ant-")) {
    return "it does not start with sk-ant-, as an Anthropic API key does";
  }
  return null;
}

// A plain record rather than NodeJS.ProcessEnv, which Next's types make
// require NODE_ENV; process.env still satisfies it.
export function resolveEvalKey(env: Readonly<Record<string, string | undefined>>): EvalKey {
  for (const name of [EVAL_KEY_NAME, FALLBACK_NAME] as const) {
    const value = env[name];
    if (value === undefined || value.trim() === "") continue;
    const problem = keyShapeProblem(value);
    if (problem) {
      return { ok: false, reason: `${name} is set but ${problem} (${value.length} characters)` };
    }
    return { ok: true, key: value.trim(), from: name };
  }
  return {
    ok: false,
    reason:
      `no key found: set ${EVAL_KEY_NAME} in the environment's variables. ` +
      `${FALLBACK_NAME} also works where it is not withheld, but Claude Code's ` +
      `cloud sessions withhold it`,
  };
}

/** One line for a report, saying where the key came from and never what it is. */
export function describeEvalKey(found: EvalKey): string {
  return found.ok
    ? `key: found in ${found.from}, ${found.key.length} characters, shaped like an Anthropic key`
    : `key: ${found.reason}`;
}
