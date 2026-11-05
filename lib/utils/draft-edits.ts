/**
 * draft-edits — an answer's changes to part of a draft, written out as the
 * whole drafts they make (Stay's option A, thread 803b7234; spec 76a6d14b).
 *
 * Lawexa writes a change as `<draft-edit id version>` with find/replace pairs.
 * The server applies it once the answer is saved and stores the result on the
 * message, `metadata.draft_edits["id:version"]` (woz 93f19832): the full new
 * body, or `body: null` when a passage was not found exactly once. The
 * message's own text is kept as Lawexa wrote it.
 *
 * Read here as the server's `DraftEdits::resolvedContent` reads it: each
 * complete edit with a body becomes `<draft title id version font size>body
 * </draft>`, so everything that already reads drafts (the cards, the versions,
 * the panel, save and download) follows with no edit logic of its own. An
 * edit with no body stays an edit and is marked `failed="true"`, so its card
 * can say the change was not made. An answer with no `draft_edits`, and every
 * answer from before them, is returned as it is.
 *
 * Pure, and outside v2 because the transcript's reader (transform-api-messages)
 * is shared.
 */

/** One stored result, as the server writes it. */
export interface DraftEditResult {
  body: string | null;
  /** The changed parts of `body`, in UTF-16 code units. */
  ranges?: { start: number; end: number }[];
  base_version?: number | null;
  /**
   * The exact text the edit was applied to, sent only when the person had
   * changed the version before (Techlead a9c46e69); `null` when it was
   * Lawexa's own version, and on a failed edit.
   */
  base_body?: string | null;
  failed?: { pair: number | null; find: string | null; matches: number }[];
  title?: string | null;
  font?: string | null;
  size?: number | null;
}

const EDIT = /<draft-edit((?:\s+[a-z-]+="[^"]*")*)\s*>[\s\S]*?<\/draft-edit>/gi;

function attribute(rest: string, name: string): string | null {
  const match = new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(rest);
  return match ? match[1].trim() : null;
}

/** A title as a draft tag carries it: `&` and `"` written as entities. */
function encodeTitle(title: string): string {
  return title.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** Each resolved edit's base text, by "id:version"; `undefined` when the server sent none. */
export function draftEditBases(edits: Record<string, DraftEditResult> | null | undefined): Record<string, string> | undefined {
  if (!edits) return undefined;
  const bases = Object.entries(edits).flatMap(([key, result]) =>
    result.body !== null && typeof result.base_body === 'string' ? [[key, result.base_body] as const] : [],
  );
  return bases.length > 0 ? Object.fromEntries(bases) : undefined;
}

/**
 * The answer with each resolved edit written out as its whole draft, and each
 * failed one marked.
 *
 * SEVERAL BLOCKS, ONE VERSION (Tester's live check, c34637ea). Lawexa may
 * split one change into two `<draft-edit>` blocks with the same id and
 * version. The server applies them in order as one version, one entry per
 * key; so the LAST block of a key is written out as that version and the
 * earlier ones are folded into it (left out), never a second, empty version,
 * as the server's resolvedContent writes it (woz 36b33e5d).
 * When the entry failed, every block of the key says so.
 */
export function resolveDraftEdits(content: string, edits: Record<string, DraftEditResult> | null | undefined): string {
  if (!edits || !content.includes('<draft-edit')) return content;
  const keyOf = (rest: string) => {
    const id = attribute(rest, 'id');
    const version = attribute(rest, 'version');
    return id && version ? `${id}:${version}` : null;
  };
  // How many complete blocks each key still has to come, so the last one is known.
  const remaining = new Map<string, number>();
  for (const match of content.matchAll(EDIT)) {
    const key = keyOf(match[1] ?? '');
    if (key) remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  return content.replace(EDIT, (block, rest: string) => {
    const key = keyOf(rest);
    const result = key ? edits[key] : undefined;
    if (!key || !result) return block;
    if (result.body === null) return block.replace(/^<draft-edit/i, '<draft-edit failed="true"');
    const left = (remaining.get(key) ?? 1) - 1;
    remaining.set(key, left);
    if (left > 0) return '';
    const [id, version] = key.split(':');
    const font = result.font ? ` font="${encodeTitle(result.font)}"` : '';
    const size = result.size ? ` size="${result.size}"` : '';
    // `from-edit` tells the panel this version was an edit, so it opens showing the changes.
    return `<draft title="${encodeTitle(result.title?.trim() || 'Draft')}" id="${id}" version="${version}"${font}${size} from-edit="true">\n${result.body}\n</draft>`;
  });
}

/**
 * Whether an answer still holds a complete `<draft-edit>` the server has not
 * answered for: neither written out as a version nor marked failed. The server
 * applies edits in a job after the answer is saved (SyncDraftNotes), so an
 * answer read straight after it ends, live or from history, holds its edits as
 * Lawexa wrote them until the transcript is read again (Tester 394c79d9: a
 * failed edit still read as applied).
 */
export function hasUnresolvedDraftEdits(content: string): boolean {
  if (!content.includes('<draft-edit')) return false;
  for (const match of content.matchAll(EDIT)) {
    if (!/\sfailed="true"/i.test(match[1] ?? '')) return true;
  }
  return false;
}

/** How long after an answer ends the transcript is read again while its edits are unanswered: about a minute in all. */
export const DRAFT_EDIT_RECHECK_MS = [2_000, 4_000, 8_000, 15_000, 30_000] as const;

/** The wait before the next read, or null once the reads are spent. */
export function draftEditRecheckDelay(attempt: number): number | null {
  return DRAFT_EDIT_RECHECK_MS[attempt] ?? null;
}
