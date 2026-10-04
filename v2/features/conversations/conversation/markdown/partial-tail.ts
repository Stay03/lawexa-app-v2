/**
 * A stopped answer's text, without the link or citation the stop cut in half.
 *
 * When a reader stops an answer, the server keeps the text as it was at that
 * moment. If the stop lands inside a link (`[label](https://…`) or a citation
 * (`[[1]](https://…`), the saved text ends in markdown that never closes, and
 * the renderer shows it as typed: a raw half-address at the end of the answer
 * (techlead a80ed58a, 4 October 2026). This drops only that unclosed tail;
 * everything before it is kept, and the saved text is not changed.
 *
 * Only a tail with no line break in it counts: a `[` earlier in the answer
 * followed by more prose is ordinary text, not a cut link.
 */
export function trimUnclosedLinkTail(text: string): string {
  const open = text.lastIndexOf('[');
  if (open === -1) return text;
  // A citation opens with two brackets; start at the first.
  const start = open > 0 && text[open - 1] === '[' ? open - 1 : open;
  const tail = text.slice(start);
  if (tail.includes('\n')) return text;

  const complete = /^\[\[?[^\]]*\]\]?\([^)\s]*\)/.test(tail);
  if (complete) return text;

  const labelOpen = !tail.includes(']');
  const addressOpen = /^\[\[?[^\]]*\]\]?\([^)]*$/.test(tail);
  const bareCitation = /^\[\[\d*\]?\]?$/.test(tail);
  if (!labelOpen && !addressOpen && !bareCitation) return text;

  return text.slice(0, start).replace(/[ \t]+$/, '');
}
