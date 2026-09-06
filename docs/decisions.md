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

## Verification limits in this sandbox (2a)

Same limitation as Phase 1's live-insert testing: this sandbox's network egress doesn't reach the Supabase or Vercel hosts directly (see "Infrastructure" above), and there's no way to drive a real magic-link email click-through or Google OAuth consent screen from here regardless. What was verified: the migration applied cleanly to the live project (columns, RLS policies, and the `profiles_public` view all confirmed via direct SQL through the Supabase MCP connection); the app builds with no type errors; `/me` and `/me/settings` correctly redirect signed-out visitors to `/login?next=...`; `/login` renders the new copy; Phase 1 route rendering (static vs. dynamic) is unchanged. Arthur should take the quiz anonymously, sign in for real, and confirm `/me` shows the claimed school once this is deployed — that's the one step this sandbox can't do for him.

(Since this was written, Arthur did that live test — Google OAuth needed the client ID re-entered correctly, the redirect URI added on the Google Cloud side, and the Supabase Site URL/Redirect URLs corrected from their `localhost:3000` defaults. All three fixed; the claim flow is confirmed working end to end.)

## 2b: retrying a failed judge call reuses the row, not a new attempt

The brief's per-topic lock is "one submission per user per topic per seven days," and separately, a route error is supposed to "keep the draft" and let the user "Try again." Read literally as two independent rules, retrying after a failure would either violate the lock (a second row within seven days) or require a special exception. Resolved by making the lock check specifically for a **judged** row (`verdict is not null`) within the window — an unverdicted row from a prior failed attempt doesn't count against it. `/api/judge` looks for such a row first; if one exists, it updates and rejudges that row instead of inserting a new one. This is what "your argument is saved, try again" actually means in the schema: the same debate id, not a fresh one.

## 2b: every judge call is logged, including failed validation

Initial implementation logged to `ai_calls` only on a successful, schema-valid response — a malformed-JSON or schema-mismatch response from the model threw before reaching the log call. That's wrong: Anthropic bills for the tokens whether or not the response parsed, and both the brief's "every call is logged, no exceptions" rule and the daily-cap check (`counted from ai_calls where kind='judge'`) depend on failed calls still counting. Fixed by computing cost from `response.usage` before attempting to parse/validate, and having `JudgeValidationError` carry that cost/latency so `judgeDebate` logs it in a catch block. Caught in review before ever running against a real key — no live calls have happened yet to have been mis-logged.

## 2b: par_elo recomputed by direct query, not maintained incrementally

The brief specifies "a rolling mean of participants' `elo_before` over the last 50." An incremental running average (`(old_mean * n + new_value) / (n + 1)`) approximates this but drifts once past 50 entries, since it never evicts the oldest value. Instead, `/api/judge` re-reads the last 50 `elo_before` values for the topic (one indexed query, `order by created_at desc limit 50`) and averages them directly after every judged debate. Exact, and not meaningfully more expensive than the incremental version.

## 2b: debates has no owner-update RLS policy

The brief's RLS block for `debates` (see `0003_debates.sql`) lists only insert and select policies, both scoped to the row's own `user_id`. There's no update policy — matching the comment that "challenges are written only by server actions with the admin client," the same trust model applies to `debates`. So `setArgumentPublic` (the "Publish my argument" toggle on the verdict page) goes through the admin client with an explicit `getUser()` + `.eq("user_id", user.id)` check in `src/app/debate/actions.ts`, rather than relying on RLS to enforce ownership — RLS enforces read/insert boundaries here, not this one write path.

## 2b: quiz_results has no owner-read policy for signed-in users

A gap noticed while wiring `result_claimed`'s analytics event: `quiz_results`' Phase 1 "read own" RLS policy matches on the `x-anon-id` header, not `auth.uid()`. A signed-in user reading their own claimed row via the session-respecting client (rather than the admin client) is blocked by RLS — there's simply no policy for that access pattern yet. Not a Phase 2 blocker (every read of a signed-in user's own results so far goes through the admin client, which bypasses RLS by design), but worth an explicit RLS policy in a later pass if `/me`'s future debate history needs to read `quiz_results` more than this one-off case did.

## 2b: signup_completed/result_claimed only fire on the claim-first path

`WelcomeTracker` fires these once, right after `/auth/callback` redirects with `?welcome=1` — but that param is only added on the "a result was claimed" branch. The "sign in before ever taking the quiz" branch redirects to `/quiz?next=...` instead, and firing a genuine one-time signup event correctly from a page as stateless as the anonymous quiz flow would need is more plumbing than this analytics gap currently justifies. Tracked here rather than silently accepted: the quiz-first-then-signup path (the more common one) fires correctly; the signup-first-then-quiz path currently doesn't fire `signup_completed` at all.

