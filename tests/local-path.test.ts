// /auth/callback follows `next` only to a path on the same site.
import { describe, expect, it } from "vitest";
import { localPath } from "../src/lib/local-path";

const ORIGIN = "https://sophecs.com";

describe("localPath", () => {
  it("keeps a path on the site, with its query and hash", () => {
    expect(localPath("/debate/opaque-benefit", ORIGIN)).toBe("/debate/opaque-benefit");
    expect(localPath("/r/abc?x=1#top", ORIGIN)).toBe("/r/abc?x=1#top");
    expect(localPath("/me", ORIGIN)).toBe("/me");
  });

  it("refuses anything that would leave the site", () => {
    for (const next of [
      "//evil.example",
      "//evil.example/me",
      "/\\evil.example",
      "/\\/evil.example",
      "/\t/evil.example",
      "https://evil.example",
      "http://sophecs.com/me",
      "javascript:alert(1)",
      "evil.example",
      "",
    ])
      expect(localPath(next, ORIGIN), next).toBeNull();
    expect(localPath(null, ORIGIN)).toBeNull();
    expect(localPath(undefined, ORIGIN)).toBeNull();
  });
});
