'use client';

import { useRef, useState, type ComponentProps, type ReactNode } from 'react';
import ReactMarkdown, { type ExtraProps } from 'react-markdown';
import { Check, ChevronsDownUp, ChevronsUpDown, Copy, Download, FileText, Loader2, Maximize2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { copyText } from './copy-text';
import { useDocumentExport } from './document-export';
import type { DocumentExportTarget } from './export-target';
import { downloadDocx } from './download-docx';
import { documentTitle, isLongDocument } from './document-view';
import { DOCUMENT_COMPONENTS, DOCUMENT_REMARK_PLUGINS, documentMarkdown } from './document-markdown';
import '@/v2/features/notes/reader/note-document.css';
import './document-block.css';
import { fenceKind, fenceLanguage } from './fence-kind';

type HastNode = NonNullable<ExtraProps['node']>;
type HastChild = HastNode['children'][number];

/** All the text under a hast node, in order. */
function textOf(node: HastNode | HastChild): string {
  if (node.type === 'text') return node.value;
  if ('children' in node) return node.children.map((child) => textOf(child as HastChild)).join('');
  return '';
}

/**
 * FencedBlock — the chat's `pre` (a fenced block, three backticks). A fence
 * the AI used for a DOCUMENT (a court form, a letter, a clause: no tag, or
 * text / md) renders as a document block; a fence of real code keeps the code
 * look exactly as before (fence-kind.ts holds the rule and the prose-vs-code
 * test).
 *
 * The document block reads like a note (Stay, 8 October 2026): its markdown
 * renders with the notes' reading styles (headings, bold, lists), while a form
 * with no markdown keeps every line, indent and signature line as typed
 * (document-markdown.ts holds the rules the Word export shares). Its header
 * carries the document's first line as a title and icon buttons (Fold, Copy,
 * Download as Word, Maximize; labels on hover). Download asks the API for
 * this block of the SAVED answer (document-export.tsx says when a block can);
 * without a saved answer it is not shown. A long document opens folded with
 * "Show all" (document-view.ts); Maximize opens a full-height reader with larger type.
 * Colours come from the theme tokens (card, border, muted), so it holds in
 * light and dark. Corners: the block uses the app's Card corner (rounded-2xl),
 * the same as a code block in an answer (MarkdownText), and the reader keeps
 * the app's dialog corner.
 */
export function FencedBlock({ node, children, ...rest }: ComponentProps<'pre'> & ExtraProps) {
  const code = node?.children.find((child) => child.type === 'element' && child.tagName === 'code');
  const language = code && code.type === 'element' ? fenceLanguage(code.properties.className) : '';
  const text = code ? textOf(code).replace(/\n$/, '') : '';

  if (!code || fenceKind(language, text) === 'code') return <pre {...rest}>{children}</pre>;
  return <DocumentBlock text={text} />;
}

function DocumentBlock({ text }: { text: string }) {
  const title = documentTitle(text) || 'Document';
  const long = isLongDocument(text);
  const [folded, setFolded] = useState(long);
  const [maximized, setMaximized] = useState(false);
  const exportTarget = useDocumentExport(text);
  const readerRef = useRef<HTMLDivElement>(null);

  return (
    <figure className="not-prose my-4 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-xs">
      <figcaption className="flex items-center gap-2 border-b border-border/70 py-1 pl-3 pr-1">
        <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground" title={title}>
          {title}
        </span>
        <div className="flex shrink-0 items-center">
          {long ? (
            <IconAction label={folded ? 'Show all' : 'Fold'} onClick={() => setFolded((f) => !f)}>
              {folded ? <ChevronsUpDown className="size-3.5" /> : <ChevronsDownUp className="size-3.5" />}
            </IconAction>
          ) : null}
          <CopyAction text={text} />
          {exportTarget ? <DownloadAction target={exportTarget} /> : null}
          <IconAction label="Maximize" onClick={() => setMaximized(true)}>
            <Maximize2 className="size-3.5" />
          </IconAction>
        </div>
      </figcaption>

      <div className={cn('relative', folded && 'max-h-80 overflow-hidden')}>
        <DocumentBody text={text} className="px-5 py-4" />
        {folded ? (
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-center bg-gradient-to-t from-card via-card/90 to-transparent pb-3 pt-16">
            <button
              type="button"
              onClick={() => setFolded(false)}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Show all
            </button>
          </div>
        ) : null}
      </div>

      <Dialog open={maximized} onOpenChange={setMaximized}>
        <DialogContent
          showCloseButton={false}
          // Focus the text, not the first button: a focused button opens its
          // tooltip, and the first Esc then closes only the tooltip (seen in
          // the 7 October pictures). Focused text also scrolls with the keys.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            readerRef.current?.focus();
          }}
          // A phone gets the whole screen, edge to edge, no corners (Stay,
          // 8 October); from sm up it stays a centred dialog with the app's
          // dialog corner. `max-h-dvh` lifts the dialog's own 100dvh-2rem
          // ceiling (components/ui/dialog.tsx), which left a band above and
          // below. The safe-area paddings keep the bar and the last line
          // clear of the notch and the home bar.
          className="flex h-dvh max-h-dvh max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 ring-0 sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:max-w-3xl sm:rounded-4xl sm:ring-1"
        >
          <div className="flex items-center gap-2 border-b border-border px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:pt-2">
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <DialogTitle className="min-w-0 flex-1 truncate text-sm font-medium">{title}</DialogTitle>
            <DialogDescription className="sr-only">The full document from this answer.</DialogDescription>
            <CopyAction text={text} />
            {exportTarget ? <DownloadAction target={exportTarget} /> : null}
            <IconAction label="Close" onClick={() => setMaximized(false)}>
              <X className="size-4" />
            </IconAction>
          </div>
          <div ref={readerRef} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none">
            <DocumentBody
              text={text}
              reader
              className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pb-6"
            />
          </div>
        </DialogContent>
      </Dialog>
    </figure>
  );
}

/**
 * The document's text, rendered as a note body. In the answer it is set at the
 * chat's size; in the reader (`reader`) at the notes' own size and measure.
 */
function DocumentBody({ text, reader = false, className }: { text: string; reader?: boolean; className?: string }) {
  return (
    <div className={cn('v2-note-doc v2-doc-block', reader && 'v2-doc-reader', className)}>
      <div className="v2-note-body">
        <ReactMarkdown remarkPlugins={DOCUMENT_REMARK_PLUGINS} components={DOCUMENT_COMPONENTS}>
          {documentMarkdown(text)}
        </ReactMarkdown>
      </div>
    </div>
  );
}

const ACTION_CLASS =
  'inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** An icon button whose label shows on hover and is read by screen readers. */
function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={onClick} className={ACTION_CLASS} aria-label={label}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Download as Word (the API's export route). One request at a time; a failure says why. */
function DownloadAction({ target }: { target: DocumentExportTarget }) {
  const [busy, setBusy] = useState(false);
  const onDownload = async () => {
    if (busy) return;
    setBusy(true);
    const problem = await downloadDocx(target);
    setBusy(false);
    if (problem) toast.error(problem);
  };
  return (
    <IconAction label={busy ? 'Preparing the Word file' : 'Download as Word'} onClick={() => void onDownload()}>
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
    </IconAction>
  );
}

function CopyAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (!(await copyText(text))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <IconAction label={copied ? 'Copied' : 'Copy'} onClick={() => void onCopy()}>
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </IconAction>
  );
}
