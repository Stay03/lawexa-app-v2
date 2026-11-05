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
  /** The exact text the edit was applied to; `null` on a failed edit with no base. */
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

/** The answer with each resolved edit written out as its whole draft, and each failed one marked. */
export function resolveDraftEdits(content: string, edits: Record<string, DraftEditResult> | null | undefined): string {
  if (!edits || !content.includes('<draft-edit')) return content;
  return content.replace(EDIT, (block, rest: string) => {
    const id = attribute(rest, 'id');
    const version = attribute(rest, 'version');
    const result = id && version ? edits[`${id}:${version}`] : undefined;
    if (!result) return block;
    if (result.body === null) return block.replace(/^<draft-edit/i, '<draft-edit failed="true"');
    const font = result.font ? ` font="${encodeTitle(result.font)}"` : '';
    const size = result.size ? ` size="${result.size}"` : '';
    // `from-edit` tells the panel this version was an edit, so it opens showing the changes.
    return `<draft title="${encodeTitle(result.title?.trim() || 'Draft')}" id="${id}" version="${version}"${font}${size} from-edit="true">\n${result.body}\n</draft>`;
  });
}
