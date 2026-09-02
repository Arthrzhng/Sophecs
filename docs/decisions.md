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

## Infrastructure not yet live

As of this pass: no Supabase project has real data seeded through it from a production deployment, no PostHog project is connected, and no Vercel production deployment exists yet to run Lighthouse against. The code path is written and locally verified (build passes, routes render); see the build report for what's been checked directly versus what still needs a live deploy to confirm (the RLS anon-isolation test, the twelve PostHog events firing from production, and the three Lighthouse scores).
