import type { JSONContent } from '@tiptap/core';

/**
 * draft-diff — what changed between two versions of a draft (Stay, 27 October
 * 2026, "Show changes": yes; thread 4531c708), for the draft panel's switch.
 *
 * Both versions are the editor's documents (markdown-to-doc.ts), so the
 * comparison keeps their formatting: headings, lists, tables, bold and fonts.
 * It runs in two steps, which keeps long legal text readable:
 *
 *   1. BLOCKS. The paragraphs, headings, list items and table rows are lined up
 *      by their text (longest common run), so an unchanged clause stays plain
 *      however much moved around it. Blocks that line up but differ are compared
 *      inside (step 2); a block only in the new version is ADDED whole, one only
 *      in the old version REMOVED whole.
 *   2. WORDS. Inside a changed paragraph the words are compared, never the
 *      letters: a reworded clause reads as the old words struck through and the
 *      new ones underlined, with no single-character noise. A space between two
 *      changes joins them, so "one month" → "three months" is one removed run
 *      and one added run, not four fragments.
 *
 * Nothing is stored: the result is a document whose text runs and blocks carry
 * `diff: 'add' | 'del'`, which DraftChangesView draws. Pure, so it is tested.
 */

export type DiffMark = 'add' | 'del';
export type DiffNode = JSONContent & { diff?: DiffMark; content?: DiffNode[] };

/** Nodes compared by their children; everything with text inside is a "text block". */
const CONTAINERS = new Set(['doc', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'table', 'tableRow', 'tableCell', 'tableHeader']);
const TEXT_BLOCKS = new Set(['paragraph', 'heading', 'codeBlock']);

/** A node's plain text, for lining blocks up. */
function textOf(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  return (node.content ?? []).map(textOf).join(node.type && CONTAINERS.has(node.type) ? '\n' : '');
}

/** What two blocks must share to count as the same, unchanged block. */
function signature(node: JSONContent): string {
  return `${node.type}:${JSON.stringify(node.attrs ?? {})}:${textOf(node)}`;
}

/** The pairs of indexes of a longest common subsequence of two key lists. */
function commonPairs(a: readonly string[], b: readonly string[]): [number, number][] {
  const rows = a.length;
  const cols = b.length;
  const table: Uint32Array[] = Array.from({ length: rows + 1 }, () => new Uint32Array(cols + 1));
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return pairs;
}

/** A whole node marked added or removed, with every text run inside it marked too. */
function markAll(node: JSONContent, mark: DiffMark): DiffNode {
  if (node.type === 'text' || node.type === 'hardBreak') return { ...node, diff: mark };
  return { ...node, diff: mark, content: node.content?.map((child) => markAll(child, mark)) };
}

/* ── Words ─────────────────────────────────────────────────────────────────── */

interface Token {
  /** What is compared: the word (or the run of spaces), never its marks. */
  key: string;
  /** The inline node it is drawn as: a text run or a line break. */
  node: JSONContent;
}

function tokensOf(inlines: readonly JSONContent[]): Token[] {
  const tokens: Token[] = [];
  for (const inline of inlines) {
    if (inline.type !== 'text') {
      tokens.push({ key: `<${inline.type}>`, node: inline });
      continue;
    }
    for (const piece of (inline.text ?? '').split(/(\s+)/)) {
      if (piece) tokens.push({ key: piece, node: { ...inline, text: piece } });
    }
  }
  return tokens;
}

const isSpace = (token: Token) => /^\s+$/.test(token.key);

/** A kept run between two changes this small is folded into them (see diffInline). */
const MAX_JOINED_WORDS = 2;
const MAX_JOINED_WORD_LENGTH = 3;

