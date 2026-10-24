import type { ConversationSpaceRef, ToolMessage } from '@/types/chat';
import { fileKind, fileSize } from '@/v2/features/folders/item-row-model';
import { viewKind, type ViewKind } from '@/v2/features/files/viewable';

/**
 * chat-files — the files a Lawexa step listed, as the chat's file list card
 * draws them (the file list in chat, piece a; Stay, 23 October 2026).
 *
 * READ FROM THE STEP'S OWN RESULT, the body the server's tool answered with
 * (lawexa-api `ToolController` and `SpaceToolController`, read 24 October
 * 2026). Three tools list files:
 *
 *   list_files            data.files[], data.pagination.total, data.scope
 *   search_files          data.files[], data.total, data.scope
 *   list_space_contents   data.files[], data.space { uuid, name }
 *
 * Each file carries `id`, `name`, `kind` (image, video, audio or document),
 * `size_bytes`, `uploader` (a name) and `uploaded_at`. Its type differs:
 * list_files and search_files send `mime_type` as a shorthand ("pdf",
 * "docx") with the real type in `content_type`; list_space_contents sends the
 * real type in `mime_type`. `owner` ("me", or the uploader's name) is on the
 * first two only. `scope` says what was read: "space: <name>", "mine +
 * space: <name>", "mine", "verified authors" or "mine + verified authors".
 *
 * Every field is read defensively: a file without an id is left out, and a
 * result in a shape this does not know gives no card rather than a broken one.
 */

export const FILE_LIST_TOOLS = ['list_files', 'search_files', 'list_space_contents'] as const;

/** How many rows the card shows before "Show N more". */
export const FILE_LIST_VISIBLE = 5;

export interface ChatFileRow {
  id: number;
  name: string;
  /** "PDF", "Word", "Image", ... (`fileKind`), or `null` when the type is unknown. */
  kind: string | null;
  /** "1.2 MB", or `null` for a size the result did not carry. */
  size: string | null;
  /** Who added it: "You" for the reader's own, else the uploader's name. */
  by: string | null;
  /** The real mime type, when the result carried one. */
  mime: string | null;
  /** How the panel shows it (a picture, a video, a recording), or `null` for a document. */
  view: ViewKind | null;
}

export interface ChatFileList {
  rows: ChatFileRow[];
  /** How many files the tool found: more than `rows` when it listed one page. */
  total: number;
  /** Where the files are, in words: the Space's name, "your files", ... or `null`. */
  place: string | null;
  /** The Space they are in, for Go to Space, when the result or the chat names it. */
  space: ConversationSpaceRef | null;
}

export function isFileListStep(message: ToolMessage): boolean {
  return (FILE_LIST_TOOLS as readonly string[]).includes(message.toolName);
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** The data, unwrapped from the `{ data }` envelope a stored result can carry. */
function payload(data: unknown): Record<string, unknown> | null {
  const top = record(data);
  if (!top) return null;
  return record(top.data) ?? top;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** The shorthand list_files sends in `mime_type`, as the real type. */
const SHORTHAND_MIME: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  rtf: 'application/rtf',
};

/** The file's real mime type: `content_type`, else a `mime_type` that is one, else the shorthand's. */
function mimeOf(file: Record<string, unknown>): string | null {
  const contentType = text(file.content_type);
  if (contentType) return contentType;
  const mime = text(file.mime_type);
  if (!mime) return null;
  if (mime.includes('/')) return mime;
  return SHORTHAND_MIME[mime.toLowerCase()] ?? null;
}

export function chatFileRow(file: Record<string, unknown>): ChatFileRow | null {
  const id = file.id;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) return null;
  const name = text(file.name) ?? 'Unnamed file';
  const mime = mimeOf(file);
  const size = typeof file.size_bytes === 'number' ? fileSize(file.size_bytes) : null;
  const by = file.owner === 'me' ? 'You' : text(file.uploader);
  return {
    id,
    name,
    kind: fileKind(mime ?? undefined),
    size,
    by,
    mime,
    view: viewKind({ id, original_name: name, mime_type: mime }),
  };
}

