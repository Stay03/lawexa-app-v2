/**
 * draft-download — the pure half of Download Word and Download PDF in the
 * draft panel (Stay, 24 October 2026): the request through a given fetcher,
 * and what a failed one says beside the button. Pure, so both are tested
 * without a network.
 *
 * The route is backend's `POST /api/export/document` (2390231a, 24 October
 * 2026). A refusal it can explain is a 422 whose JSON names the field: a draft
 * over 2 MB ("The document is too large to download. It can be at most 2 MB.")
 * or an empty one ("There is nothing in the document to download."). That
 * sentence is shown as it is. The request asks for a file, so an error body
 * arrives as a Blob holding the JSON.
 */
import type { DocumentExportFormat, ExportedFile } from '@/lib/api/export';

export interface DraftFileInput {
  title: string;
  html: string;
  format: DocumentExportFormat;
}

export type DraftFileResult = { ok: true; file: ExportedFile } | { ok: false; failure: string };

/** Signed out or a guest, and too many, by name; anything else as a retry. */
export function downloadFailureSentence(error: unknown): string {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 401 || status === 403) return 'Sign in to download this draft.';
  if (status === 413) return 'This draft is too large to download.';
  if (status === 429) return 'Too many downloads. Try again in a minute.';
  return "Couldn't download the draft. Try again.";
}

/**
 * The server's own sentence on a 422, from `errors.html`, `errors.title` or
 * `errors.format` (each a list), else `message`; null when there is none.
 */
export async function serverRefusal(error: unknown): Promise<string | null> {
  const response = (error as { response?: { status?: number; data?: unknown } } | null)?.response;
  if (response?.status !== 422) return null;
  try {
    const data = response.data;
    const text = data instanceof Blob ? await data.text() : typeof data === 'string' ? data : JSON.stringify(data);
    const body = JSON.parse(text) as { message?: unknown; errors?: Record<string, unknown> };
    for (const field of ['html', 'title', 'format']) {
      const value = body.errors?.[field];
      const first = Array.isArray(value) ? value[0] : value;
      if (typeof first === 'string' && first.trim()) return first.trim();
    }
    return typeof body.message === 'string' && body.message.trim() ? body.message.trim() : null;
  } catch {
    return null;
  }
}

/** One download: the file, or the sentence to show. Never throws. */
export async function fetchDraftFile(
  fetcher: (input: DraftFileInput) => Promise<ExportedFile>,
  input: DraftFileInput,
): Promise<DraftFileResult> {
  try {
    return { ok: true, file: await fetcher(input) };
  } catch (error) {
    return { ok: false, failure: (await serverRefusal(error)) ?? downloadFailureSentence(error) };
  }
}
