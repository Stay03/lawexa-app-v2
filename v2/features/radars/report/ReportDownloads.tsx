'use client';

import { Download, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { RadarExportFormat } from '@/types/radar';
import { useReportDownload } from './use-report-download';

const FORMATS: readonly { format: RadarExportFormat; label: string; extension: string }[] = [
  { format: 'docx', label: 'Word document', extension: '.docx' },
  { format: 'pdf', label: 'PDF', extension: '.pdf' },
];

/**
 * Word and PDF for a space Radar's report, for every member (Backend's B3,
 * 26 October 2026), as one Download menu, the draft panel's export grammar.
 *
 * ONE BUTTON, NOT TWO (Tester, live, 26 October 2026): at 390px the toolbar's
 * Word and PDF buttons pushed Share off the edge, so only "Sh" showed. The
 * menu is an icon on a phone and reads "Download" from `sm:`; the toolbar
 * fits at every width. A failure shows under it in the destructive tone.
 */
export function ReportDownloads({ radarUuid, scanUuid }: { radarUuid: string; scanUuid: string }) {
  const downloads = useReportDownload(radarUuid, scanUuid);
  const busy = downloads.downloading !== null;
  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" aria-label="Download report" aria-busy={busy || undefined}>
            {busy ? (
              <Loader2 aria-hidden className="motion-safe:animate-spin" />
            ) : (
              <Download aria-hidden />
            )}
            <span className="hidden sm:inline">Download</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {FORMATS.map(({ format, label, extension }) => (
            <DropdownMenuItem key={format} disabled={busy} onSelect={() => void downloads.download(format)}>
              <Download aria-hidden className="size-4 text-foreground/62" />
              {label}
              <DropdownMenuShortcut>{extension}</DropdownMenuShortcut>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {downloads.failure ? (
        <p role="alert" className="text-xs text-destructive">
          {downloads.failure}
        </p>
      ) : null}
    </div>
  );
}
