// Pure — no filesystem, so the module page, the lessons index and the tests
// can all use it.
//
// A module body is one run of paragraphs. `readings` in its frontmatter
// marks where each reading starts, so the reading page can say "Reading 2
// of 3" and the index can say "3 readings" without the body being split
// into separate files. Each reading runs from its `from_paragraph` up to
// the next one's, the last to the end of the body.

export interface ModuleReadingMark {
  title: string;
  from_paragraph: number;
}

export interface ModuleReading {
  title: string;
  paragraphs: string[];
}

export function moduleReadingProblems(
  where: string,
  body: string,
  readings: unknown
): string[] {
  if (readings === undefined) return [];
  if (!Array.isArray(readings) || readings.length === 0) {
    return [`${where}: readings must be a non-empty list`];
  }
  const count = body.split("\n\n").length;
  const problems: string[] = [];
  readings.forEach((r: Partial<ModuleReadingMark>, i) => {
    const at = `${where}: reading ${i + 1}`;
    if (typeof r?.title !== "string" || r.title.trim() === "") problems.push(`${at}: title is empty`);
    const n = r?.from_paragraph;
    if (!Number.isInteger(n) || (n as number) < 0 || (n as number) >= count) {
      problems.push(`${at}: from_paragraph ${n} is out of range (0-${count - 1})`);
    } else if (i === 0 && n !== 0) {
      problems.push(`${at}: the first reading must start at paragraph 0`);
    } else if (i > 0 && (n as number) <= (readings[i - 1] as ModuleReadingMark).from_paragraph) {
      problems.push(`${at}: from_paragraph must be greater than the reading before it`);
    }
  });
  return problems;
}

// A module without `readings` is one reading, titled by the module itself.
export function splitModule(
  title: string,
  body: string,
  readings?: ModuleReadingMark[]
): ModuleReading[] {
  const paragraphs = body.split("\n\n");
  if (!readings || readings.length === 0) return [{ title, paragraphs }];
  return readings.map((r, i) => ({
    title: r.title,
    paragraphs: paragraphs.slice(r.from_paragraph, readings[i + 1]?.from_paragraph),
  }));
}
