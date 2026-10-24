'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Minus, Plus } from 'lucide-react';
import type { PDFDocumentProxy, RenderTask, TextLayer } from 'pdfjs-dist/legacy/build/pdf.mjs';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { filesQueries } from '../queries';
import { loadPdfJs } from './load-pdfjs';
import {
  canZoomIn,
  canZoomOut,
  canvasRatio,
  pageScale,
  pdfFailure,
  zoomIn,
  zoomLabel,
  zoomOut,
  type PdfFailure,
} from './pdf-model';
import './pdf-reader.css';

/**
 * PdfReader — a PDF read in the app, page under page (the in-app PDF reader,
 * the file list in chat piece b; Stay, 24 October 2026, pdf.js). One reader
 * for every PDF: a host gives it a file id and says where its zoom controls
 * go and what stands in when the PDF cannot be shown.
 *
 * THE BYTES come from the file's own read: a link that shows it
 * (`filesQueries.inlineUrl`, `GET /files/{id}/download?inline=1`), fetched by
 * pdf.js without cookies, as the share sheet's fetch already does. A link
 * that has expired (400 or 403 from the file host) is asked for once more.
 *
 * pdf.js IS LOADED WHEN THE READER MOUNTS (load-pdfjs.ts) and never before.
 *
 * EACH PAGE IS DRAWN WHEN IT COMES NEAR THE SCREEN, on its own canvas, with
 * pdf.js's text layer over it so its words can be selected; a page that
 * scrolls far away gives its canvas back, which keeps a long PDF from filling
 * a phone's memory. Until a page has been read, its box takes the first
 * page's shape, so the column does not jump as pages arrive.
 *
 * ZOOM is a multiple of fit width (pdf-model.ts): minus, the middle control
 * (back to fit), plus. Above fit, the column scrolls sideways.
 */
export function PdfReader({
  fileId,
  name,
  onPageCount,
  renderControls,
  fallback,
  className,
  columnClassName,
}: {
  fileId: number;
  /** The file's name, for the pages' accessible names. */
  name: string;
  /** Called once the PDF is open, with its number of pages. */
  onPageCount?: (count: number) => void;
  /** Where the zoom controls go (a panel's header, a dialog's bar); called
   *  with `null` until the PDF is open. Left out, they sit above the pages. */
  renderControls?: (controls: ReactNode | null) => ReactNode;
  /** What shows when the PDF cannot be shown: the sentence, and Try again when it can help. */
  fallback: (message: string, retry: (() => void) | null) => ReactNode;
  className?: string;
  /** The pages' column, inside the reader (its width, its padding). */
  columnClassName?: string;
}) {
  const link = useQuery(filesQueries.inlineUrl(fileId));
  const [relinked, setRelinked] = useState(false);
  // Each Try again opens the document afresh, even on the same link.
  const [attempt, setAttempt] = useState(0);
  const url = link.data?.data?.url ?? null;
  const again = () => {
    void link.refetch().finally(() => setAttempt((count) => count + 1));
  };

  if (link.isError) return <>{fallback('The PDF did not load. Try again, or download it.', again)}</>;
  if (url === null) {
    return (
      <div className={cn('flex min-h-full flex-col', className)}>
        {renderControls ? renderControls(null) : null}
        <PdfSkeleton className={columnClassName} />
      </div>
    );
  }

  return (
    <PdfDocumentView
      key={`${url}#${attempt}`}
      url={url}
      name={name}
      onPageCount={onPageCount}
      renderControls={renderControls}
      className={className}
      columnClassName={columnClassName}
      fallback={fallback}
      onExpired={
        relinked
          ? null
          : () => {
              setRelinked(true);
              again();
            }
      }
      onRetry={again}
    />
  );
}

type DocumentState =
  | { status: 'loading' }
  | { status: 'ready'; doc: PDFDocumentProxy; pageWidth: number; pageHeight: number }
  | { status: 'failed'; failure: PdfFailure };

