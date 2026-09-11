---
slug: zz-smoke-test
title: The predicted street
motion: "A city should deploy a crime-prediction system that measurably reduces burglaries but concentrates police attention on neighbourhoods that are already heavily policed."
stances:
  stoicism: What is up to the city is whether it treats each resident justly, and that duty does not bend to an aggregate it cannot fully control.
  utilitarianism: Fewer burglaries means less suffering, and a distribution problem is an argument for fixing the distribution rather than refusing the benefit.
  virtue-ethics: Ask what habit the practice trains in the officers who carry it out, because a city can cut crime and still become worse at being a city.
micro_before: zz-smoke-test-before
micro_after: zz-smoke-test-after
sort: 999
active: true
---

# TEMPORARY — SMOKE TEST FIXTURE, NOT LAUNCH CONTENT

Added so the debate path could be exercised before the real motions were
written. Delete this file and the two `zz-smoke-test-*` micro-lessons before
launch, then remove the row:

    delete from debate_topics where slug = 'zz-smoke-test';

`sort: 999` keeps it at the bottom of /debate in the meantime.
