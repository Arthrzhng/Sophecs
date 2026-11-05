import { describe, it, expect } from "vitest";
import {
  todayPathStates,
  todayDoneFlags,
  hasActionableStep,
  showsElsewhere,
  ELSEWHERE_FROM_STEP,
  TODAY_STEPS,
} from "../src/lib/today-path";

const NOTHING = { read: false, argued: false, answered: false, closed: false };

function states(
  progress: Partial<typeof NOTHING>,
  checked: boolean,
  paused: boolean
) {
  return todayPathStates(todayDoneFlags({ ...NOTHING, ...progress }, checked), paused);
}

describe("todayDoneFlags", () => {
  it("has one flag per step", () => {
    expect(todayDoneFlags(NOTHING, false)).toHaveLength(TODAY_STEPS.length);
  });

  it("completes steps 3 and 4 together, since one judged argument gives both the verdict and the objection", () => {
    const flags = todayDoneFlags({ ...NOTHING, read: true, argued: true }, true);
    expect(flags[2]).toBe(true);
    expect(flags[3]).toBe(true);
  });

  it("completes steps 5 and 6 together, since one judged revision both answers the objection and closes the case", () => {
    const flags = todayDoneFlags(
      { read: true, argued: true, answered: true, closed: true },
      true
    );
    expect(flags[4]).toBe(true);
    expect(flags[5]).toBe(true);
  });
});

describe("todayPathStates while judging runs", () => {
  it("makes the first step current and locks the rest by order", () => {
    const s = states({}, false, false);
    expect(s[0].state).toBe("current");
    expect(s.slice(1).every((x) => x.state === "locked")).toBe(true);
    expect(s.slice(1).every((x) => x.lockReason === "order")).toBe(true);
  });

  it("moves to the check once the notes are written", () => {
    const s = states({ read: true }, false, false);
    expect(s[0].state).toBe("done");
    expect(s[1].state).toBe("current");
  });

  it("opens arguing once the check is answered", () => {
    const s = states({ read: true }, true, false);
    expect(s[2].state).toBe("current");
  });

  it("marks every step done and leaves nothing current when the case closes", () => {
    const s = states(
      { read: true, argued: true, answered: true, closed: true },
      true,
      false
    );
    expect(s.every((x) => x.state === "done")).toBe(true);
    expect(hasActionableStep(s)).toBe(false);
  });
});

describe("todayPathStates while judging is paused", () => {
  it("still lets the reader read and check", () => {
    const s = states({}, false, true);
    expect(s[0].state).toBe("current");
    expect(hasActionableStep(s)).toBe(true);
  });

  it("holds the four judged steps shut, and says why", () => {
    const s = states({ read: true }, true, true);
    for (const i of [2, 3, 4, 5]) {
      expect(s[i].state).toBe("locked");
      expect(s[i].lockReason).toBe("judging");
    }
  });

  it("leaves nothing actionable once the unjudged steps are done", () => {
    const s = states({ read: true }, true, true);
    expect(hasActionableStep(s)).toBe(false);
  });

  it("prefers the judging reason over the order reason, since it is the more useful thing to be told", () => {
    // Nothing done at all: step 6 is both out of order and behind the judge.
    const s = states({}, false, true);
    expect(s[5].lockReason).toBe("judging");
    expect(s[1].lockReason).toBe("order");
  });

  it("keeps a step finished when the switch is flipped back on after it", () => {
    // Argued while allowlisted, then the pause applies again.
    const s = states({ read: true, argued: true }, true, true);
    expect(s[2].state).toBe("done");
    expect(s[3].state).toBe("done");
    expect(s[4].state).toBe("locked");
    expect(s[4].lockReason).toBe("judging");
  });
});

describe("showsElsewhere", () => {
  it("is keyed to step 4, Face an objection", () => {
    expect(TODAY_STEPS[ELSEWHERE_FROM_STEP].title).toBe("Face an objection");
  });

  it("hides the view from elsewhere until the reader reaches step 4", () => {
    expect(showsElsewhere(states({}, false, false))).toBe(false);
    expect(showsElsewhere(states({ read: true }, false, false))).toBe(false);
    // Read and checked: step 3 is current, step 4 still locked.
    expect(showsElsewhere(states({ read: true }, true, false))).toBe(false);
  });

  it("shows it once the reader has argued, which reaches step 4, and after", () => {
    expect(showsElsewhere(states({ read: true, argued: true }, true, false))).toBe(true);
    expect(showsElsewhere(states({ read: true, argued: true, answered: true, closed: true }, true, false))).toBe(true);
  });

  it("keeps it shown for a reader who argued before judging was paused, and hidden for one who had not", () => {
    expect(showsElsewhere(states({ read: true, argued: true }, true, true))).toBe(true);
    expect(showsElsewhere(states({ read: true }, true, true))).toBe(false);
  });

  it("shows nothing for a path with no step 4", () => {
    expect(showsElsewhere([])).toBe(false);
  });
});
