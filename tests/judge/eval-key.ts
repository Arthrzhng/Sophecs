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
 * nothing in src/ may mention SOPHECS_EVAL_KEY; tests/eval-key.test.ts
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
  // Letters, digits, hyphens and underscores only after the prefix. Without
  // this, a zero-width or control character pasted with the key would pass
  // here and be left to the HTTP layer to reject, and whether that rejection
  // repeats the value in its message would depend on that layer.
  if (!/^sk-ant-[A-Za-z0-9_-]+$/.test(value.trim())) {
    return "it contains a character an Anthropic key does not, often an invisible one from a paste";
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

/**
 * Where the key would be sent, and anything else that would change the
 * request.
 *
 * The Anthropic library reads ANTHROPIC_BASE_URL when the client is built,
 * so the eval key goes wherever that points. In Claude Code's cloud
 * sessions it is set, to https://api.anthropic.com. If a session ever
 * pointed it at a gateway or a proxy, the key would go there instead. It
 * also reads ANTHROPIC_AUTH_TOKEN, which adds an Authorization header with
 * a different credential, and ANTHROPIC_CUSTOM_HEADERS, which adds arbitrary
 * ones. A real run refuses unless the key is going to Anthropic and nothing
 * else rides along with it.
 */
export const ANTHROPIC_API_ORIGIN = "https://api.anthropic.com";

export function endpointProblem(env: Readonly<Record<string, string | undefined>>): string | null {
  const base = env.ANTHROPIC_BASE_URL?.trim();
  if (base) {
    let url: URL;
    try {
      url = new URL(base);
    } catch {
      return "ANTHROPIC_BASE_URL is set to something that is not a URL";
    }
    // A username or password in the URL is never needed here, and Node's
    // fetch, refusing it, repeats the whole URL, password included, in its
    // error. Refused before that can happen, without echoing either.
    if (url.username || url.password) {
      return "ANTHROPIC_BASE_URL carries a username or password, which it never should";
    }
    const origin = url.origin;
    if (origin !== ANTHROPIC_API_ORIGIN) {
      return `ANTHROPIC_BASE_URL points at ${origin}, not ${ANTHROPIC_API_ORIGIN}, and the key would go there`;
    }
  }
  for (const name of ["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_CUSTOM_HEADERS"]) {
    if (env[name]?.trim()) {
      return `${name} is set, and would add a credential or headers to every request`;
    }
  }
  return null;
}

/** One line for a report: where requests would go, never any credential. */
export function describeEndpoint(env: Readonly<Record<string, string | undefined>>): string {
  const problem = endpointProblem(env);
  if (problem) return `endpoint: ${problem}`;
  return `endpoint: ${ANTHROPIC_API_ORIGIN}`;
}
