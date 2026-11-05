/**
 * `next`, as a path on `origin`, or null if it would leave it.
 *
 * `next` reaches /auth/callback from /login's query string, which anyone
 * can write. Resolved against the site as it was, `//evil.example`,
 * `/\evil.example` or `https://evil.example` sent a reader who had just
 * signed in to another site.
 *
 * The check is made on what is returned, not only on what was given: dot
 * segments normalise away, so `/..//evil.example` resolves on the site to
 * the path `//evil.example`, which the caller would then resolve as a host.
 * A path is kept only if it stays on any origin it is resolved against.
 */
const PROBE = "https://local.invalid";

export function localPath(next: string | null | undefined, origin: string): string | null {
  if (!next || !next.startsWith("/")) return null;
  try {
    const base = new URL(origin);
    const url = new URL(next, base);
    if (url.origin !== base.origin) return null;
    const path = `${url.pathname}${url.search}${url.hash}`;
    if (!path.startsWith("/") || path.startsWith("//") || new URL(path, PROBE).origin !== PROBE) return null;
    return path;
  } catch {
    return null;
  }
}
