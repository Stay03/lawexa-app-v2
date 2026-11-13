import { diffSequence, type DiffLine } from './line-diff';
import { splitMarkdownBlocks } from './markdown-blocks';

/**
 * block-diff — what changed between two skill instructions, by markdown block
 * (Stay, 13 November 2026, 2b436b4f: "Can the text be rendered nicely instead
 * of the code view"). A block is a paragraph, a heading, a whole list, a table
 * or a fenced code block: what a blank line separates (`markdown-blocks.ts`),
 * so each one renders as formatted text on its own and keeps its meaning.
 * Blocks compare by their text with outer spaces trimmed.
 */
export type DiffBlock = DiffLine;

function blocks(value: string): string[] {
  const text = value.replace(/\r\n?/g, '\n').trim();
  return text === '' ? [] : splitMarkdownBlocks(text).map((block) => block.trim());
}

/**
 * Within a run of changes, each removed block is followed by the block that
 * replaced it (removed, added, removed, added…), the extras last, so a reader
 * sees each old part beside its new one instead of all the old, then all the new.
 */
function pairRuns(diff: DiffBlock[]): DiffBlock[] {
  const out: DiffBlock[] = [];
  let removed: DiffBlock[] = [];
  let added: DiffBlock[] = [];
  const flush = () => {
    for (let i = 0; i < Math.max(removed.length, added.length); i += 1) {
      if (i < removed.length) out.push(removed[i]);
      if (i < added.length) out.push(added[i]);
    }
    removed = [];
    added = [];
  };
  for (const block of diff) {
    if (block.kind === 'removed') removed.push(block);
    else if (block.kind === 'added') added.push(block);
    else {
      flush();
      out.push(block);
    }
  }
  flush();
  return out;
}

export function diffBlocks(before: string, after: string): DiffBlock[] {
  return pairRuns(diffSequence(blocks(before), blocks(after)));
}
