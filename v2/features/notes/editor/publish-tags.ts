/**
 * The publish step's tags, as plain values so they are tested without a DOM.
 *
 * Suggested tags (Arthur, 20 October 2026, 19:58Z): when the publish step opens
 * on a note with no tags, the server suggests some and they arrive as chips,
 * marked as suggestions. The writer keeps, removes or adds tags, and Publish
 * sends whatever is on screen through the same `PUT /notes/{id}` as before.
 * Nothing is saved until the writer presses Publish.
 */

export const MAX_TAGS = 10;
/** v1's limit; the API allows 100, so a v1 and a v2 tag fit the same box. */
export const MAX_TAG_LENGTH = 50;

/**
 * The server's suggestions as chips: trimmed, cut to the tag length, no
 * blanks, no repeats in any case, and never more than the box holds.
 */
export function cleanSuggestions(tags: readonly unknown[] | null | undefined): string[] {
  const out: string[] = [];
  for (const raw of tags ?? []) {
    if (typeof raw !== 'string') continue;
    const tag = raw.trim().slice(0, MAX_TAG_LENGTH);
    if (!tag || out.some((kept) => kept.toLowerCase() === tag.toLowerCase())) continue;
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/**
 * The tags on screen. `edited` is `null` until the writer changes a tag; until
 * then the box shows the note's saved tags, or the suggestions when it has
 * none. A suggestion that lands after the writer's first change adds nothing:
 * the box never changes under their hands.
 */
export function shownTags(
  edited: readonly string[] | null,
  saved: readonly string[],
  suggestions: readonly string[],
): readonly string[] {
  if (edited !== null) return edited;
  return saved.length > 0 ? saved : suggestions;
}

/** True when `tag` came from the server's suggestions rather than the writer. */
export function isSuggested(tag: string, suggestions: readonly string[]): boolean {
  const key = tag.toLowerCase();
  return suggestions.some((suggested) => suggested.toLowerCase() === key);
}

/** Ask for suggestions only for a note that has no tags of its own. */
export function wantsSuggestions(open: boolean, saved: readonly string[]): boolean {
  return open && saved.length === 0;
}
