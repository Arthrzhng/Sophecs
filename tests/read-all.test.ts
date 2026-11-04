import { describe, expect, it } from "vitest";
import { readAll, type PageResult } from "@/lib/read-all";

// A table of `n` rows behind a fake Data API that caps every response at
// `cap` rows, as Supabase's max-rows does.
function fakeTable(n: number, cap = 1000, opts: { count?: boolean; failAt?: number } = {}) {
  const rows = Array.from({ length: n }, (_, i) => ({ id: i }));
  const calls: [number, number][] = [];
  const page = async (from: number, to: number): Promise<PageResult<{ id: number }>> => {
    calls.push([from, to]);
    if (opts.failAt !== undefined && from === opts.failAt) {
      return { data: null, error: { message: "boom" }, count: null };
    }
    const slice = rows.slice(from, Math.min(to + 1, from + cap));
    return { data: slice, error: null, count: opts.count === false ? null : n };
  };
  return { page, calls };
}

describe("readAll", () => {
  it("returns every row past the thousand-row cap, once each", async () => {
    const { page, calls } = fakeTable(4321);
    const result = await readAll(page);
    expect(result.error).toBeNull();
    expect(result.rows!.length).toBe(4321);
    expect(new Set(result.rows!.map((r) => r.id)).size).toBe(4321);
    expect(calls.length).toBe(5);
  });

  it("reads one page when one page is everything", async () => {
    const { page, calls } = fakeTable(12);
    const result = await readAll(page);
    expect(result.rows!.length).toBe(12);
    expect(calls).toEqual([[0, 999]]);
  });

  it("reads an exact multiple of the page size without an empty extra read", async () => {
    const { page, calls } = fakeTable(2000);
    const result = await readAll(page);
    expect(result.rows!.length).toBe(2000);
    expect(calls.length).toBe(2);
  });

  it("fails rather than return a partial read", async () => {
    const { page } = fakeTable(3500, 1000, { failAt: 2000 });
    const result = await readAll(page);
    expect(result).toEqual({ rows: null, error: "boom" });
  });

  it("treats a short page that is not the last as truncation", async () => {
    // A server whose max-rows is 500 answers a 1,000-row request with 500.
    const { page } = fakeTable(2500, 500);
    const result = await readAll(page);
    expect(result.rows).toBeNull();
    expect(result.error).toMatch(/max-rows/);
  });

  it("refuses to guess past a full first page with no count", async () => {
    const { page } = fakeTable(1500, 1000, { count: false });
    const result = await readAll(page);
    expect(result.rows).toBeNull();
    expect(result.error).toMatch(/exact count/);
  });
});