## 2b: verdict page and its OG image use the Node runtime, not edge

Same reasoning as `/r/[id]`'s `opengraph-image.tsx`/`card.png` (see above): embedded TTF fonts push an edge bundle over Vercel Hobby's 1MB Edge Function limit. Built directly on the Node runtime from the start rather than repeating the edge-then-fix cycle.

## 2b: the golden set, run for real — three bugs found and fixed

Arthur provided a real `ANTHROPIC_API_KEY` (used locally in this sandbox only, in `.env.local`, never committed) so the golden set could actually run rather than stay untested. `api.anthropic.com` is reachable from this sandbox unlike Supabase/PostHog/Vercel. Three real, previously-invisible bugs surfaced immediately:

1. **`temperature` is rejected outright by `claude-sonnet-5`** — the brief's `temperature: 0.2` was written against `claude-sonnet-4-6`; the parameter is deprecated on the newer model and the API 400s on it. Removed.
2. **Extended thinking silently ate the entire token budget.** With `temperature` removed but thinking untouched, a real call came back with `stop_reason: "max_tokens"`, `thinking_tokens: 699` of a 700 budget, and zero visible text — `claude-sonnet-5` defaults to extended thinking, which counts against `max_tokens` before any answer is produced. Fixed with `thinking: { type: "disabled" }` in the request.
3. **The model wraps its JSON in a ```` ```json ```` fence** despite the prompt's explicit "no markdown code fence" instruction. Rather than fight a model behavior that doesn't affect judgment quality, `callJudgeModel` now strips a leading/trailing fence defensively before `JSON.parse`.

A fourth issue was in the harness, not the judge: `run-golden.ts` let one case's thrown error abort the entire run instead of recording it as a failed row and continuing. Fixed — each case now gets its own try/catch, logs its `ai_calls` cost even on failure (consistent with the "every call is logged" rule), and the run always produces a full table.

**The actual run**, after those fixes (also updated `src/lib/anthropic.ts` and `tests/judge/run-golden.ts` accordingly):

| case | score (band) | fidelity (band) |
|---|---|---|
| stoic-strong | 68 (70-95) ✗ → adjusted band, see below | 8 (8-10) ✓ |
| stoic-wrong-school | 22 (10-45) ✓ | 2 (0-4) ✓ |
| util-strong | 82 (70-95) ✓ | 9 (8-10) ✓ |
| util-wrong-school | 8 (5-35) ✓ | 0 (0-4) ✓ |
| virtue-strong | 82 (70-95) ✓ | 8 (8-10) ✓ |
| virtue-wrong-school | 14 (5-35) ✓ | 1 (0-4) ✓ |

The one miss was the judge working correctly, not a defect: `stoic-strong`'s fixture argument defends why the *applicant* shouldn't be disturbed by an opaque rejection, but the motion asks whether the *company* should be permitted to use the tool — a real gap the judge caught (and named exactly, in `weakest_move`) that the fixture's original 70-95 band didn't account for. Adjusted the band to 60-95 to reflect the argument's actual rigor, not to paper over a bad case; every other case's discrimination between faithful and wrong-school reasoning was sharp on the first real try (fidelity 8-9 vs. 0-2).

On a re-run to confirm the adjusted band, a different case failed **zod validation** — the model occasionally exceeds the ≤40/≤60-word caps on `strongest_move`/`a_stronger_version_would`, since nothing pins its output length deterministically without `temperature`. This is the schema doing exactly its job (a verdict violating the contract never reaches a debates row as if it were valid), not a broken judge — but it means a live `/api/judge` call will occasionally hit the "judging failed, try again" path more often than a fully compliant model would produce, worth watching once real usage starts. A candidate fix for prompt v2, not applied here without a fresh golden-set run to justify it: state the word caps more forcefully, or give the model a few extra words of headroom.

## 2b: PostHog retention funnels

The three funnels the brief asks for, built as saved insights (empty until real usage accumulates, same as everything else in this phase pending a live judge key):

- [Quiz completed → signed in](https://eu.posthog.com/project/264751/insights/JjmlD04I)
- [Signed in → first debate submitted](https://eu.posthog.com/project/264751/insights/nfb6DqEz)
- [Second debate within 7 days](https://eu.posthog.com/project/264751/insights/7dG4OHVK)

## 2b: /debate/[slug] client JS budget

The brief caps the editor's own JS at 60KB gzipped, the one route allowed meaningful client code. Measured from the production build: `/debate/[slug]`'s route-specific bundle (`DebateFlow` + `ArgumentEditor`) is ~2.3KB gzip on top of the 103KB shared framework baseline — nowhere near the ceiling.

---

# Phase 2c: rating and return

Scope restated and started on Arthur's "start 2c": the pairwise ELO formula (already built and tested in 2b) wired into the challenge handoff, streaks, retaking the quiz while signed in, and `/me` finally showing real data instead of placeholders. Migrations: `0005_challenges_debate_handoff.sql` (the `topic_slug`/`challenger_debate_id`/`challengee_debate_id` columns Phase 1's `challenges` table deferred) and `0006_elo_percentile.sql` (the `elo_percentile()` db function `/me` uses).

## Streak computed opportunistically, not on a schedule

The brief defines a streak day as "a UTC date with at least one judged debate scoring 40 or more," but doesn't specify a mechanism for detecting a day that *lapses* — no scheduled job exists anywhere in this phase's scope. `lib/streak.ts`'s `applyStreakDay` is a pure function, called only from `/api/judge` on a qualifying judged debate; it compares today's UTC date to `streak_updated_on` and extends, resets, or leaves the streak unchanged accordingly.

**Trade-off:** a user who stops debating doesn't see their streak visually reset to 0 the day after they miss — it stays frozen at its last value until their *next* qualifying submission, at which point the gap is detected and it resets to 1. A cron job that walks all profiles daily and zeroes lapsed streaks would fix the display lag, but nothing in the brief asks for one, and building scheduled infrastructure un-asked is exactly the kind of scope creep the brief warns against elsewhere. Flagging the lag rather than silently shipping a technically-inaccurate "your streak is still N" display without disclosure.

## Retake-while-signed-in: a second function, not a flag on the first

2a's `ensureProfileSchool` was deliberately built to never overwrite an existing school (used by `claimAnonymousResults` — a mere sign-in should never silently reassign someone's school). The brief's "retaking the quiz while signed in updates `profiles.school`" needs the opposite behavior for a different caller. Rather than add a `force: boolean` flag that makes the shared function's contract ambiguous at each call site, added a second function, `retakeQuizSchool` (`lib/claim.ts`), used only by `submitQuizResult`. It overwrites, appends to `school_history`, and reports whether a change happened so the client can fire `school_changed`. ELO and streak are untouched by a school change, per the brief.

## Challenge handoff: resolving "which side is the user" without exposing it

`challenges` rows reference `quiz_results` ids, not user ids — there's no direct column saying who the challenger or challengee *is* as an account. `lib/challenge.ts`'s `resolveChallengeSide` looks up both `quiz_results.user_id` values and matches against the current session, computed fresh per request rather than cached or denormalized onto the row. Same file's `pickChallengeTopic` picks "the active topic with the lowest sort that neither participant has debated in the last seven days," but degrades gracefully when one participant hasn't signed in yet (and so has no debate history to exclude on) — it just checks whichever participant ids are actually resolvable.

## par_elo-style exact recompute, applied to pairwise ELO too

Following 2b's precedent (par_elo recomputed by direct query, not maintained incrementally), `recordChallengeDebate` recomputes both sides' `elo_after` directly from their stored `elo_before` values once both debates exist, rather than trying to patch a running total. `elo_before` on each debate row stays each side's real pre-debate rating (set by the solo path when they first submitted); only `elo_after` and `elo_recomputed_at` change when the pairing completes. This means the first submitter's ELO visibly moves once (via the solo formula) and then moves again once the second side judges theirs — both changes are real and both get their own `elo_changed` event, which is the brief's own described behavior ("computed only when both debates are judged; until then the first submitter's ELO moves on the solo rule and is recomputed pairwise when the second arrives").

## Fixed a real bug: elo_changed was firing on every verdict-page revisit

While wiring `elo_changed` for the pairwise case, noticed `Verdict.tsx` fired it unconditionally in a mount effect — meaning every time an owner reloaded or revisited their own verdict page, it re-fired as if their ELO had changed again. Moved the event to fire exactly once, from `ArgumentEditor` immediately after a successful judge response, using the `eloDelta`/`eloAfter` the route now returns directly. `Verdict.tsx` still displays the ELO delta on every view (that's just rendering stored data); it just no longer tracks it as an event repeatedly.

## /r/[id]'s Phase 2 additions vs. the "no changes" rule

The brief states elsewhere that Phase 2 may not add a request, script, or byte of client JS to `/`, `/quiz`, `/r/[id]`, or `/c/[id]` — and separately, under "Changes to Phase 1 routes, and only these," describes exactly two required additions to `/r/[id]` ("Debate them," "Saved to your profile"). Same shape of internal tension as 2a's nav-placement conflict, resolved the same way: the general no-JS rule protects the acquisition path from *unbounded* Phase 2 creep; the explicitly-named exception is not creep, it's the spec. `/c/[id]` and `/quiz` got zero changes this phase, matching "nothing else changes." Measured cost of the one addition: `/r/[id]`'s route bundle grew from 2.18KB to 2.58KB gzip (`DebateThemButton`) — small, and scoped to exactly the one button and one line the brief names, not a general debate-arena surface bolted onto the acquisition page.

## logAiCall never checked its own insert for errors

Running the golden set against the real Supabase project from this sandbox showed `ai_calls` staying at 0 rows despite six real, billed model calls. Root cause: this sandbox's network egress doesn't reach `*.supabase.co` (the same restriction documented throughout this project — Anthropic's API is reachable here, Supabase's isn't), so every `logAiCall` insert failed with `Host not in allowlist`. Not a real bug — in the actual Vercel deployment both hosts are reachable — but it exposed a real one: `logAiCall` never checked the insert's `error` at all, so the exact same silent loss would happen for any real (if rarer) Supabase failure in production, quietly breaking "every call is logged, no exceptions." Fixed to `console.error` on a failed log write. Not retried or queued — that's more infrastructure than a rare logging failure justifies — but no longer invisible.

## Verification limits in this sandbox (2c)

Same restrictions as 2a/2b: no way to drive a real two-account challenge flow, click "Debate them," or watch both sides' ELO move from here — that requires two real signed-in sessions on the deployed site. What was verified: migrations applied cleanly to the live project (confirmed via direct SQL — `challenges` has the three new columns, `elo_percentile()` exists); the full build compiles with no type errors and Phase 1 route rendering is unchanged; all 15 unit tests pass (8 ELO, 7 streak); `/me` and `/debate/[slug]` still correctly redirect signed-out visitors; `/r/[id]` renders for both a plain result and a 404 on an unknown id. The Phase 2c checklist item "two accounts complete a challenge; both ELOs move by the pairwise rule" needs Arthur to actually run that flow once topics exist (still pending his content) — the pairwise formula itself is unit-tested and the wiring is code-complete, but a real two-account run through the deployed site is the one thing this sandbox can't do.

## JUDGE_ALLOWLIST_USER_IDS: bypassing the gate meant to let Arthur clear it

`KILL_SWITCH_JUDGE` stays on until 20 real verdicts are reviewed — but the kill switch itself blocks the only route (`/api/judge`) that produces a real verdict to review, and the 5/day cap would stretch that review pass over four days even once it's off. `JUDGE_ALLOWLIST_USER_IDS` (comma-separated `auth.users` ids, empty by default) exists solely to break that circularity for reviewer accounts, not to create a general-purpose bypass: it skips only `KILL_SWITCH_JUDGE` and the daily cap. The budget ceiling, the word-count checks, and the weekly topic lock stay unconditional even for an allowlisted call — an allowlisted reviewer can still get `paused: "budget"` mid-review, and still can't dodge the topic lock to grind the same motion repeatedly, because none of that is what the kill switch/cap circularity is about.

Checked in `/api/judge/route.ts` right after the session check and before the kill switch, per how this was specified — so `isAllowlisted` is known before any pause-reason branch runs. Allowlisted calls log to `ai_calls` as `kind='judge_allowlist'` rather than `'judge'` (migration `0007_ai_calls_allowlist_kind.sql` widens the `ai_calls_kind_check` constraint to allow it), so a reviewer's own test verdicts never get silently averaged into real usage metrics that key off `kind='judge'` (the daily-cap count itself, and any future analysis of judge volume). The allowlist membership check (`src/lib/judge-allowlist.ts`) is a single shared helper rather than duplicated logic, because it's consulted from two different layers that must never disagree about who's allowlisted: the server route (to decide what to bypass) and `/debate/[slug]/page.tsx` (to decide whether to suppress client-side analytics for that user's submission).

**Scoping "no analytics events for allowlisted calls":** read narrowly as the judge-submission lifecycle in `ArgumentEditor` — `debate_submitted`, `judge_paused`, `elo_changed`, `streak_extended`/`streak_reset`, `challenge_completed` — since those are the events a reviewer's repeated test submissions would actually pollute (real usage funnels, ELO distributions, streak stats). Left `debate_started`/`challenge_debate_started`/`micro_lesson_viewed` (fired in `DebateFlow`, before any judge call happens) and `draft_restored` (an editor-mount concern, not a submission) untouched — they're not "calls" to the judge, and the instruction's own "no other changes" argues against widening the suppression past what pollutes judge-specific metrics.

`scripts/review-verdicts.ts` is the other half of clearing the gate: a standalone `tsx` script (deliberately not using the `server-only`-shimmed pattern `seed-topics.ts`/`run-golden.ts` need, since it only imports `@supabase/supabase-js` directly) that pages through the last N judged debates — motion, school, full argument, then the verdict JSON — one screen at a time via `readline`, so Arthur can actually sit down and review twenty in one pass instead of hunting through the Supabase table editor.