/** One text block's inline content, word by word, old against new. */
export function diffInline(before: readonly JSONContent[], after: readonly JSONContent[]): DiffNode[] {
  const a = tokensOf(before);
  const b = tokensOf(after);
  const pairs = commonPairs(
    a.map((token) => token.key),
    b.map((token) => token.key),
  );
  type Op = { kind: 'same' | DiffMark; token: Token };
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...pairs, [a.length, b.length] as [number, number]]) {
    while (i < pi) ops.push({ kind: 'del', token: a[i++] });
    while (j < pj) ops.push({ kind: 'add', token: b[j++] });
    if (pi < a.length && pj < b.length) {
      ops.push({ kind: 'same', token: b[pj] });
      i = pi + 1;
      j = pj + 1;
    }
  }
  // A small run kept between two changes joins them (spaces, and at most two
  // short words such as "a" or "of the"): removed with the old run and added
  // with the new one, so "₦2,400,000 a year" → "₦200,000 a month" reads as one
  // removed phrase and one added phrase, not four fragments.
  const joined: Op[] = [];
  let index = 0;
  while (index < ops.length) {
    if (ops[index].kind !== 'same') {
      joined.push(ops[index]);
      index += 1;
      continue;
    }
    let end = index;
    while (end < ops.length && ops[end].kind === 'same') end += 1;
    const run = ops.slice(index, end);
    const words = run.filter((op) => !isSpace(op.token));
    const between = index > 0 && end < ops.length;
    if (between && words.length <= MAX_JOINED_WORDS && words.every((op) => op.token.key.length <= MAX_JOINED_WORD_LENGTH)) {
      for (const op of run) joined.push({ kind: 'del', token: op.token }, { kind: 'add', token: op.token });
    } else {
      joined.push(...run);
    }
    index = end;
  }
  // Removed words go before the added ones within a change, then runs merge.
  const ordered: Op[] = [];
  let pending: Op[] = [];
  const flush = () => {
    ordered.push(...pending.filter((op) => op.kind === 'del'), ...pending.filter((op) => op.kind === 'add'));
    pending = [];
  };
  for (const op of joined) {
    if (op.kind === 'same') {
      flush();
      ordered.push(op);
    } else {
      pending.push(op);
    }
  }
  flush();
  const out: DiffNode[] = [];
  for (const op of ordered) {
    const node: DiffNode = op.kind === 'same' ? { ...op.token.node } : { ...op.token.node, diff: op.kind };
    const last = out[out.length - 1];
    if (
      last &&
      last.type === 'text' &&
      node.type === 'text' &&
      last.diff === node.diff &&
      JSON.stringify(last.marks ?? []) === JSON.stringify(node.marks ?? [])
    ) {
      last.text = `${last.text ?? ''}${node.text ?? ''}`;
    } else {
      out.push(node);
    }
  }
  return out;
}

/* ── Blocks ────────────────────────────────────────────────────────────────── */

function diffNode(before: JSONContent, after: JSONContent): DiffNode[] {
  if (before.type === after.type && TEXT_BLOCKS.has(after.type ?? '') && JSON.stringify(before.attrs ?? {}) === JSON.stringify(after.attrs ?? {})) {
    return [{ ...after, content: diffInline(before.content ?? [], after.content ?? []) }];
  }
  if (before.type === after.type && CONTAINERS.has(after.type ?? '')) {
    return [{ ...after, content: diffChildren(before.content ?? [], after.content ?? []) }];
  }
  return [markAll(before, 'del'), markAll(after, 'add')];
}

/** Children lined up by their text; the blocks in each gap paired by kind, in order. */
function diffChildren(before: readonly JSONContent[], after: readonly JSONContent[]): DiffNode[] {
  const pairs = commonPairs(before.map(signature), after.map(signature));
  const out: DiffNode[] = [];
  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...pairs, [before.length, after.length] as [number, number]]) {
    const removed = before.slice(i, pi);
    const added = after.slice(j, pj);
    let r = 0;
    let s = 0;
    while (r < removed.length || s < added.length) {
      const old = removed[r];
      const next = added[s];
      if (old && next && old.type === next.type) {
        out.push(...diffNode(old, next));
        r += 1;
        s += 1;
      } else if (old && (!next || removed.length - r > added.length - s)) {
        out.push(markAll(old, 'del'));
        r += 1;
      } else if (next) {
        out.push(markAll(next, 'add'));
        s += 1;
      }
    }
    if (pi < before.length && pj < after.length) out.push(after[pj] as DiffNode);
    i = pi + 1;
    j = pj + 1;
  }
  return out;
}

/** The new version's document, with what changed since the old one marked. */
export function diffDocs(before: JSONContent, after: JSONContent): DiffNode {
  return { ...after, content: diffChildren(before.content ?? [], after.content ?? []) };
}

/** Whether anything at all changed, so the view can say "No changes". */
export function hasChanges(node: DiffNode): boolean {
  return node.diff !== undefined || (node.content ?? []).some(hasChanges);
}
