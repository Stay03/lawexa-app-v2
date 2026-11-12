/**
 * side-panel-value — what the chat's side panel shows, as the one URL param
 * `?side=` (so Back closes it, `useUrlOverlay`). One panel serves every
 * kind (Stay, 23 October 2026: the draft editor, and the files Lawexa lists),
 * so the value names the kind and its target:
 *
 *   draft:3          the chat's fourth draft (0-based, in transcript order)
 *   file:812         a file by id
 *   note:my-note     a note by slug
 *   machine:live     Lawexa's machine (Userbox v1, staff)
 *   agent:<uuid>     an agent conversation Lawexa opened with another agent (sub-agents)
 *
 * A draft is named by its PLACE among the chat's drafts, not by its message
 * id: an answer streamed in this visit carries a local id and the same answer
 * read back carries the server's, while its place in the transcript holds.
 */

export type SidePanelTarget =
  | { kind: 'draft'; ordinal: number }
  | { kind: 'file'; id: number }
  | { kind: 'note'; slug: string }
  | { kind: 'machine' }
  | { kind: 'agent'; id: string };

/** An agent conversation's uuid, as the server writes one. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SIDE_PANEL_PARAM = 'side';

export function sidePanelValue(target: SidePanelTarget): string {
  switch (target.kind) {
    case 'draft':
      return `draft:${target.ordinal}`;
    case 'file':
      return `file:${target.id}`;
    case 'note':
      return `note:${encodeURIComponent(target.slug)}`;
    case 'machine':
      return 'machine:live';
    case 'agent':
      return `agent:${target.id}`;
  }
}

/** The target a `?side=` value names, or `null` for one this app does not know. */
export function parseSidePanelValue(value: string | null): SidePanelTarget | null {
  if (!value) return null;
  const at = value.indexOf(':');
  if (at < 0) return null;
  const kind = value.slice(0, at);
  const rest = value.slice(at + 1);
  if (kind === 'draft' || kind === 'file') {
    if (!/^\d+$/.test(rest)) return null;
    const number = Number(rest);
    if (!Number.isSafeInteger(number)) return null;
    return kind === 'draft' ? { kind, ordinal: number } : number > 0 ? { kind, id: number } : null;
  }
  if (kind === 'note') {
    let slug: string;
    try {
      slug = decodeURIComponent(rest);
    } catch {
      return null;
    }
    return slug ? { kind, slug } : null;
  }
  if (kind === 'machine') return rest === 'live' ? { kind } : null;
  if (kind === 'agent') return UUID.test(rest) ? { kind, id: rest.toLowerCase() } : null;
  return null;
}
