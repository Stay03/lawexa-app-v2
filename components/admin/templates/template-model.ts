import type {
  AdminTemplateBulkApprovePayload,
  AdminTemplateBulkApproveResult,
  AdminTemplateDetail,
  AdminTemplateListParams,
  AdminTemplateRefusalReason,
  AdminTemplateRow,
  AdminTemplateStatus,
} from '@/types/admin-templates';

/**
 * The rules of the admin templates page (Stay's go 4 November 2026, thread
 * 2b658111), with no React, so a test pins each one: which files an upload
 * takes, what each status says, where the blanks are in a template's text,
 * whether a draft may go live, and when the list keeps asking for news.
 * Backend's contract is `/api/admin/templates`.
 */

/** Backend's limits: at most 20 files a request, each up to 20 MB, Word, RTF or PDF. */
export const TEMPLATE_UPLOAD = {
  maxFiles: 20,
  maxBytes: 20 * 1024 * 1024,
  extensions: ['docx', 'doc', 'rtf', 'pdf'],
} as const;

/** The file input's accept list. */
export const TEMPLATE_ACCEPT = '.docx,.doc,.rtf,.pdf';

/** Why a file was not uploaded: the server's reasons, and the app's own count check. */
export type TemplateRefusal = AdminTemplateRefusalReason | 'count';

