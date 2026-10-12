/**
 * Parsed markdown of landed answers, kept in memory across opens (MarkdownText).
 *
 * WHY. The second tap on a chat parsed every block of every drawn answer
 * again: MarkdownText's per-block memo lives as long as its row, and the row
 * goes with the screen when the reader goes back to the list. The parse
 * (micromark, GFM, the hast to React step) is the one cost of an open that no
 * frame scheduling removes, only moves. Kept, it is paid once per answer.
 *
 * KEYED BY THE BLOCK'S TEXT. The parse is a function of the block's text and
 * the fixed plain pipeline, nothing else, so the text is the whole key. A
 * message whose text changes (an answer that lands, a stopped answer drawn
 * without its cut tail) reads a different key and can never see the old
 * entry; the message's id would add a second map and no safety. Streaming
 * text never reaches this cache: MarkdownText parses it through the animated
 * pipeline, whose output carries word spans and changes with every flush, so
 * no mid-stream text is kept, and the landed text is what the row keeps when
 * it renders plain.
 *
 * BOUNDED. The lengths of the kept texts add up to at most the cap; past it
 * the least recently used entries go first, and a text longer than the cap
 * is not kept at all. A read counts as a use. The cap covers a few long
 * chats: the owner's 38-message chat is about 50,000 characters of answers.
 */

/** The most characters of block text kept, over all entries. */
export const PREPARED_CHARS_CAP = 200_000;

export interface PreparedBlocks<T> {
  /** The kept value for this text, now the most recently used; `undefined` for none. */
  get(text: string): T | undefined;
  /** Whether a value is kept for this text. Not a use. */
  has(text: string): boolean;
  /** Keep a value for this text, dropping the least recently used entries past the cap. */
  set(text: string, value: T): void;
  /** How many entries are kept. */
  readonly size: number;
  /** The lengths of the kept texts, added up. */
  readonly chars: number;
}

export function createPreparedBlocks<T>(capChars: number): PreparedBlocks<T> {
  // A Map iterates in insertion order, so re-inserting on a read keeps the
  // least recently used entry first.
  const entries = new Map<string, T>();
  let chars = 0;

  const drop = (text: string) => {
    entries.delete(text);
    chars -= text.length;
  };

  return {
    get(text) {
      const value = entries.get(text);
      if (value === undefined) return undefined;
      entries.delete(text);
      entries.set(text, value);
      return value;
    },
    has(text) {
      return entries.has(text);
    },
    set(text, value) {
      if (text.length > capChars) return;
      if (entries.has(text)) drop(text);
      entries.set(text, value);
      chars += text.length;
      for (const oldest of entries.keys()) {
        if (chars <= capChars) break;
        drop(oldest);
      }
    },
    get size() {
      return entries.size;
    },
    get chars() {
      return chars;
    },
  };
}
