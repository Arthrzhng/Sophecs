// A small dataset, generated once per test file: the same generator and
// banks as a production run, at a size a test can afford.
import { generate, type Dataset, type GenConfig } from "../../scripts/seed/generate";
import { loadBanks } from "../../scripts/seed/banks";
import { contentTopics } from "../../scripts/seed/topics";
import { buildPlan, type Plan } from "../../scripts/seed/plan";

export const SMALL: Omit<GenConfig, "topics"> = {
  seed: "42",
  from: "2026-09-18T00:00:00.000Z",
  baseTo: "2026-11-04T12:00:00.000Z",
  to: "2026-11-04T12:00:00.000Z",
  users: 600,
  anonResults: 900,
  challenges: 60,
  exchanges: 80,
  classes: 3,
};

let cached: Dataset | null = null;
export function small(over: Partial<GenConfig> = {}): Dataset {
  if (Object.keys(over).length) return generate({ ...SMALL, topics: contentTopics(), ...over }, loadBanks());
  cached ??= generate({ ...SMALL, topics: contentTopics() }, loadBanks());
  return cached;
}

export function smallPlan(over: Partial<GenConfig> = {}): { plan: Plan; dataset: Dataset } {
  return buildPlan({
    target: { kind: "local", database: "sophecs_test" },
    planPath: "unused.json",
    gen: { ...SMALL, topics: contentTopics(), ...over },
  });
}
