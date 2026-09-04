# Decisions

Every trade-off raised during the build, and how it was resolved. Newest first isn't enforced — this is written in the order things came up.

## Design source (no mockup)

`docs/mockup.html` and `docs/content-schema.md` were referenced in the brief but never provided, and Arthur said to proceed without them. Design tokens (`paper`, `ink`, `stoic`, `utilitarian`, `virtue`) are the exact hex values already designed for this product earlier in this build session, which satisfy the brief's own description (cool greyed paper, near-black ink, tribal-marker school colours) — not invented fresh. If a real mockup shows up later, it wins on visuals per the brief's own rule.

**Trade-off:** ship without a visual reference vs. block on one. Leaning ship — Arthur explicitly said to proceed, and the brief's written design-system section is specific enough to build from.

## Tailwind config format

The brief asks for named tokens in `tailwind.config.ts`, which is Tailwind v3's mechanism. This build uses Tailwind v4, whose idiomatic equivalent is CSS-first `@theme` tokens in `globals.css` — same contract (named design tokens, one canonical source), current major version. Used `@theme` instead of reintroducing a v3-style JS config.

## Dark mode: Sophecs brief vs. the vibe-coded-avoidance doc

Direct conflict between the two documents Arthur asked me to follow. The vibe-coded-avoidance doc requires a real dark mode. The Sophecs brief explicitly lists dark mode under "Explicitly NOT in Phase 1" ("If you find yourself building a `User` model, stop" — same rigor applies here) and says the mockup/brief win on behaviour.

**Resolution:** no dark mode in Phase 1. The product-specific, phase-scoped brief is authoritative over a general-purpose style rule when the two disagree on scope. Every other rule in the vibe-coded doc (color restraint, no icon circles, no gradient buttons, left-aligned body copy, radius hierarchy, tinted borders/shadows, real focus states, consistent spacing scale) is followed throughout.

## Auth in Phase 1

The brief explicitly scopes Phase 1 as anonymous-only ("Explicitly NOT in Phase 1: auth... If you find yourself building a `User` model, stop"; "Auth friction vs retention: no auth until Phase 2" under Named Tensions). Arthur's first answer to the confirm-before-code question was to add auth in Phase 1 anyway — flagged back per "ask before adding scope," since this reopens something the brief resolves explicitly. Arthur's follow-up: wire Supabase auth (magic link + Google) and a `profiles` table now, but keep the quiz-to-share loop anonymous by default with no gate.

