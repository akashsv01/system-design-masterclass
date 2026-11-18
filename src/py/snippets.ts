/**
 * Pull one top-level function or method out of a Python source file so lessons can show a short
 * snippet that is still the exact tested code from python/.
 */
export function extractDef(source: string, name: string): string {
  return extractDefAt(source, name).code;
}

/** Like extractDef, but also returns the 1-based line in `source` where the def starts. */
export function extractDefAt(source: string, name: string): { code: string; start: number } {
  const lines = source.split('\n');
  const start = lines.findIndex((l) => new RegExp(`^\\s*(?:def|class) ${name}\\b`).test(l));
  if (start < 0) throw new Error(`def or class ${name} not found`);
  const indent = lines[start].match(/^\s*/)![0].length;
  let end = start + 1;
  while (end < lines.length) {
    const l = lines[end];
    if (l.trim() && l.match(/^\s*/)![0].length <= indent) break;
    end++;
  }
  while (end > start && !lines[end - 1].trim()) end--;
  return { code: lines.slice(start, end).map((l) => l.slice(indent)).join('\n'), start: start + 1 };
}

/** 1-based line number of the first line containing `needle`. */
export function lineOf(snippet: string, needle: string): number {
  const i = snippet.split('\n').findIndex((l) => l.includes(needle));
  if (i < 0) throw new Error(`"${needle}" not in snippet`);
  return i + 1;
}
