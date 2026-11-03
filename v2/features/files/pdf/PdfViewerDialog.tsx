'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Download, ExternalLink, Loader2, RotateCw } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useOpenFileInNewTab, useShowFileInNewTab } from '@/v2/features/channels/feed/use-file-url';
import { useHeldValue } from '@/v2/features/channels/use-held-value';
import { fileSize } from '@/v2/features/folders/item-row-model';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useBackGuard } from '@/v2/runtime/use-back-guard';
import { ScanReadingStatus } from '../ScanReadingStatus';
import { pageCountLabel } from './pdf-model';
import { passageLabel, stepPassage } from './pdf-passages';
import { PdfReader } from './PdfReader';
import type { PdfViewer, ShownPdf } from './use-pdf-viewer';

/**
 * PdfViewerDialog — the PDF reader's second host (the techlead, 24 October
 * 2026: "every PDF in the app opens in the reader"): a whole screen on a
 * phone, a large dialog on a computer (`ResponsiveOverlay`), over the list a
 * PDF was tapped in. The chat's side panel is the first host (FilePanel).
 *
 * Its bar, at the top of the body and staying there as the pages scroll,
 * carries the reader's zoom, then Download and Open in a new tab. The title
 * is the file's name; under it, "PDF · 2.1 MB · 12 pages" once the reader
 * has counted them. A PDF that cannot be shown says why in the body, with Try
 * again when it can help; the bar's Download stays the way out.
 *
 * The dialog is always in the tree (Radix Presence plays its exit), and the
 * file is held through the exit so the title does not blank as it fades.
 *
 * BACK CLOSES THE READER (the techlead, 24 October 2026: on a phone it is the
 * whole screen, so Back must close it, not leave the page). While it is open
 * the page carries one extra history step (`useBackGuard`, as the quiz form's
 * discard does): Back takes that step and the reader closes. The close button,
 * Escape and the scrim take the step first (`release`), so none leaves it
 * behind.
 *
 * PASSAGES (a Radar report's affected file; Arthur, 3 November 2026): a host
 * may name the places to show, in order. The reader opens on the first with
 * its words marked, and when there are more than one the bar steps through
 * them, saying which it is on ("Passage 2 of 3").
 */
export function PdfViewerDialog({ viewer }: { viewer: ShownPdf }) {
  const backGuard = useBackGuard(viewer.file !== null, viewer.close);
  const file = useHeldValue(viewer.file);
  const [counted, setCounted] = useState<{ id: number; pages: number } | null>(null);
  const pages = file && counted?.id === file.id ? counted.pages : null;
  const size = file?.size ? fileSize(file.size) : null;
  const facts = ['PDF', size, pages === null ? null : pageCountLabel(pages)]
    .filter(Boolean)
    .join(' · ');
  // The passage shown, for this file: another file starts at its first.
  const passages = file?.passages ?? [];
  const [step, setStep] = useState<{ id: number; index: number } | null>(null);
  const last = Math.max(0, passages.length - 1);
  const index = Math.min(file && step?.id === file.id ? step.index : (file?.startPassage ?? 0), last);
  const passage = passages[index] ?? null;
  const stepper =
    file && passages.length > 1 ? (
      <PassageStepper
        index={index}
        count={passages.length}
        onStep={(delta) => setStep({ id: file.id, index: stepPassage(index, passages.length, delta) })}
      />
    ) : null;

  return (
    <ResponsiveOverlay
      open={viewer.file !== null}
      onOpenChange={(open) => {
        if (!open) backGuard.release(viewer.close);
      }}
      title={file?.name ?? 'PDF'}
      description={facts}
      returnFocusTo={viewer.returnTo}
      className="md:h-[calc(100dvh-4rem-var(--keyboard-inset,0px))] md:max-w-5xl"
    >
      {file ? (
        <PdfReader
          key={file.id}
          fileId={file.id}
          name={file.name}
          onPageCount={(count) => setCounted({ id: file.id, pages: count })}
          startPage={passage?.page ?? null}
          passage={passage?.quote ?? null}
          renderControls={(controls) => (
            <PdfBar file={file} stepper={stepper}>
              {controls}
            </PdfBar>
          )}
          fallback={(message, retry) => (
            <>
              <PdfBar file={file} />
              <div role="status" className="flex flex-col items-center gap-4 px-2 py-12 text-center">
                <p className="max-w-md text-sm text-muted-foreground">{message}</p>
                {retry ? (
                  <Button type="button" variant="outline" onClick={retry} className="rounded-full">
                    <RotateCw aria-hidden className="size-4" />
                    Try again
                  </Button>
                ) : null}
              </div>
            </>
          )}
          columnClassName="mx-auto max-w-3xl"
        />
      ) : null}
    </ResponsiveOverlay>
  );
}

