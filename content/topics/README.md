# Debate topics

One `.md` file per topic, six at launch. Frontmatter only (no body needed —
matches the convention in `content/schools/`). Full schema and worked
example in `docs/phase2-brief.md` under "Content schemas," reproduced here:

```yaml
slug: opaque-benefit
title: The opaque benefit
motion: "An AI system that reliably reduces suffering should be deployed even where nobody can explain its decisions."
stances:
  stoicism: one sentence, the position a Stoic would most likely defend
  utilitarianism: ...
  virtue-ethics: ...
micro_before: opaque-benefit-before
micro_after: opaque-benefit-after
sort: 1
active: true
```

`micro_before`/`micro_after` are slugs of files in `content/micro/`, not
markdown bodies here — the motion and stances live in this file, the
lesson text lives there.

After adding or editing a file here, run `npm run seed:topics` to upsert it
into `debate_topics`. Content edits never need a migration.
