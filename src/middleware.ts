import { NextResponse, type NextRequest } from "next/server";

// Edge runtime (middleware always runs there) exposes the Web Crypto API as
// a global, not Node's "node:crypto" module.
const randomUUID = () => crypto.randomUUID();

// Bootstraps anonymous identity for the whole acquisition path. anon_id is
// the PostHog distinct id pre-signup and the RLS key on quiz_results;
// anon_since backs the return_visit event (days since first seen). Neither
// is a secret, so both are ordinary readable cookies — anon_id also travels
// as an x-anon-id header on client-side Supabase reads for RLS to match on.
const TWO_YEARS = 60 * 60 * 24 * 365 * 2;

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const hasAnonId = request.cookies.has("anon_id");

  if (!hasAnonId) {
    const anonId = randomUUID();
    const anonSince = new Date().toISOString();
    response.cookies.set("anon_id", anonId, {
      path: "/",
      maxAge: TWO_YEARS,
      sameSite: "lax",
    });
    response.cookies.set("anon_since", anonSince, {
      path: "/",
      maxAge: TWO_YEARS,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: [
    // Skip static assets and Next internals.
    "/((?!_next/static|_next/image|favicon.ico|fonts/).*)",
  ],
};