/** "PDF · 1.2 MB · Ada": the row's second line. */
export function chatFileLine(row: Pick<ChatFileRow, 'kind' | 'size' | 'by'>): string {
  return [row.kind ?? 'File', row.size, row.by].filter(Boolean).join(' · ');
}

/** The Space a scope names ("space: Final-year project", "mine + space: ..."), by name. */
function scopeSpaceName(scope: string | null): string | null {
  if (!scope) return null;
  const match = /(?:^|\+ )space: (.+)$/.exec(scope);
  return match ? match[1].trim() || null : null;
}

function placeOf(scope: string | null, spaceName: string | null): string | null {
  if (spaceName) return spaceName;
  if (scope === 'mine') return 'your files';
  if (scope === 'verified authors') return "verified authors' files";
  if (scope === 'mine + verified authors') return "your files and verified authors'";
  return null;
}

/**
 * The card for one step: its files, or `null` when the step is not a file
 * list, has not finished, failed, its result is not loaded yet, or it found
 * no files. `chatSpace` is the chat's own Space, which gives Go to Space its
 * address when the result names the Space only by name.
 */
export function chatFileList(message: ToolMessage, chatSpace: ConversationSpaceRef | null): ChatFileList | null {
  if (!isFileListStep(message) || message.toolStatus !== 'complete') return null;
  if (message.toolResult?.success === false) return null;
  const data = payload(message.toolResult?.data);
  if (!data || !Array.isArray(data.files)) return null;

  const rows: ChatFileRow[] = [];
  const seen = new Set<number>();
  for (const entry of data.files) {
    const file = record(entry);
    const row = file ? chatFileRow(file) : null;
    if (row && !seen.has(row.id)) {
      seen.add(row.id);
      rows.push(row);
    }
  }
  if (rows.length === 0) return null;

  const pagination = record(data.pagination);
  const counted =
    typeof pagination?.total === 'number' ? pagination.total : typeof data.total === 'number' ? data.total : 0;
  const total = Math.max(counted, rows.length);

  const resultSpace = record(data.space);
  const resultSpaceUuid = text(resultSpace?.uuid);
  const resultSpaceName = text(resultSpace?.name);
  const scope = text(data.scope);
  const spaceName = resultSpaceName ?? scopeSpaceName(scope);

  let space: ConversationSpaceRef | null = null;
  if (resultSpaceUuid && resultSpaceName) space = { uuid: resultSpaceUuid, name: resultSpaceName };
  else if (spaceName && chatSpace && chatSpace.name === spaceName) space = chatSpace;

  return { rows, total, place: placeOf(scope, spaceName), space };
}

/** The card's heading: "8 files". */
export function fileCountLabel(total: number): string {
  return `${total} ${total === 1 ? 'file' : 'files'}`;
}

/**
 * The card's foot, from how many rows it shows: `more` loaded rows the reader
 * can show with a tap, and `unlisted` files the tool counted but did not list.
 */
export function fileListFoot(list: Pick<ChatFileList, 'rows' | 'total'>, expanded: boolean): { more: number; unlisted: number } {
  const shown = expanded ? list.rows.length : Math.min(list.rows.length, FILE_LIST_VISIBLE);
  return { more: list.rows.length - shown, unlisted: list.total - list.rows.length };
}

/** What the panel does with a file of this type today: a placeholder is where the PDF reader and Word pages go. */
export type FilePanelBody = 'picture' | 'video' | 'audio' | 'pdf' | 'word' | 'other';

export function filePanelBody(file: { mime_type?: string | null; original_name?: string | null }): FilePanelBody {
  const view = viewKind({ id: 0, mime_type: file.mime_type, original_name: file.original_name });
  if (view === 'picture') return 'picture';
  if (view === 'video' || view === 'audio') return view;
  const kind = fileKind(file.mime_type ?? undefined);
  const extension = (file.original_name ?? '').toLowerCase().split('.').pop() ?? '';
  if (kind === 'PDF' || extension === 'pdf') return 'pdf';
  if (kind === 'Word' || ['doc', 'docx', 'rtf'].includes(extension) || (file.mime_type ?? '').includes('rtf')) {
    return 'word';
  }
  return 'other';
}
