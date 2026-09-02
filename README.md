# Sophecs

Philosophy × AI, taught through allegiance. A diagnostic quiz sorts you into
one of three schools (Stoicism, Utilitarianism, Virtue Ethics), an async
arena makes you defend that school on AI-related motions, and a lessons
library teaches each school from its primary sources.

This repository holds the full routing, data model, components, and design
system, plus the three real content modules (Stoicism on determinism,
Utilitarianism on self-driving cars, Virtue Ethics on RLHF habituation) and
the full ten-question diagnostic.

## Running it

```
npm install
npm run dev
```

No environment variables needed for local work. Without Supabase credentials
the data layer (`src/lib/data`) serves an in-memory mirror of the seed data,
so every screen renders populated and the quiz, forum, and debate flows work
end-to-end. Add credentials from `.env.example` to point at a real project;
`supabase/migrations/0001_init.sql` creates the schema and `npm run seed`
fills it with the same rows the fixtures serve.

## Where things live

- `content/modules/` — one markdown file per module, YAML frontmatter with a
  fixed schema (`id`, `school`, `title`, `quiz_excerpt`, `debate_topics`,
  `sources`), parsed at build time by `src/lib/content.ts`. Content is files,
  not database rows. `debate_topics` entries are `{id, text}` pairs; a
  motion's id matches one of these, and `content.ts#getDebateTopic` is the
  only place that resolves a motion back to its wording, so the text is never
  duplicated into the data layer. Swapping a module file for a new one, or
  adding a fourth, needs no code change as long as the shape holds.
- `src/lib/data/` — the single data access layer. Supabase when configured,
  fixtures otherwise; pages never know which.
- `src/lib/judge.ts` — `judge(submissionA, submissionB, motion)`, currently a
  hardcoded verdict behind a fake delay. A real model call replaces the
  function body and nothing upstream changes.
- `src/lib/elo.ts` — standard Elo, K=24.
- `supabase/` — schema migration with row-level security. Reads are public
  everywhere (lessons and the arena are browsable without an account);
  writes require auth and ownership.

## Design system

Paper and ink; colour is allegiance. The three school colours appear only to
mark a school — a dot, a stripe, an eyebrow label — and the quiz result card
is the single fully-saturated surface in the product. Spectral carries
anything that is an argument, IBM Plex Sans carries the interface, IBM Plex
Mono carries anything measured. Tokens are defined once in
`src/app/globals.css`. No dark mode in v1.

## Stubbed on purpose

AI judging (`judge()` returns a hardcoded verdict) and share-card image
export (button ships disabled). Real-time features, notifications,
moderation, and payments are out of scope entirely. A fourth school is a
data change, not a code change: everything is keyed by `school_id`.
