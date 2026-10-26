'use client';

import { Download, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { RadarExportFormat } from '@/types/radar';
import { useReportDownload } from './use-report-download';

const FORMATS: readonly { format: RadarExportFormat; label: string; short: string }[] = [
  { format: 'docx', label: 'Download Word', short: 'Word' },
  { format: 'pdf', label: 'Download PDF', short: 'PDF' },
];

/**
 * Word and PDF for a space Radar's report, for every member (Backend's B3,
 * 26 October 2026). Two quiet outline buttons, the draft panel's words; a
 * failure shows under them in the destructive tone.
 */
export function ReportDownloads({ radarUuid, scanUuid }: { radarUuid: string; scanUuid: string }) {
  const downloads = useReportDownload(radarUuid, scanUuid);
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        {FORMATS.map(({ format, label, short }) => (
          <Button
            key={format}
            type="button"
            variant="outline"
            size="sm"
            aria-label={label}
            aria-disabled={downloads.downloading !== null}
            onClick={() => void downloads.download(format)}
          >
            {downloads.downloading === format ? (
              <Loader2 aria-hidden className="motion-safe:animate-spin" />
            ) : (
              <Download aria-hidden />
            )}
            {short}
          </Button>
        ))}
      </div>
      {downloads.failure ? (
        <p role="alert" className="text-xs text-destructive">
          {downloads.failure}
        </p>
      ) : null}
    </div>
  );
}
