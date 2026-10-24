'use client';

import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';

import { exportApi, type DocumentExportFormat } from '@/lib/api/export';
import { fetchDraftFile } from './draft-download';

/**
 * useDraftDownload — Download Word and Download PDF from the draft panel,
 * before the draft is a note (Stay, 24 October 2026: "That save as note should
 * be a drop-down of 'save note, download docx, download pdf'"). The file is
 * made from what the editor holds now; no note is made. One state for the
 * computer's menu and the phone sheet's foot, through `useDraftSave`.
 *
 * One download at a time: a second press while one runs does nothing. The
 * file reaches the browser as the note page's export does (use-note-export):
 * an object URL and an anchor click, the URL revoked on the next task so the
 * download is not cancelled, the timer cleared on unmount. A failed download
 * says why beside the button, never in a toast.
 */
export function useDraftDownload(editor: Editor | null, title: string) {
  const [downloading, setDownloading] = useState<DocumentExportFormat | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const busyRef = useRef(false);
  const revokeRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (revokeRef.current !== null) window.clearTimeout(revokeRef.current);
    },
    [],
  );

  const download = async (format: DocumentExportFormat) => {
    if (!editor || busyRef.current) return;
    busyRef.current = true;
    setDownloading(format);
    setFailure(null);
    const result = await fetchDraftFile(exportApi.document, { title, html: editor.getHTML(), format });
    busyRef.current = false;
    setDownloading(null);
    if (!result.ok) {
      setFailure(result.failure);
      return;
    }
    const url = URL.createObjectURL(result.file.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = result.file.filename;
    anchor.rel = 'noreferrer noopener';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    if (revokeRef.current !== null) window.clearTimeout(revokeRef.current);
    revokeRef.current = window.setTimeout(() => {
      revokeRef.current = null;
      URL.revokeObjectURL(url);
    }, 0);
  };

  return { download, downloading, failure };
}

export type DraftDownload = ReturnType<typeof useDraftDownload>;
