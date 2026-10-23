'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, FileType2 } from 'lucide-react';
import { toast } from 'sonner';

import { notesApi } from './api';

/** The two files a note exports to (Stay chose PDF next to Word, 20 October 2026). */
export const NOTE_EXPORT_FORMATS = {
  docx: { label: 'Word document', extension: 'docx', fetch: notesApi.exportDocx, icon: FileText },
  pdf: { label: 'PDF', extension: 'pdf', fetch: notesApi.exportPdf, icon: FileType2 },
} as const;
export type NoteExportFormat = keyof typeof NOTE_EXPORT_FORMATS;
export const NOTE_EXPORT_FORMAT_KEYS = Object.keys(NOTE_EXPORT_FORMATS) as NoteExportFormat[];

/**
 * Download a note as a Word document or a PDF, in place. Shared by the
 * reader's Export menu and the notes list's row menu (23 October 2026).
 *
 * THE ROUTE IS GONE, THE BUTTON REMAINS. v1 had a whole PAGE at
 * `/notes/{slug}/export-docx` whose only job was to fire this request on mount
 * and bounce back — a navigation, a render and a history entry to perform a
 * download. v2 does it in place; the old path stays carved out of the v2
 * manifest so any link to it still resolves against v1.
 *
 * THE OBJECT URL IS REVOKED ON THE NEXT TASK, not immediately after `click()`.
 * The click is dispatched synchronously but the browser's download starts
 * asynchronously, and revoking in the same task cancels it in Firefox — the
 * defect v1's version carries. The timer is cleared on unmount so a reader who
 * navigates mid-export leaves nothing behind.
 *
 * ERRORS ARE NAMED WHERE THE SERVER NAMED THEM: a 403 is "you can't export
 * this one", which is a different sentence from "the download failed", and a
 * reader who sees the generic one will try again forever.
 */
export function useNoteExport(slug: string): {
  download: (format: NoteExportFormat) => Promise<void>;
  exporting: boolean;
} {
  const [exporting, setExporting] = useState(false);
  const revokeRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (revokeRef.current !== null) window.clearTimeout(revokeRef.current);
    },
    [],
  );

  const download = async (format: NoteExportFormat) => {
    if (exporting) return;
    setExporting(true);
    try {
      const blob = await NOTE_EXPORT_FORMATS[format].fetch(slug);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${slug}.${NOTE_EXPORT_FORMATS[format].extension}`;
      anchor.rel = 'noreferrer noopener';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      if (revokeRef.current !== null) window.clearTimeout(revokeRef.current);
      revokeRef.current = window.setTimeout(() => {
        revokeRef.current = null;
        URL.revokeObjectURL(url);
      }, 0);
    } catch (error) {
      const status = (error as { response?: { status?: number } } | null)?.response
        ?.status;
      toast.error(
        status === 403
          ? "You don't have access to export this note."
          : "Couldn't export this note. Please try again.",
      );
    } finally {
      setExporting(false);
    }
  };

  return { download, exporting };
}
