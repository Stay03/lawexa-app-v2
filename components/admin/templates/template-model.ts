import type { AdminTemplateDetail, AdminTemplateRefusalReason, AdminTemplateRow, AdminTemplateStatus } from '@/types/admin-templates';

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
): { take: F[]; skipped: number; tooBig: { name: string; reason: TemplateRefusal }[]; folders: number } {
  const take: F[] = [];
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
      take.push(file);
      folders.add(path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
    }
  }
  return { take, skipped, tooBig, folders: folders.size };
}

/** "1 folder", "14 folders". */
export function foldersLabel(count: number): string {
  return count === 1 ? '1 folder' : `${count} folders`;
}

/** Where a folder upload has got to. */
export interface BatchProgress {
  total: number;
  sent: number;
  created: number;
  refused: { name: string; reason: TemplateRefusal }[];
}

/**
 * A folder upload: the files go 20 to a request, one request after another
 * (the server's cap, and no burst against it), and `onProgress` hears after
 * each. A request that fails stops the run there: the files before it are
 * uploaded, and `stoppedAt` says where to pick up again.
 */
export async function uploadInBatches<F>(
  files: readonly F[],
  send: (batch: readonly F[]) => Promise<{ created: readonly unknown[]; refused: readonly { original_name: string; reason: TemplateRefusal }[] }>,
  onProgress: (progress: BatchProgress) => void,
): Promise<BatchProgress & { stoppedAt: number | null; error: unknown }> {
  const progress: BatchProgress = { total: files.length, sent: 0, created: 0, refused: [] };
  for (let at = 0; at < files.length; at += TEMPLATE_UPLOAD.maxFiles) {
    const batch = files.slice(at, at + TEMPLATE_UPLOAD.maxFiles);
    try {
      const answer = await send(batch);
      progress.sent += batch.length;
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
