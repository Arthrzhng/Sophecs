/**
 * Whether a reader is signed in, as far as the header needs to know: the
 * session cookie @supabase/ssr sets, `sb-<project-ref>-auth-token`, is
 * present. Not an authoritative check, and it does not need to be: the
 * label and the links it chooses are cosmetic, and every page behind them
 * checks the session itself. The same test `AuthSlot` makes.
 *
 * On a SIX_SCHOOLS build the root layout runs AUTH_HINT_SCRIPT before the
 * page is drawn, and it marks <html data-auth="in">, so the header shows
 * the right links from the first paint without reading cookies on the
 * server, which would make every page dynamic (see AuthSlot for why that
 * matters).
 */
export const SESSION_COOKIE = /(?:^|;\s*)sb-[^=]*-auth-token[^=]*=/;

export const AUTH_HINT_SCRIPT = `try{if(${SESSION_COOKIE.toString()}.test(document.cookie))document.documentElement.setAttribute("data-auth","in")}catch(e){}`;

/** The same mark, kept up to date as the reader moves between pages. */
export function syncAuthHint(): void {
  try {
    if (SESSION_COOKIE.test(document.cookie)) document.documentElement.setAttribute("data-auth", "in");
    else document.documentElement.removeAttribute("data-auth");
  } catch {
    // No document, or no cookie access: leave the mark as it is.
  }
}
