/**
 * `next`, as a path on `origin`, or null if it would leave it.
 *
 * `next` reaches /auth/callback from /login's query string, which anyone
 * can write. Resolved against the site as it was, `//evil.example`,
 * `/\evil.example` or `https://evil.example` sent a reader who had just
 * signed in to another site. Only a value that starts with one slash and
 * still resolves to the same origin is kept, as its path, query and hash.
 */
export function localPath(next: string | null | undefined, origin: string): string | null {
  if (!next || !next.startsWith("/")) return null;
  try {
    const url = new URL(next, origin);
    return url.origin === new URL(origin).origin ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}