**Resolution:** `/login` and `/auth/callback` work and a minimal `profiles` table exists (id, handle, display_name — no `elo`/`streak`/`school`, which have no meaning without Phase 2's debates). Nothing on `/quiz`, `/quiz/result`, or `/r/[id]` references or requires auth. `/auth/callback` redirects to `/` rather than `/me`, since `/me` is Phase 2 and doesn't exist yet.

## Quiz question count: 9 vs. 10

The brief assumes Arthur supplies 9 questions. The content actually available (given earlier in this same build session) is 10, already written and structured. Cutting one arbitrarily to hit the assumed count would be worse than using what's real.

**Resolution:** kept all 10. The brief's tie-break instruction ("question 9... written as the sharpest discriminator") is adapted to question 10 — the last question, written with the least-ambiguous options — since it plays the same structural role either way.

## `challenges` table: Phase 1 or Phase 2

The brief's own SQL groups `challenges` under a `-- Phase 2` comment, but its prose is unambiguous: "Phase 1 creates the row with only `challenger_result_id`; the table ships in Phase 1 for this reason." That's an internal inconsistency in the brief itself.

**Resolution:** followed the prose. `challenges` ships in the Phase 1 migration with only the columns Phase 1 needs (`id`, `challenger_result_id`, `challengee_result_id`, `status`, `created_at`). `topic_slug` and the `challenger_debate_id`/`challengee_debate_id` columns — which reference `debate_topics`/`debates`, tables that don't exist yet — arrive via `ALTER TABLE` in the Phase 2 migration.

## Font hosting

Self-hosted via `next/font/local` as specified, Latin subset, `display: swap`. Sourced the actual `.woff2` files once from Google Fonts' CDN (requesting the CSS2 API with a modern UA to get woff2 rather than ttf, then pulling only the `latin` unicode-range file per weight) into `public/fonts/`.

Along the way: IBM Plex Sans turned out to be served as a single variable-font binary by Google — the CSS2 API returns the byte-identical file for `wght=400`, `500`, and `600`. Rather than store three duplicate files, it's loaded as one file (`plex-sans-var.woff2`) with a `400 600` weight range. Spectral and IBM Plex Mono are genuinely static per-weight files and are loaded that way.

## School quote duplication (OG image is edge runtime)

The OG image (`opengraph-image.tsx`) and the portrait card route (`card.png/route.ts`) run on the edge runtime for cold-start speed, per the brief. Edge has no `fs`, so they can't use the markdown-frontmatter loader (`src/lib/schools.ts`) that the Node-runtime pages (`/s/[school]`, `/r/[id]`) use. The two short fields the card actually needs — `one_line` and its attribution — are mirrored by hand in `src/lib/school-quotes.ts`.

**Trade-off:** a small, deliberate duplication vs. adding a build step to generate an edge-safe content bundle from the markdown. Leaning duplication — it's two short sentences per school, unlikely to change often, and a generated-JSON build step is more machinery than three quotes justify right now. Flagged here so it doesn't quietly drift if the quotes are ever edited.

## PostHog credentials

No `NEXT_PUBLIC_POSTHOG_KEY` exists in this environment. `track()` (client) and `trackServer()` (server) both no-op safely without one — console-warn in development, silent in production — the same pattern used for Supabase elsewhere in this build when credentials are absent. This means the Phase 1 "done when" criterion "all twelve Phase 1 events fire... verified in PostHog from production" cannot be satisfied until real EU-cloud PostHog project keys are added to the Vercel environment. The event wiring itself is complete and typed; it just has nowhere to send data yet.

## Debate judge model (Phase 2, not yet built)

The brief names `claude-sonnet-4-6` for judging and `claude-haiku-4-5-20251001` for cheaper calls. Checked against current model pricing: `claude-sonnet-4-6` is real ($3/$15 per 1M tokens) but `claude-sonnet-5` is newer, cheaper, and stronger ($2/$10 per 1M) — recommended as the actual Phase 2 pick pending Arthur's confirmation. `claude-haiku-4-5-20251001` has a stale date suffix; the correct current id is `claude-haiku-4-5`. Monthly spend ceiling still needs a number from Arthur — not a Phase 1 blocker, since Phase 1 ships with no Anthropic key in the environment at all.

## Lesson content (Phase 3)

Arthur confirmed the three lesson modules are still being written. Per the brief ("Phase 3 is blocked on content and you should say so rather than stubbing it"), no `/learn` routes or module content were built this pass.

## The 90KB /quiz JS budget vs. Next.js + React's own runtime cost

Measured directly from the production build (`gzip -c` on the actual chunk files, not an estimate): `/quiz` ships ~103-107KB gzip of JS to a modern browser, and roughly 98KB of that is React 19 + Next.js 15's own framework runtime (`framework.js` ~59.7KB gzip, `main-app`/`main` ~37KB gzip, plus a small webpack runtime) — before any of this app's own code. The actual application code for the quiz (`QuizShell`, `Question`, `lib/scoring.ts`, the analytics wrapper) adds only a few KB on top; `posthog-js` was the one real offender and is now dynamically imported after first paint instead of bundled into the initial chunk, which took `/quiz` from 195KB down to ~107KB.

**This does not currently meet the brief's 90KB ceiling, and I don't think it can while staying on the mandated Next.js App Router + React 19 stack** — the framework baseline alone is already at the limit. Getting under 90KB would mean dropping React/Next.js for this one route (a hand-rolled vanilla-JS page), which is a real architectural call, not a code-quality fix, and wasn't something I was asked to do. Flagging rather than either claiming a false pass or unilaterally ejecting from the stack for one page. **Trade-off: hit the literal number vs. stay on-stack and report the real one — leaning stay-on-stack. Say stop if a frameworkless `/quiz` is actually wanted.**

## Infrastructure

A real Supabase project ("sophecs", `eu-west-1`, free tier) was created under Arthur's account after asking first — there was an existing project literally named "Philosophy learning" but it wasn't repurposed without confirmation, per Arthur's answer to create a fresh one instead. The Phase 1 migration is applied there. The RLS anon-isolation test from the Phase 1 checklist was run for real against it: two `quiz_results` rows were inserted under different `anon_id`s, then a session was set to the `anon` role with `request.headers` simulating `x-anon-id` for the first id — `select id, anon_id, answers from quiz_results where id = '<the other row>'` returned `[]`. RLS holds. Test rows were deleted afterward.

A real PostHog project also exists now — Arthur created a "Sophecs" organization with a default project on EU cloud, found via the PostHog MCP connector (`organizations-list` → `switch-organization` → `projects-get`, since the connector's default context pointed at an unrelated "Rong AI" project first). Its token is wired into local env.

Neither host is reachable from *this session's* own network calls, though — this sandbox's outbound proxy only allowlists a fixed set of destinations, and a freshly created Supabase project's subdomain and `eu.i.posthog.com` are both outside it (`curl` to either returns a proxy-level `connect_rejected`, confirmed via `/root/.ccr/README.md`, which is explicit that a blocked host gets reported, not routed around). This is why the Supabase RLS test above was run through the Supabase MCP tools (a separate, allowlisted channel) rather than through the app's own server action, and why the full "submit quiz → insert succeeds → redirect to /r/[id]" path and live PostHog event delivery couldn't be exercised end-to-end locally, even with real credentials in `.env.local`. Neither is a code problem — the same request will reach both hosts fine once this app is actually deployed (Vercel isn't behind this sandbox's proxy).

No Vercel production deployment exists yet — an attempt to create one via the Vercel API hit a 403 both times it was tried (the GitHub repo isn't connected to Vercel on Arthur's account), so Lighthouse numbers for `/`, `/quiz`, `/r/[id]` haven't been measured against a real deployment. `.env.example` documents what a deployment needs; the actual credentials were shared with Arthur directly rather than committed anywhere.

## OG image / card.png: edge runtime hit Vercel's Hobby Edge Function size limit

`opengraph-image.tsx` and `card.png/route.tsx` were built on the edge runtime for cold-start speed, per the brief (see "School quote duplication" above). In a real deployment attempt, `card.png` failed to deploy: `The Edge Function "r/[id]/card.png" size is 1.07 MB and your plan size limit is 1 MB.` The three embedded TTF fonts (~500KB combined) plus the edge runtime's own overhead push it over. `opengraph-image.tsx` shares the same fonts and was very likely one page-weight away from the same failure.

**Resolution:** dropped both routes to the default Node.js runtime (Vercel's Hobby serverless functions cap at 50MB, no practical risk at this size). Font loading changed accordingly — edge's `fetch(new URL(..., import.meta.url))` pattern doesn't work under Node; switched to `readFile(join(process.cwd(), "src/assets/og-fonts/..."))`. Verified locally against the production build: both routes return 200 with correctly-sized, correctly-rendered PNGs (1200×630 and 1080×1350). Cold-start latency is the trade-off — worth it over a route that doesn't deploy at all on the plan actually in use.

## Vercel project not connected to the pushed branch

Arthur's live deployment (`sophecs1.vercel.app`, then a retry) showed zero Supabase rows and zero PostHog events despite confirmed use of the site. Root cause, confirmed by reading the deployment's own build logs: the Vercel project was not building from `Arthrzhng/Sophecs` on `claude/sophecs-skeleton-0zvs5m` (where every commit in this build actually lands — confirmed via `git ls-remote --heads origin`, which lists only that one branch). The first attempt built from a `main` branch that doesn't exist on that repo at all, serving a stale snapshot matching the very first commit of this session. The second attempt built from a different, separate repo (`Arthrzhng/sophecs2`, a single "Initial commit" on `main`) — current in content, but discononnected from future pushes here.

**Resolution:** not a code fix — flagged to Arthur with exact steps to re-import `Arthrzhng/Sophecs` (the real repo) on branch `claude/sophecs-skeleton-0zvs5m` via Vercel's "Import Git Repository" flow, explicitly avoiding any "create new repo" / template-deploy path that snapshots local files into a fresh, disconnected repo.

---

# Phase 2

The Phase 2 brief is saved in full at `docs/phase2-brief.md` (pasted 2026-09-04), the same way this file has referenced the Phase 1 brief throughout. Confirmations below are answers to that document's own "Confirm before writing code" section.

## Confirmations (Phase 2 "confirm before writing code")

- **Debate topics & micro-lessons:** Arthur is writing these himself. `/debate` stays a plain "still developing" page — same discipline as Phase 1's unfinished lesson modules — until `content/topics/*.md` and `content/micro/*.md` exist. 2a does not depend on this content at all.
- **Judge rubric:** Arthur asked me to draft the school-fidelity criteria. Not yet written — comes with 2b, alongside `content/prompts/judge.v1.md`. The judge stays behind `KILL_SWITCH_JUDGE` regardless until Arthur has reviewed 20 real verdicts, per the brief.
- **Judge model:** `claude-sonnet-5`, not the brief's assumed `claude-sonnet-4-6` — same reasoning as the Phase 1 debate-judge-model note above (newer, cheaper at $2/$10 per 1M vs $3/$15, stronger). Arthur confirmed.
- **`AI_MONTHLY_BUDGET_USD`:** set to **50**. At sonnet-5 pricing and the brief's own token estimate (1600 in / 500 out per judge call ≈ $0.0082/call), $50 covers roughly 6,000 judged debates a month — comfortably above what an early-launch retention test needs, while still being a real ceiling `lib/budget.ts` enforces (2b). Arthur said "something reasonable"; this is the number and the math behind it.
- **Google OAuth:** client ID provided (`542875988819-...apps.googleusercontent.com`). The client **secret** is still needed, and — separately — enabling the Google provider itself (pasting both into Supabase Dashboard → Authentication → Providers → Google) is a manual step: no tool in this environment can configure Supabase Auth providers, only the database. Magic link works today; Google will work once both are done.
- **Public arguments, streak timezone, opponent steelman:** proceeding on the brief's own stated defaults (private-by-default with per-debate opt-in; UTC, stated in the UI; no steelman this phase) — nothing surfaced that argues against them.

## profiles migration bundles every Phase 2 column in one pass

The brief names exactly three new Phase 2 migration files (`0002_profiles`, `0003_debates`, `0004_ai_calls`) and gives no second profiles migration. `elo`, `streak`, and `streak_updated_on` aren't used until 2c, but there's nowhere else in the brief's plan for them to land, so `0002_profiles.sql` adds them now alongside `school` (needed immediately by 2a's claim flow), `argument_default_public`, `school_history`, and `tz`.

## profiles RLS tightened to match the brief's own design

Phase 1's `profiles` had a `"public read"` policy (`using (true)`) — harmless when the only columns were `handle`/`display_name`, but this migration adds `tz`, `argument_default_public`, and `school_history`, which the brief doesn't intend as public. The brief's own migration comment says it directly: "expose only handle, display_name, school, elo, streak via a view `profiles_public`; the table policy exists so `/me` can read own full row." That sentence only makes sense if the table policy is owner-only, so `"public read"` was dropped and replaced with `"profiles read own"` (`auth.uid() = id`); `profiles_public` was added as a view, read only through the admin client server-side — the exact pattern Phase 1 established for `quiz_results`/`public_results` (see "Infrastructure" above).

Supabase's security advisor flags both `public_results` and the new `profiles_public` as `SECURITY DEFINER` views (ERROR level). Not a new issue introduced here — it's the same accepted Phase 1 pattern on a second view: both are only ever queried through the admin client (service-role key), which bypasses RLS regardless of the view's definer, and neither is exposed to `anon`/`authenticated` PostgREST access directly. Flagged here for visibility rather than "fixed" by adding `security_invoker`, which hasn't been tested against the existing admin-client read path.

## Nav placement: not in the root layout

The brief says `layout.tsx` gains "Debate" and "Me," "rendered server-side from the session." Taken literally, that means a `cookies()`/session read in `layout.tsx` — but that file wraps every route, including `/`, `/quiz`, `/r/[id]`, `/c/[id]`, and the same brief states elsewhere: "Nothing in Phase 2 may add a network request, a script, or a byte of client JS to `/`, `/quiz`, `/r/[id]` or `/c/[id]`" and "Phase 1 Lighthouse numbers unchanged." A session read in the root layout would force those routes from static (`○`) to dynamic (`ƒ`) rendering — a real regression the brief itself forbids elsewhere, more strongly worded than the nav-placement instruction.

**Resolution:** `SiteNav` (`src/components/nav/SiteNav.tsx`) is a session-aware server component, but it's only rendered from `src/app/me/layout.tsx` and `src/app/debate/layout.tsx` — new Phase 2 routes that are already dynamic. `layout.tsx` (root) is untouched. Verified via `next build` output: `/`, `/quiz`, `/s/[school]` still render `○`/`●` (static/SSG), unchanged from before this phase; `/me`, `/me/settings`, `/debate`, `/login` render `ƒ` (dynamic), as they must to read the session.

## New design token: oxblood

The brief names "oxblood" for the debate editor's word-count-limit warning (2b) without a hex value. Added `--color-oxblood: #6b1414` to `globals.css`'s `@theme` block (9.9:1 contrast on paper) — deliberately not reused from `--color-virtue` (a similar but more purple maroon) so a warning state never visually reads as the virtue-ethics tribal marker. Also used now for the one destructive action 2a ships: "Delete account" on `/me/settings`.

## Claiming: what 2a covers, what's deferred to 2c

`lib/claim.ts` covers both directions the brief describes: sign in after taking the quiz (`claimAnonymousResults`, run from `/auth/callback` — attaches every anon-cookie-matched `quiz_results` row, creates the profile with its school) and sign in before taking the quiz (`submitQuizResult` in `src/app/actions.ts` now checks for a session and, if present, sets `user_id` on the insert directly and backfills the profile's school via the same shared `ensureProfileSchool` helper — no separate claim step needed).

Not built in 2a, deferred to 2c: **"retaking the quiz while signed in updates `profiles.school` and fires `school_changed`."** `ensureProfileSchool` intentionally never overwrites an existing school. This is coupled to "ELO does not reset" and to `school_history`, both of which only mean something once ELO exists (2c) — building the write path now without the ELO context to test it against would be guessing at behavior the brief specifies precisely. `/quiz` and `submitQuizResult` already carry a `next` param end to end (stored, unused) so 2c can wire the redirect without re-threading it.

The `?next=` redirect after quiz completion (brief: "no result exists → `/quiz?next=/debate`") also isn't acted on post-submission yet: `/debate` is a "still developing" stub, and sending a first-time quiz-taker straight to a stub page is worse than showing them their result card as normal. The banner ("Take the quiz first. Your school is your side.") and the parameter threading are both live; the terminal redirect activates once `/debate` is real.

## Verification limits in this sandbox

Same limitation as Phase 1's live-insert testing: this sandbox's network egress doesn't reach the Supabase or Vercel hosts directly (see "Infrastructure" above), and there's no way to drive a real magic-link email click-through or Google OAuth consent screen from here regardless. What was verified: the migration applied cleanly to the live project (columns, RLS policies, and the `profiles_public` view all confirmed via direct SQL through the Supabase MCP connection); the app builds with no type errors; `/me` and `/me/settings` correctly redirect signed-out visitors to `/login?next=...`; `/login` renders the new copy; Phase 1 route rendering (static vs. dynamic) is unchanged. Arthur should take the quiz anonymously, sign in for real, and confirm `/me` shows the claimed school once this is deployed — that's the one step this sandbox can't do for him.
