import { describe, it, expect } from "vitest";
import { authorList, moduleNumbers } from "../src/lib/lesson-index";

describe("authorList", () => {
  it("names one author once, however many sections are cited", () => {
    expect(
      authorList([
        { author: "Epictetus", work: "Enchiridion", section: "1" },
        { author: "Epictetus", work: "Enchiridion", section: "5" },
      ])
    ).toBe("Epictetus");
  });

  it("joins two with 'and', and three with commas then 'and'", () => {
    const s = (author: string) => ({ author, work: "Works" });
    expect(authorList([s("Mill"), s("Bentham")])).toBe("Mill and Bentham");
    expect(authorList([s("Mill"), s("Bentham"), s("Sidgwick")])).toBe(
      "Mill, Bentham and Sidgwick"
    );
  });

  it("keeps first-citation order rather than sorting", () => {
    const s = (author: string) => ({ author, work: "Works" });
    expect(authorList([s("Mill"), s("Bentham")])).toBe("Mill and Bentham");
    expect(authorList([s("Bentham"), s("Mill")])).toBe("Bentham and Mill");
  });

  it("is empty for no sources, so the card renders no stray separator", () => {
    expect(authorList([])).toBe("");
  });
});

describe("moduleNumbers", () => {
  it("counts within a school, not across the directory", () => {
    const numbers = moduleNumbers([
      { id: "greatest-happiness", school: "utilitarianism" },
      { id: "practical-wisdom", school: "virtue-ethics" },
      { id: "what-is-up-to-us", school: "stoicism" },
    ]);
    expect(numbers).toEqual({
      "greatest-happiness": 1,
      "practical-wisdom": 1,
      "what-is-up-to-us": 1,
    });
  });

  it("numbers a school's second module 2 however many others precede it", () => {
    const numbers = moduleNumbers([
      { id: "a", school: "stoicism" },
      { id: "b", school: "utilitarianism" },
      { id: "c", school: "virtue-ethics" },
      { id: "d", school: "stoicism" },
    ]);
    expect(numbers.d).toBe(2);
    expect(numbers.b).toBe(1);
  });
});
