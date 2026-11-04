// Every row a query matches, not the first thousand.
//
// Supabase's Data API returns at most `max-rows` rows per request (1,000 by
// default) and says nothing when it stops there: a select with no range
// over a larger table is silently cut short. The school table read this
// week's judged arguments and every profile that way, which was right while
// there were a handful of each and wrong as soon as there were not.
//
// The first page is read with an exact count, and the rest in parallel. The
// caller orders by a unique column, so pages do not overlap; a row written
// between two page reads can still be missed or seen twice, which for a
// weekly tally read on page load is acceptable and is not hidden.

export const PAGE_SIZE = 1000;

/** The highest row count read before refusing, so a runaway read fails loudly. */
export const MAX_ROWS = 100_000;

export interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
  count?: number | null;
}

export type ReadAllResult<T> = { rows: T[]; error: null } | { rows: null; error: string };

/**
 * `page(from, to)` must select with `{ count: "exact" }`, order by a unique
 * column, and apply `.range(from, to)`.
 */
export async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = PAGE_SIZE
): Promise<ReadAllResult<T>> {
  const first = await page(0, pageSize - 1);
  if (first.error) return { rows: null, error: first.error.message };
  const rows = [...(first.data ?? [])];
  const total = first.count;
  if (total == null) {
    // No count means the caller forgot to ask for one, and there is no way
    // to know whether the first page was all of it.
    return rows.length < pageSize
      ? { rows, error: null }
      : { rows: null, error: "readAll needs an exact count to read past the first page" };
  }
  if (total > MAX_ROWS) return { rows: null, error: `${total} rows is more than ${MAX_ROWS}` };

  const starts: number[] = [];
  for (let from = pageSize; from < total; from += pageSize) starts.push(from);
  const rest = await Promise.all(starts.map((from) => page(from, from + pageSize - 1)));
  for (const r of rest) {
    if (r.error) return { rows: null, error: r.error.message };
    rows.push(...(r.data ?? []));
  }
  return { rows, error: null };
}