/** One open of one link: the document, its pages and its zoom. */
function PdfDocumentView({
  url,
  name,
  onPageCount,
  renderControls,
  className,
  columnClassName,
  fallback,
  onExpired,
  onRetry,
}: {
  url: string;
  name: string;
  onPageCount?: (count: number) => void;
  renderControls?: (controls: ReactNode | null) => ReactNode;
  className?: string;
  columnClassName?: string;
  fallback: (message: string, retry: (() => void) | null) => ReactNode;
  /** Ask for a fresh link, once; `null` once it has been asked. */
  onExpired: (() => void) | null;
  onRetry: () => void;
}) {
  const [state, setState] = useState<DocumentState>({ status: 'loading' });
  const [zoom, setZoom] = useState(1);
  const [columnWidth, setColumnWidth] = useState(0);
  const columnRef = useRef<HTMLDivElement | null>(null);
  // Read in the load's callbacks, which outlive the render that made them.
  const onPageCountRef = useRef(onPageCount);
  const onExpiredRef = useRef(onExpired);
  useLayoutEffect(() => {
    onPageCountRef.current = onPageCount;
    onExpiredRef.current = onExpired;
  });

  // Open the document. Every state change is in a promise's callback, and the
  // cleanup destroys the load, so a closed panel stops its download.
  useEffect(() => {
    let live = true;
    let destroy: (() => void) | null = null;
    loadPdfJs()
      .then((pdfjs) => {
        if (!live) return;
        const task = pdfjs.getDocument({ url, withCredentials: false });
        destroy = () => void task.destroy();
        return task.promise.then(async (doc) => {
          const first = await doc.getPage(1);
          const { width, height } = first.getViewport({ scale: 1 });
          if (!live) return;
          setState({ status: 'ready', doc, pageWidth: width, pageHeight: height });
          onPageCountRef.current?.(doc.numPages);
        });
      })
      .catch((error: unknown) => {
        if (!live) return;
        const failure = pdfFailure(error);
        const expired = onExpiredRef.current;
        if (failure.kind === 'relink' && expired) {
          expired();
          return;
        }
        setState({ status: 'failed', failure });
      });
    return () => {
      live = false;
      destroy?.();
    };
  }, [url]);

  // The column's width, for fit width.
  useEffect(() => {
    const column = columnRef.current;
    if (!column) return;
    const observer = new ResizeObserver(([entry]) => setColumnWidth(Math.floor(entry.contentRect.width)));
    observer.observe(column);
    return () => observer.disconnect();
  }, []);

  if (state.status === 'failed') {
    return <>{fallback(state.failure.message, state.failure.retry ? onRetry : null)}</>;
  }

  const controls = state.status === 'ready' ? <ZoomControls zoom={zoom} onZoom={setZoom} /> : null;

  return (
    <div className={cn('flex min-h-full flex-col', className)}>
      {renderControls ? (
        renderControls(controls)
      ) : controls ? (
        <div className="flex justify-end gap-1 px-3 pt-2">{controls}</div>
      ) : null}
      <div ref={columnRef} className={cn('w-full', columnClassName)}>
        {state.status === 'loading' ? (
          <PdfSkeleton />
        ) : (
          <div className="overflow-x-auto pb-6">
            <div className="flex w-max min-w-full flex-col gap-4 py-1">
              {Array.from({ length: state.doc.numPages }, (_, index) => (
                <PdfPageView
                  key={index + 1}
                  doc={state.doc}
                  pageNumber={index + 1}
                  name={name}
                  count={state.doc.numPages}
                  scale={pageScale(columnWidth, state.pageWidth, zoom)}
                  fallbackWidth={state.pageWidth}
                  fallbackHeight={state.pageHeight}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * One page: its box at its size from the start, its canvas and text drawn
 * while it is near the screen. Drawing is cancelled when the page leaves, the
 * scale changes or the reader closes.
 */
function PdfPageView({
  doc,
  pageNumber,
  name,
  count,
  scale,
  fallbackWidth,
  fallbackHeight,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  name: string;
  count: number;
  scale: number;
  /** The first page's size in points, until this page has been read. */
  fallbackWidth: number;
  fallbackHeight: number;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(pageNumber <= 2);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [drawn, setDrawn] = useState(false);

  const width = (size?.width ?? fallbackWidth) * scale;
  const height = (size?.height ?? fallbackHeight) * scale;

  // The box's size, written before paint, as variables the stylesheet reads.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    box.style.setProperty('--pdf-page-w', `${Math.floor(width)}px`);
    box.style.setProperty('--pdf-page-h', `${Math.floor(height)}px`);
    box.style.setProperty('--total-scale-factor', String(scale));
  }, [width, height, scale]);

  // Near the screen: within about two screens of it.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
      rootMargin: '150% 0px',
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const text = textRef.current;
    if (!canvas || !text) return;
    if (!near) {
      // Far away: give the canvas's memory back; it is drawn again on return.
      canvas.width = 0;
      canvas.height = 0;
      text.replaceChildren();
      return;
    }
    let live = true;
    let renderTask: RenderTask | null = null;
    let textLayer: TextLayer | null = null;
    Promise.all([doc.getPage(pageNumber), loadPdfJs()])
      .then(async ([page, pdfjs]) => {
        if (!live) return;
        const own = page.getViewport({ scale: 1 });
        setSize((current) =>
          current && current.width === own.width && current.height === own.height
            ? current
            : { width: own.width, height: own.height },
        );
        const viewport = page.getViewport({ scale });
        const ratio = canvasRatio(viewport.width, viewport.height, window.devicePixelRatio);
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        renderTask = page.render({
          canvas,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        await renderTask.promise;
        if (!live) return;
        setDrawn(true);
        text.replaceChildren();
        textLayer = new pdfjs.TextLayer({
          textContentSource: page.streamTextContent(),
          container: text,
          viewport,
        });
        await textLayer.render();
      })
      .catch(() => {
        // A cancelled draw is the normal end of a page that scrolled away or
        // was zoomed; a page that will not draw keeps its white box.
      });
    return () => {
      live = false;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [doc, pageNumber, scale, near]);

  return (
    <div
      ref={boxRef}
      role="group"
      aria-label={`${name}, page ${pageNumber} of ${count}`}
      className="v2-pdf-page shrink-0"
    >
      {!drawn ? <Skeleton aria-hidden className="absolute inset-0 rounded-none bg-neutral-100" /> : null}
      <canvas ref={canvasRef} aria-hidden />
      <div ref={textRef} className="textLayer" />
    </div>
  );
}

/** Minus, Fit, plus: the reader's three zoom controls. */
function ZoomControls({ zoom, onZoom }: { zoom: number; onZoom: (zoom: number) => void }) {
  return (
    <>
      <ZoomButton label="Zoom out" disabled={!canZoomOut(zoom)} onClick={() => onZoom(zoomOut(zoom))}>
        <Minus aria-hidden className="size-4" />
      </ZoomButton>
      <button
        type="button"
        onClick={() => onZoom(1)}
        aria-label={zoom === 1 ? 'Fit to width (now)' : `Fit to width (now ${zoomLabel(zoom)})`}
        className={cn(
          'v2-interactive h-9 shrink-0 rounded-full px-2 text-xs font-medium text-muted-foreground tabular-nums transition-colors hover:bg-secondary hover:text-foreground',
          'xl:h-7.5 xl:rounded-lg xl:text-[12.5px] xl:text-foreground/62 xl:hover:bg-foreground/6 dark:xl:hover:bg-white/7',
          FOCUS_RING,
        )}
      >
        {zoomLabel(zoom)}
      </button>
      <ZoomButton label="Zoom in" disabled={!canZoomIn(zoom)} onClick={() => onZoom(zoomIn(zoom))}>
        <Plus aria-hidden className="size-4" />
      </ZoomButton>
    </>
  );
}

function ZoomButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'v2-interactive flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40',
        'xl:size-7.5 xl:rounded-lg xl:text-foreground/62 xl:hover:bg-foreground/6 dark:xl:hover:bg-white/7',
        FOCUS_RING,
      )}
    >
      {children}
    </button>
  );
}

/** The wait: a page-shaped sheet with a spinner, in the reader's column. */
function PdfSkeleton({ className }: { className?: string }) {
  return (
    <div role="status" aria-label="Opening the PDF" className={cn('flex flex-col items-center gap-3 py-1', className)}>
      <div className="v2-pdf-page flex w-full items-center justify-center">
        <Loader2 aria-hidden className="size-5 animate-spin text-neutral-400 motion-reduce:animate-none" />
      </div>
    </div>
  );
}
