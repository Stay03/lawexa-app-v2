/**
 * line-diff — what changed between two texts, line by line (the skills tool:
 * a draft's instructions beside the live skill's, thread 2b436b4f).
 *
 * A longest-common-subsequence diff over lines, written here rather than
 * pulled in as a package (no new dependency). Skill instructions are at most
 * 20,000 characters, a few hundred lines, so the table is small. Above
 * `MAX_CELLS` the texts are shown as all removed then all added, which is
 * still true, only less precise.
 */

export type DiffLine = { kind: 'same' | 'added' | 'removed'; text: string };

const MAX_CELLS = 4_000_000;

function lines(value: string): string[] {
  return value.replace(/\r\n?/g, '\n').split('\n');
}

export function diffLines(before: string, after: string): DiffLine[] {
  return diffSequence(lines(before), lines(after));
}

/** The same diff over any two lists of texts: lines here, markdown blocks in `block-diff.ts`. */
export function diffSequence(a: readonly string[], b: readonly string[]): DiffLine[] {
  if (a.length * b.length > MAX_CELLS) {
    return [...a.map((text) => ({ kind: 'removed' as const, text })), ...b.map((text) => ({ kind: 'added' as const, text }))];
  }
  // lcs[i][j]: the common lines of a[i..] and b[j..].
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i] });
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ kind: 'removed', text: a[i] });
      i += 1;
    } else {
      out.push({ kind: 'added', text: b[j] });
      j += 1;
    }
  }
  while (i < a.length) out.push({ kind: 'removed', text: a[i++] });
  while (j < b.length) out.push({ kind: 'added', text: b[j++] });
  return out;
}

/** How many lines a diff adds and removes. */
export function diffCounts(diff: readonly DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of diff) {
    if (line.kind === 'added') added += 1;
    else if (line.kind === 'removed') removed += 1;
  }
  return { added, removed };
}
