'use client';

import { useEffect, useRef, useState } from 'react';

import { spaceRadarsApi } from '@/lib/api/radars';
import { extractApiError } from '@/lib/utils/api-error';
import type { RadarExportFormat } from '@/types/radar';

/**
 * useReportDownload — a space Radar's report as Word or PDF (Backend's B3,
 * 26 October 2026: `GET /radars/{radar}/scans/{scan}/export?format=…`, any
 * member of the space, 20 a minute, nothing stored). The file reaches the
 * browser as a draft's download does (`use-draft-download`): an object URL
 * and an anchor click, the URL revoked on the next task so the download is
 * not cancelled, the timer cleared on unmount. One download at a time; a
 * failure says why beside the buttons, never in a toast.
 */
export function useReportDownload(radarUuid: string, scanUuid: string) {
  const [downloading, setDownloading] = useState<RadarExportFormat | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const busyRef = useRef(false);
  const revokeRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (revokeRef.current !== null) window.clearTimeout(revokeRef.current);
    },
    [],
  );

  const download = async (format: RadarExportFormat) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setDownloading(format);
    setFailure(null);
    try {
      const file = await spaceRadarsApi.exportScan(radarUuid, scanUuid, format);
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.filename;
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
      setFailure(downloadFailure(extractApiError(error).status));
    } finally {
      busyRef.current = false;
      setDownloading(null);
    }
  };

  return { download, downloading, failure };
}

/** What a failed download says, by the answer's status. */
export function downloadFailure(status: number | undefined): string {
  if (status === 429) return 'Too many downloads in a minute. Try again shortly.';
  if (status === 403 || status === 404) return 'This report is no longer available to download.';
  return "The file didn't download. Try again.";
}
