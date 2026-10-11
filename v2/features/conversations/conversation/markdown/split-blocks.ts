/** Split markdown into independently-renderable blocks (blank-line separated),
 *  never splitting inside a fenced code block. Pure — safe to call in render.
 *  The render unit of MarkdownText: each block is its own memoized parse. */
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
