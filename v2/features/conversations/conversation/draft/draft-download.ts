/**
 * draft-download — the pure half of Download Word and Download PDF in the
 * draft panel (Stay, 24 October 2026): the request through a given fetcher,
 * and what a failed one says beside the button. Pure, so both are tested
 * without a network.
 */
import type { DocumentExportFormat, ExportedFile } from '@/lib/api/export';

export interface DraftFileInput {
  title: string;
  html: string;
  format: DocumentExportFormat;
}

export type DraftFileResult = { ok: true; file: ExportedFile } | { ok: false; failure: string };

/** Signed out, too large and too many by name; anything else as a retry. */
export function downloadFailureSentence(error: unknown): string {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 401) return 'Sign in to download this draft.';
  if (status === 413) return 'This draft is too large to download.';
  if (status === 429) return 'Too many downloads. Try again in a minute.';
  return "Couldn't download the draft. Try again.";
}

/** One download: the file, or the sentence to show. Never throws. */
export async function fetchDraftFile(
  fetcher: (input: DraftFileInput) => Promise<ExportedFile>,
  input: DraftFileInput,
): Promise<DraftFileResult> {
  try {
    return { ok: true, file: await fetcher(input) };
  } catch (error) {
    return { ok: false, failure: downloadFailureSentence(error) };
  }
}
