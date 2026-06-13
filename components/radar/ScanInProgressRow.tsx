import { Loader2 } from 'lucide-react';

interface ScanInProgressRowProps {
  /** First-ever scan for this radar — tweaks the copy slightly. */
  firstScan?: boolean;
}

/**
 * A live, pulsing inbox row for a queued/running scan, rendered where its
 * report will land so the in-flight state is part of the list rather than a
 * floating banner.
 */
function ScanInProgressRow({ firstScan = false }: ScanInProgressRowProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <span className="relative flex size-2 shrink-0" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {firstScan ? 'Running the first scan…' : 'Scanning…'}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Investigating the web and Lawexa — your report lands here shortly
        </p>
      </div>
      <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
    </div>
  );
}

export { ScanInProgressRow };
