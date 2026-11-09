import { describe, expect, it } from "vitest";
import { baseHash, manifestHash } from "../../scripts/seed/plan";
import { contentTopics } from "../../scripts/seed/topics";
import { SMALL, small } from "./fixture";
import { RUN_WEEKLY } from "../../scripts/seed/generate";

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
    expect(manifestHash(small({ quiz: 2 }))).toBe("5cdf8ee58810e73b4d06d4eec51e168b3ab8107c3be35ea1f855cefb4c86f146");
    expect(manifestHash(small({ quiz: 2, to: "2026-11-14T12:00:00.000Z" }))).toBe(
      "646df8add6bdce16bcd2f33fbbec017918996fa8324d5b7cb81d7a759e8bd9f2"
    );
    expect(baseHash({ ...SMALL, quiz: 2, topics: contentTopics() })).toBe("5cdeac90c6bfadb49435f35b4688ee717ed990b7b3d409dd8ef3c600e1255824");
  });

  // The weekly run (Arthur, 2026-11-08) regenerates its rows from this code
  // every hour; a change that rewrote an earlier week would halt it at
  // its next spot check. Its datasets as this code made them, at the base
  // window's end, into its first week, and two weeks on, in the shape
  // before Arthur's decisions of 2026-11-09, which still draws exactly as
  // it did.
  it("gives a weekly run exactly the rows it gave when it was written", () => {
    const before = { quiz: 2 as const, weekly: { newcomers: 25, active: 200, minPerSchool: 20 } };
    expect(manifestHash(small(before))).toBe("5cdf8ee58810e73b4d06d4eec51e168b3ab8107c3be35ea1f855cefb4c86f146");
    expect(manifestHash(small({ ...before, to: "2026-11-07T12:00:00.000Z" }))).toBe("4044712326b4a6d49f3023e27d0a4de117f8e14308a597b3d6fd25885ea2c0d4");
    expect(manifestHash(small({ ...before, to: "2026-11-21T12:00:00.000Z" }))).toBe("e5486ca45ac5fd417cc3e2976c40cc791c8c3d5d0c9a9b0afa24d2e3ef7042b3");
  });

  // The scheduled job's shape since (RUN_WEEKLY: `rolling`, `anonymous`,
  // `taperDays`). A run made before WEEKLY_RULES_FROM, as the fixture's
  // is, hashes and draws as the shape before up to WEEKLY_RULES_WEEK, and
  // takes the new rules after it; a run made since takes them all.
  it("gives a weekly run made before the 2026-11-09 decisions its rows as they were, and one made since its own", () => {
    const weekly = { quiz: 2 as const, weekly: RUN_WEEKLY };
    const before = { quiz: 2 as const, weekly: { newcomers: 25, active: 200, minPerSchool: 20 } };
    expect(baseHash({ ...SMALL, ...weekly, topics: contentTopics() })).toBe(baseHash({ ...SMALL, ...before, topics: contentTopics() }));
    expect(manifestHash(small(weekly))).toBe("5cdf8ee58810e73b4d06d4eec51e168b3ab8107c3be35ea1f855cefb4c86f146");
    expect(manifestHash(small({ ...weekly, to: "2026-11-07T12:00:00.000Z" }))).toBe("4044712326b4a6d49f3023e27d0a4de117f8e14308a597b3d6fd25885ea2c0d4");
    expect(manifestHash(small({ ...weekly, to: "2026-11-21T12:00:00.000Z" }))).toBe("7e38fb77bfb4573a58d21e3ab10cccc09be05bc5e1b050a239968a2260807175");
    const made = { ...weekly, baseTo: "2026-11-16T12:00:00.000Z" };
    expect(baseHash({ ...SMALL, ...made, topics: contentTopics() })).toBe("869cb29bf6febf0dc93f20e98a63b2a168acb7b75bb0f65d98e0ce5bb5359203");
    expect(manifestHash(small({ ...made, to: made.baseTo }))).toBe("5b68f0b1654550c76d3c221d5efd698716464d07093a6ab6ec2a7af5963df013");
    expect(manifestHash(small({ ...made, to: "2026-11-19T12:00:00.000Z" }))).toBe("d4c725a6d35239e40519a42d9d5671f457fd2b8b55213dbce3fa8bd552cda55d");
    expect(manifestHash(small({ ...made, to: "2026-12-03T12:00:00.000Z" }))).toBe("ab4c7de436a326044359ed3db0692e71ee6cf2cbbb730789b0f7dd862a75332f");
  });

  it("names runs and addresses as documented", () => {
    const ds = small();
    // From the base window's end alone: no seed in a public id.
    expect(ds.runId).toBe("sample-202611041200");
    expect(ds.runId).toMatch(/^[a-z0-9-]{6,64}$/);
    for (const u of ds.authUsers) expect(u.row.email).toMatch(/^seed\+sample-202611041200-\d+-[a-z0-9]{12}@sophecs\.test$/);
  });
});
