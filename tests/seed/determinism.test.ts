import { describe, expect, it } from "vitest";
import { manifestHash } from "../../scripts/seed/plan";
import { small } from "./fixture";

describe("determinism", () => {
  it("the same seed and window give the same rows, ids and hash", () => {
    const a = small();
    const b = small({ seed: "42" });
    expect(manifestHash(a)).toBe(manifestHash(b));
    expect(a.debates.map((d) => d.rowId)).toEqual(b.debates.map((d) => d.rowId));
  });

  it("a different seed or base window gives a different dataset and ids, and another base window another run", () => {
    expect(manifestHash(small({ seed: "43" }))).not.toBe(manifestHash(small()));
    const later = small({ baseTo: "2026-11-04T13:00:00.000Z", to: "2026-11-04T13:00:00.000Z" });
    expect(later.runId).not.toBe(small().runId);
    // No row id is reused, so a rebuilt plan never collides with the
    // registry rows a torn-down run keeps.
    const before = new Set(small().authUsers.map((u) => u.rowId).concat(small().debates.map((d) => d.rowId)));
    expect(later.authUsers.concat(later.debates as never[]).filter((i: { rowId: string }) => before.has(i.rowId))).toEqual([]);
  });

  it("names runs and addresses as documented", () => {
    const ds = small();
    // From the base window's end alone: no seed in a public id.
    expect(ds.runId).toBe("sample-202611041200");
    expect(ds.runId).toMatch(/^[a-z0-9-]{6,64}$/);
    for (const u of ds.authUsers) expect(u.row.email).toMatch(/^seed\+sample-202611041200-\d+-[a-z0-9]{12}@sophecs\.test$/);
  });
});
