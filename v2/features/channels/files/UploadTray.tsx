'use client';

import { CircleAlert, RotateCcw, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/utils/format-bytes';
import type { UploadEntry, UploadQueue } from './use-upload-queue';

/**
 * UploadTray — the docked strip at the bottom of the Files panel that says
 * what is happening to the files you just handed over.
 *
 * ── ONE COLLAPSE IDIOM, NOT A SECOND ONE ───────────────────────────────────
 * Always mounted, tweening between `grid-rows-[0fr]` and `[1fr]` — the exact
 * symmetric collapse `EnablePushNudge` uses, so both the arrival and the
 * departure play instead of the tray snapping into the panel's layout. Hidden,
 * it is `inert` + `aria-hidden` and occupies exactly zero height, so nothing
 * focusable or announceable sits invisibly under the list. `motion-reduce`
 * drops the tween.
 *
 * ── FOUR ROW STATES, EACH WITH ITS OWN VERB ────────────────────────────────
 *  - `uploading` — a determinate bar and the byte count, with Cancel;
 *  - `finishing` — every byte is on the wire and the server is still working.
 *    An indeterminate shimmer, because there is genuinely nothing left to
 *    measure, and a bar parked at 100 % reads as a hang;
 *  - `failed`    — the server's own sentence, with Retry and Dismiss;
 *  - `rejected`  — refused before it was sent (wrong type, over 15 MB), so it
 *    gets the reason and Dismiss but NO Retry: retrying an unsupported file
 *    spends a round trip to be told exactly the same thing.
 *
 * ── FAILURE IS NOT AN ALARM ────────────────────────────────────────────────
 * The destructive tint colours the GLYPH and nothing else; the sentence stays
 * on `text-foreground`, which measures far past the 4.5:1 floor in both themes
 * where `text-destructive` on a tinted ground does not. This is the same rule
 * `CollabFailure` states, applied to a row instead of a strip. And the tray is
 * bounded by construction — every row is dismissible, and a settled row can be
 * cleared one at a time or all at once — which is what the old unbounded red
 * strip could not do.
 */

const BAR = 'h-1 w-full overflow-hidden rounded-full bg-secondary';

function UploadRow({
  entry,
  onCancel,
  onRetry,
  onDismiss,
}: {
  entry: UploadEntry;
  onCancel: (id: number) => void;
  onRetry: (id: number) => void;
  onDismiss: (id: number) => void;
}) {
  const settled = entry.status === 'failed' || entry.status === 'rejected';
  const percent =
    entry.total > 0 ? Math.min(100, Math.round((entry.sent / entry.total) * 100)) : 0;

  return (
    <li className="flex items-center gap-3 py-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
      {settled ? (
        <CircleAlert aria-hidden className="size-4 shrink-0 text-destructive" />
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <p className="min-w-0 flex-1 truncate text-sm text-foreground" title={entry.name}>
            {entry.name}
          </p>
          {entry.status === 'uploading' ? (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {`${percent}%`}
            </span>
          ) : null}
        </div>

        {settled ? (
          <p className="mt-0.5 text-xs text-foreground/80">{entry.message}</p>
        ) : (
          <div
            className={cn(BAR, 'mt-1.5')}
            role="progressbar"
            aria-label={`Uploading ${entry.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            // Indeterminate while the server finishes: the attribute is
            // OMITTED rather than pinned at 100, which is what tells assistive
            // technology the value is unknown instead of complete.
            aria-valuenow={entry.status === 'uploading' ? percent : undefined}
            aria-valuetext={
              entry.status === 'finishing'
                ? 'Finishing'
                : `${percent}% of ${formatBytes(entry.total)}`
            }
          >
            {entry.status === 'finishing' ? (
              <div className="h-full w-full rounded-full bg-primary/60 motion-safe:animate-pulse" />
            ) : (
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out motion-reduce:transition-none"
                style={{ width: `${percent}%` }}
              />
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {entry.status === 'finishing' ? (
          // No Cancel here, and that is the honest answer: every byte is
          // already on the wire, so aborting would drop the response while the
          // server finished storing the file — the row would vanish and the
          // file would appear in the library a second later.
          <span className="px-1 text-xs text-muted-foreground">Finishing…</span>
        ) : null}
        {entry.retryable ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="v2-interactive h-8"
            onClick={() => onRetry(entry.id)}
          >
            <RotateCcw aria-hidden className="size-3.5" />
            Retry
          </Button>
        ) : null}
        {entry.cancellable ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="v2-interactive size-8 text-muted-foreground hover:text-foreground"
            aria-label={`Cancel upload of ${entry.name}`}
            onClick={() => onCancel(entry.id)}
          >
            <X aria-hidden className="size-4" />
          </Button>
        ) : settled ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="v2-interactive size-8 text-muted-foreground hover:text-foreground"
            aria-label={`Dismiss ${entry.name}`}
            onClick={() => onDismiss(entry.id)}
          >
            <X aria-hidden className="size-4" />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function UploadTray({ queue }: { queue: UploadQueue }) {
  const { entries } = queue;
  const visible = entries.length > 0;
  const settledCount = entries.filter(
    (entry) => entry.status === 'failed' || entry.status === 'rejected',
  ).length;
  const activeCount = entries.length - settledCount;

  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      className={cn(
        'grid shrink-0',
        'transition-[grid-template-rows,opacity] duration-200 ease-out',
        'motion-reduce:transition-none',
        visible ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      )}
    >
      <div className="overflow-hidden">
        <div className="border-t bg-background/95 px-4 py-2 backdrop-blur">
          <div className="mx-auto w-full max-w-3xl">
            <div className="flex items-center justify-between gap-2 pb-1">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {activeCount > 0
                  ? `Uploading ${activeCount} ${activeCount === 1 ? 'file' : 'files'}`
                  : `${settledCount} ${settledCount === 1 ? 'file needs' : 'files need'} attention`}
              </h3>
              {settledCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="v2-interactive h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={queue.dismissSettled}
                >
                  Clear
                </Button>
              ) : null}
            </div>

            {/* Bounded height: a drop of thirty files must not push the list
                off the screen. Beyond four rows the tray scrolls itself. */}
            <ul className="max-h-44 divide-y divide-border/60 overflow-y-auto overscroll-contain">
              {entries.map((entry) => (
                <UploadRow
                  key={entry.id}
                  entry={entry}
                  onCancel={queue.cancel}
                  onRetry={queue.retry}
                  onDismiss={queue.dismiss}
                />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
