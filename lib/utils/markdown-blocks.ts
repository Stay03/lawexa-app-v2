/** Split markdown into independently-renderable blocks (blank-line separated),
 *  never splitting inside a fenced code block. Pure — safe to call in render.
 *  The render unit of v2's MarkdownText (each block is its own memoized parse),
 *  and the unit a skill's steps are compared by (`block-diff.ts`). It lives in
 *  `lib` so admin and v2 share one rule for what a block is. */
export function splitMarkdownBlocks(text: string): string[] {
  const lines = text.split('\n');
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;
  let fenceChar = '';

  const flush = () => {
    if (current.length > 0) {
      blocks.push(current.join('\n'));
      current = [];
    }
  };

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!inFence) {
        inFence = true;
        fenceChar = marker;
      } else if (marker === fenceChar) {
        inFence = false;
      }
      current.push(line);
      continue;
    }
    if (!inFence && line.trim() === '') {
      flush();
    } else {
      current.push(line);
    }
  }
  flush();
  return blocks.length > 0 ? blocks : [text];
}