export function refusalSentence(reason: TemplateRefusal): string {
  switch (reason) {
    case 'type':
      return 'Only Word, RTF and PDF files can be templates.';
    case 'size':
      return 'This file is over 20 MB.';
    case 'duplicate':
      return 'This file is already a template.';
    case 'count':
      return `Only ${TEMPLATE_UPLOAD.maxFiles} files go in one upload. Upload this one in the next batch.`;
  }
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/**
 * The files an upload sends, and the ones it holds back with why, before
 * anything goes to the server: a type it does not take, a file over the cap,
 * and anything past the first 20 good files. The server checks again.
 */
export function precheckUpload<F extends { name: string; size: number }>(
  files: readonly F[],
): { send: F[]; refused: { name: string; reason: TemplateRefusal }[] } {
  const send: F[] = [];
  const refused: { name: string; reason: TemplateRefusal }[] = [];
  for (const file of files) {
    if (!(TEMPLATE_UPLOAD.extensions as readonly string[]).includes(extensionOf(file.name))) {
      refused.push({ name: file.name, reason: 'type' });
    } else if (file.size > TEMPLATE_UPLOAD.maxBytes) {
      refused.push({ name: file.name, reason: 'size' });
    } else if (send.length >= TEMPLATE_UPLOAD.maxFiles) {
      refused.push({ name: file.name, reason: 'count' });
    } else {
      send.push(file);
    }
  }
  return { send, refused };
}

/** A file found in a folder, with where it sits in it (`Contracts/Leases/TEST DATA lease.docx`). */
export interface FolderFile<F extends { name: string; size: number } = File> {
  file: F;
  path: string;
}

/**
 * What a folder upload takes (Arthur, 4 November 2026: over 300 templates in
 * folders with subfolders, uploaded in one go): every Word, RTF and PDF file in
 * the folder and its subfolders. Other files are skipped and only counted, and
 * so are Word's lock files (`~$lease.docx`, left beside a document open in
 * Word) and hidden files. A file over the cap is held back and named.
 */
export function sortFolderFiles<F extends { name: string; size: number }>(
  found: readonly FolderFile<F>[],
): { take: FolderFile<F>[]; skipped: number; tooBig: { name: string; reason: TemplateRefusal }[]; folders: number } {
  const take: FolderFile<F>[] = [];
  const tooBig: { name: string; reason: TemplateRefusal }[] = [];
  const folders = new Set<string>();
  let skipped = 0;
  for (const { file, path } of found) {
    const lockOrHidden = file.name.startsWith('~$') || file.name.startsWith('.');
    if (lockOrHidden || !(TEMPLATE_UPLOAD.extensions as readonly string[]).includes(extensionOf(file.name))) {
      skipped += 1;
    } else if (file.size > TEMPLATE_UPLOAD.maxBytes) {
      tooBig.push({ name: path || file.name, reason: 'size' });
    } else {
      take.push({ file, path });
      folders.add(path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
    }
  }
  return { take, skipped, tooBig, folders: folders.size };
}

/** "1 folder", "14 folders". */
export function foldersLabel(count: number): string {
  return count === 1 ? '1 folder' : `${count} folders`;
}

/**
 * The folders a file sits in, the top folder included, as its suggested
 * practice area (Arthur, 4 November 2026: his library is filed by area):
 * `Property/Leases/lease.docx` gives "Property / Leases", and a file directly
 * in a top folder called Property gives "Property". The server takes the
 * nearest name that is one of Lawexa's practice areas, then the one above it,
 * so Leases inside Property becomes Property, and a top folder such as
 * "Library" is passed over. A file dropped loose gives none. Over the
 * server's 255 characters, the folders farthest from the file go first.
 */
export function folderPathOf(path: string): string | null {
  const folders = path
    .split('/')
    .slice(0, -1)
    .map((name) => name.trim())
    .filter((name) => name !== '');
  while (folders.length > 1 && folders.join(FOLDER_PATH_JOIN).length > PRACTICE_AREA_MAX) folders.shift();
  if (folders.length === 0) return null;
  return folders.join(FOLDER_PATH_JOIN).slice(0, PRACTICE_AREA_MAX);
}

/** The longest practice area the server takes, and how a folder path is written in it. */
export const PRACTICE_AREA_MAX = 255;
const FOLDER_PATH_JOIN = ' / ';

/** One request of a folder upload: up to 20 files, and the folder path they go with as their practice area. */
export interface UploadBatch<F> {
  practiceArea: string | null;
  files: F[];
}

/**
 * A folder upload's requests, 20 files at most each. With `byFolder`, the
 * files of one folder go together, its path as their practice area
 * (`folderPathOf`); without it, the files go in the order found, with none.
 */
export function batchesFor<F extends { name: string; size: number }>(
  files: readonly FolderFile<F>[],
  byFolder: boolean,
): UploadBatch<F>[] {
  const groups = new Map<string | null, F[]>();
  for (const { file, path } of files) {
    const area = byFolder ? folderPathOf(path) : null;
    const group = groups.get(area);
    if (group) group.push(file);
    else groups.set(area, [file]);
  }
  const batches: UploadBatch<F>[] = [];
  for (const [practiceArea, group] of groups) {
    for (let at = 0; at < group.length; at += TEMPLATE_UPLOAD.maxFiles) {
      batches.push({ practiceArea, files: group.slice(at, at + TEMPLATE_UPLOAD.maxFiles) });
    }
  }
  return batches;
}

/** The distinct folder paths a folder upload would send, in the order found. */
export function folderAreas(files: readonly { path: string }[]): string[] {
  const areas = new Set<string>();
  for (const { path } of files) {
    const area = folderPathOf(path);
    if (area) areas.add(area);
  }
  return [...areas];
}

/** Where a folder upload has got to. */
export interface BatchProgress {
  total: number;
  sent: number;
  created: number;
  refused: { name: string; reason: TemplateRefusal }[];
}

/**
 * A folder upload: its requests (`batchesFor`) go one after another (no burst
 * against the server), and `onProgress` hears after each. A request that
 * fails stops the run there: the requests before it are uploaded, and
 * `stoppedAt` is the first request still to send.
 */
export async function uploadInBatches<F>(
  batches: readonly UploadBatch<F>[],
  send: (
    files: readonly F[],
    practiceArea: string | null,
  ) => Promise<{ created: readonly unknown[]; refused: readonly { original_name: string; reason: TemplateRefusal }[] }>,
  onProgress: (progress: BatchProgress) => void,
): Promise<BatchProgress & { stoppedAt: number | null; error: unknown }> {
  const total = batches.reduce((sum, batch) => sum + batch.files.length, 0);
  const progress: BatchProgress = { total, sent: 0, created: 0, refused: [] };
  for (let at = 0; at < batches.length; at += 1) {
    const batch = batches[at];
    try {
      const answer = await send(batch.files, batch.practiceArea);
      progress.sent += batch.files.length;
      progress.created += answer.created.length;
      progress.refused = [...progress.refused, ...answer.refused.map((item) => ({ name: item.original_name, reason: item.reason }))];
      onProgress({ ...progress });
    } catch (error) {
      return { ...progress, stoppedAt: at, error };
    }
  }
  return { ...progress, stoppedAt: null, error: null };
}

export const STATUS_LABELS: Record<AdminTemplateStatus, string> = {
  processing: 'Reading',
  draft: 'Draft',
  live: 'Live',
  failed: 'Failed',
};

/** The statuses, in the order the filter offers them. */
export const STATUS_ORDER: readonly AdminTemplateStatus[] = ['draft', 'live', 'processing', 'failed'];

/** While Lawexa reads any template on the page, the list asks again every 5 s. */
export const PROCESSING_POLL_MS = 5000;

export function anyProcessing(rows: readonly Pick<AdminTemplateRow, 'status'>[]): boolean {
  return rows.some((row) => row.status === 'processing');
}

/**
 * A blank, exactly as the server reads one: square brackets around capitals
 * that start with a letter ([PARTY A], [DATE], [PARTY A'S ADDRESS]). A citation
 * like [2020] or a reference like [s. 3] is not one.
 */
export const BLANK_PATTERN = /\[[A-Z][A-Z0-9 _'-]*\]/g;

/** The distinct blanks in a text, in the order they first appear. */
export function blanksIn(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(BLANK_PATTERN)) seen.add(match[0]);
  return [...seen];
}

/** The text cut into plain runs and blanks, for drawing the blanks marked. */
export function blankSegments(text: string): { text: string; blank: boolean }[] {
  const segments: { text: string; blank: boolean }[] = [];
  let at = 0;
  for (const match of text.matchAll(BLANK_PATTERN)) {
    const start = match.index ?? 0;
    if (start > at) segments.push({ text: text.slice(at, start), blank: false });
    segments.push({ text: match[0], blank: true });
    at = start + match[0].length;
  }
  if (at < text.length) segments.push({ text: text.slice(at), blank: false });
  return segments;
}

/** What the review screen edits. */
export interface TemplateFields {
  name: string;
  practice_area: string;
  document_type: string;
  country_id: number | null;
  text: string;
}

export function fieldsOf(detail: Pick<AdminTemplateDetail, 'name' | 'practice_area' | 'document_type' | 'country' | 'text'>): TemplateFields {
  return {
    name: detail.name ?? '',
    practice_area: detail.practice_area ?? '',
    document_type: detail.document_type ?? '',
    country_id: detail.country?.id ?? null,
    text: detail.text ?? '',
  };
}

/** Only the fields that changed, as the server takes them (an empty label is none). */
export function changedFields(saved: TemplateFields, edited: TemplateFields) {
  const payload: { name?: string; practice_area?: string | null; document_type?: string | null; country_id?: number | null; text?: string } = {};
  if (edited.name !== saved.name) payload.name = edited.name.trim();
  if (edited.practice_area !== saved.practice_area) payload.practice_area = edited.practice_area.trim() || null;
  if (edited.document_type !== saved.document_type) payload.document_type = edited.document_type.trim() || null;
  if (edited.country_id !== saved.country_id) payload.country_id = edited.country_id;
  if (edited.text !== saved.text) payload.text = edited.text;
  return payload;
}

/**
 * Why a draft may not go live yet, or `null` when it may: the server's rule
 * (a draft, with a name and a text), said in the admin's words.
 */
export function approveBlocker(status: AdminTemplateStatus, fields: Pick<TemplateFields, 'name' | 'text'>): string | null {
  if (status === 'processing') return 'Lawexa is still reading this file.';
  if (status === 'failed') return 'Reading this file failed. Try again before making it live.';
  if (status === 'live') return null;
  if (!fields.name.trim()) return 'Give the template a name first.';
  if (!fields.text.trim()) return 'The template has no text.';
  return null;
}

/** "3 blanks", "1 blank", "No blanks". */
export function blanksLabel(count: number): string {
  if (count === 0) return 'No blanks';
  return count === 1 ? '1 blank' : `${count} blanks`;
}

/**
 * Bulk approve (Arthur, thread 2b658111, 4 November 2026: approving 300 one by
 * one makes no sense). Only drafts can be ticked: a template being read, one
 * that failed, or one already live has no box. "Select all drafts" takes every
 * draft matching the list's filters, on every page, not only those showing.
 */
export function canTick(row: Pick<AdminTemplateRow, 'status'>): boolean {
  return row.status === 'draft';
}

export type DraftSelection = { kind: 'some'; uuids: ReadonlySet<string> } | { kind: 'all' };

export const NO_SELECTION: DraftSelection = { kind: 'some', uuids: new Set() };

/** Tick or untick one draft. With all drafts selected, untick leaves the rest of this page ticked. */
export function toggleDraft(selection: DraftSelection, uuid: string, pageDrafts: readonly string[]): DraftSelection {
  const current = selection.kind === 'all' ? new Set(pageDrafts) : new Set(selection.uuids);
  if (current.has(uuid)) current.delete(uuid);
  else current.add(uuid);
  return { kind: 'some', uuids: current };
}

/** The header box: ticks every draft on this page, or clears them when they all are. */
export function togglePage(selection: DraftSelection, pageDrafts: readonly string[]): DraftSelection {
  if (selection.kind === 'all') return NO_SELECTION;
  const current = new Set(selection.uuids);
  const allOn = pageDrafts.length > 0 && pageDrafts.every((uuid) => current.has(uuid));
  for (const uuid of pageDrafts) {
    if (allOn) current.delete(uuid);
    else current.add(uuid);
  }
  return { kind: 'some', uuids: current };
}

/** How many the button approves. */
export function selectedCount(selection: DraftSelection, allDrafts: number): number {
  return selection.kind === 'all' ? allDrafts : selection.uuids.size;
}

/** What goes to the server: the ticked uuids, or every draft under the current filters. */
export function bulkApprovePayload(
  selection: DraftSelection,
  params: Pick<AdminTemplateListParams, 'search' | 'practice_area' | 'document_type' | 'country_id'>,
): AdminTemplateBulkApprovePayload {
  if (selection.kind === 'some') return { uuids: [...selection.uuids] };
  const filters: Pick<AdminTemplateListParams, 'search' | 'practice_area' | 'document_type' | 'country_id'> = {};
  if (params.search) filters.search = params.search;
  if (params.practice_area) filters.practice_area = params.practice_area;
  if (params.document_type) filters.document_type = params.document_type;
  if (params.country_id) filters.country_id = params.country_id;
  return { all_drafts: true, ...filters };
}

const SKIP_REASONS: Record<string, string> = {
  not_draft: 'no longer a draft',
  no_name: 'no name yet',
  missing_name: 'no name yet',
  no_text: 'no text',
  missing_text: 'no text',
  processing: 'still being read',
  failed: 'reading failed',
  not_found: 'deleted',
};

/** "12 approved, 3 skipped" and, under it, why: "2 no name yet, 1 still being read". */
export function bulkApproveMessage(result: AdminTemplateBulkApproveResult): { title: string; detail: string | null } {
  const approved = Array.isArray(result.approved) ? result.approved.length : result.approved;
  const skipped = result.skipped.length;
  const title = skipped > 0 ? `${approved} approved, ${skipped} skipped` : approved === 1 ? '1 template is live.' : `${approved} templates are live.`;
  if (skipped === 0) return { title, detail: null };
  const counts = new Map<string, number>();
  for (const { reason } of result.skipped) {
    const label = SKIP_REASONS[reason] ?? reason.replace(/_/g, ' ');
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return { title, detail: [...counts].map(([label, count]) => `${count} ${label}`).join(', ') };
}