/**
 * The reader's bar: its zoom (when the PDF is open), then Download and Open
 * in a new tab. It sticks to the top of the dialog's scrolling body.
 */
function PdfBar({
  file,
  stepper,
  children,
}: {
  file: NonNullable<PdfViewer['file']>;
  /** Back and Next through the passages a host named, when there are several. */
  stepper?: ReactNode;
  children?: ReactNode;
}) {
  const download = useOpenFileInNewTab();
  const show = useShowFileInNewTab();
  const failed = download.failed || show.failed;
  return (
    <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-3 flex w-[calc(100%+2rem)] flex-wrap items-center gap-1 border-b border-border/70 bg-popover/95 px-3 py-1.5 backdrop-blur-sm md:-mx-6 md:mt-0 md:w-[calc(100%+3rem)] md:px-5">
      <div className="flex items-center gap-0.5">{children}</div>
      {stepper}
      <div className="ml-auto flex items-center gap-1">
        {failed ? (
          <span role="status" className="mr-1 text-xs text-muted-foreground">
            {download.gone || show.gone ? 'This file is no longer available.' : 'Couldn’t open it. Try again.'}
          </span>
        ) : null}
        <BarButton
          label={download.ready ? 'Save' : 'Download'}
          busy={download.opening}
          onClick={() =>
            download.ready ? download.save() : download.open(file.id, { name: file.name, type: file.mimeType })
          }
        >
          <Download aria-hidden className="size-4" />
        </BarButton>
        <BarButton label="Open in a new tab" busy={show.opening} onClick={() => show.open(file.id)}>
          <ExternalLink aria-hidden className="size-4" />
        </BarButton>
      </div>
      {/* A scanned PDF's pages being read, on its own line under the controls. */}
      <ScanReadingStatus fileId={file.id} className="basis-full px-1 pb-0.5" />
    </div>
  );
}

function BarButton({
  label,
  busy,
  onClick,
  children,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      className={cn(
        'v2-interactive flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-progress',
        FOCUS_RING,
      )}
    >
      {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : children}
      <span aria-hidden className="hidden sm:inline">
        {label}
      </span>
    </button>
  );
}

/**
 * "Passage 2 of 3" between Previous and Next: the passages a host named, one
 * at a time. The words are announced as they change, so a screen reader hears
 * where a step landed.
 */
function PassageStepper({ index, count, onStep }: { index: number; count: number; onStep: (delta: -1 | 1) => void }) {
  const button = cn(
    'v2-interactive flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40',
    'xl:size-7.5 xl:rounded-lg',
    FOCUS_RING,
  );
  return (
    <div className="flex items-center gap-0.5 border-l border-border/70 pl-1.5">
      <button type="button" onClick={() => onStep(-1)} disabled={index === 0} aria-label="Previous passage" title="Previous passage" className={button}>
        <ChevronUp aria-hidden className="size-4" />
      </button>
      <span aria-live="polite" className="px-1 text-xs font-medium whitespace-nowrap text-muted-foreground tabular-nums">
        {passageLabel(index, count)}
      </span>
      <button type="button" onClick={() => onStep(1)} disabled={index === count - 1} aria-label="Next passage" title="Next passage" className={button}>
        <ChevronDown aria-hidden className="size-4" />
      </button>
    </div>
  );
}
