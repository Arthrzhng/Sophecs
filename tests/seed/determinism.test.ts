import { describe, expect, it } from "vitest";
import { manifestHash } from "../../scripts/seed/plan";
import { small } from "./fixture";

describe("determinism", () => {
  it("the same seed and window give the same rows, ids and hash", () => {
    const a = small();
    const b = small({ seed: 42 });
    expect(manifestHash(a)).toBe(manifestHash(b));
    expect(a.debates.map((d) => d.rowId)).toEqual(b.debates.map((d) => d.rowId));
  });

  it("a different seed or window gives a different dataset and run", () => {
    expect(manifestHash(small({ seed: 43 }))).not.toBe(manifestHash(small()));
    const later = small({ to: "2026-11-04T13:00:00.000Z" });
    expect(later.runId).not.toBe(small().runId);
  });

  it("names runs and addresses as documented", () => {
    const ds = small();
    expect(ds.runId).toBe("sample-42-202611041200");
    expect(ds.runId).toMatch(/^[a-z0-9-]{6,64}$/);
    for (const u of ds.authUsers) expect(u.row.email).toMatch(/^seed\+sample-42-202611041200-\d+@sophecs\.test$/);
  });
});
