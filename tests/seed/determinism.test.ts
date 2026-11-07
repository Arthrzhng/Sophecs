import { describe, expect, it } from "vitest";
import { baseHash, manifestHash } from "../../scripts/seed/plan";
import { contentTopics } from "../../scripts/seed/topics";
import { SMALL, small } from "./fixture";

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

  // A live run regenerates every row it has written from this code, and
  // halts at its spot checks if one comes out different
  // (docs/sample-activity.md, Limits). These are the datasets main gave on
  // 2026-11-07 at 3008b29, before the launch's banks were added, for the
  // base window and for ten days of extension after it. A change that
  // moves either changes rows a live run has written.
  it("gives exactly the rows it gave before the launch's three schools had banks", () => {
    expect(manifestHash(small())).toBe("ef4b310bd06ad50b79eb75a0a26522d1877701eab938d86cd59211ee2b20ab32");
    expect(manifestHash(small({ to: "2026-11-14T12:00:00.000Z" }))).toBe(
      "abac62e4b39ca5b9027bb3445af9d4c585f6e846037d3aac44f749a4c53665e9"
    );
  });

  // The fresh run at the launch is made with quiz v2, and once it is live it
  // regenerates its rows from this code just as the run before it does.
  // Its datasets, as this code first made them (Gate 4 item 13, second
  // part), for the base window and ten days on, and its base hash.
  it("gives a quiz v2 run exactly the rows it gave when it was written", () => {
    expect(manifestHash(small({ quiz: 2 }))).toBe("21397274e160d7bb39af964c7e950a6073ff5b398285cd5163c7f448c08cd6c4");
    expect(manifestHash(small({ quiz: 2, to: "2026-11-14T12:00:00.000Z" }))).toBe(
      "1a232cf9cc44bd8f514fc1bc11ba236b2ff305650be3508a86199f76b0185ffe"
    );
    expect(baseHash({ ...SMALL, quiz: 2, topics: contentTopics() })).toBe("5cdeac90c6bfadb49435f35b4688ee717ed990b7b3d409dd8ef3c600e1255824");
  });

  it("names runs and addresses as documented", () => {
    const ds = small();
    // From the base window's end alone: no seed in a public id.
    expect(ds.runId).toBe("sample-202611041200");
    expect(ds.runId).toMatch(/^[a-z0-9-]{6,64}$/);
    for (const u of ds.authUsers) expect(u.row.email).toMatch(/^seed\+sample-202611041200-\d+-[a-z0-9]{12}@sophecs\.test$/);
  });
});
