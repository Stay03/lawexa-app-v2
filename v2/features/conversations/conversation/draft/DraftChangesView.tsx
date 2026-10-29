'use client';

import { useMemo, type ReactNode } from 'react';
import type { JSONContent } from '@tiptap/core';

import { cn } from '@/lib/utils';
import { diffDocs, hasChanges, type DiffMark, type DiffNode } from './draft-diff';
import { markdownToDoc, type DraftFont } from './markdown-to-doc';

/**
 * DraftChangesView — the draft panel with "Show changes" on (Stay, 27 October
 * 2026): this version as written, with what changed since the version before
 * marked in place, read only. Added words are underlined in green, removed
 * words struck through in red, and a paragraph that is new or gone is marked
 * whole with a bar at its side (draft-diff.ts decides what changed).
 *
 * Drawn with the editor's own document classes, so headings, lists, tables,
 * bold and the draft's fonts look as they do in the editor. Links show as text
 * here: this view is for reading the changes, not for leaving the draft.
 *
 * Both versions are compared as Lawexa wrote them. Edits the reader made in
 * the panel are not part of either.
 */
export function DraftChangesView({
  before,
  after,
  font,
  previousNumber,
}: {
  /** The previous version's Markdown. */
  before: string;
  /** This version's Markdown. */
  after: string;
  font: DraftFont;
  /** The previous version's number, for the line above the document. */
  previousNumber: number;
}) {
  const diff = useMemo(() => diffDocs(markdownToDoc(before, font), markdownToDoc(after, font)), [before, after, font]);
  const changed = hasChanges(diff);

  return (
    <div className="space-y-4">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {changed ? (
          <>
            <span>Changes since version {previousNumber}:</span>
            <span>
              <ins className={ADDED_WORDS}>added</ins>
            </span>
            <span>
              <del className={REMOVED_WORDS}>removed</del>
            </span>
          </>
        ) : (
          <span>No changes since version {previousNumber}.</span>
        )}
      </p>
      <DiffDocument diff={diff} />
    </div>
  );
}

/**
 * A compared document, drawn with the editor's own document classes: the
 * "Show changes" view here, and a version against the current text in the
 * draft's version history (DraftHistoryDialog.tsx).
 */
export function DiffDocument({ diff, className }: { diff: DiffNode; className?: string }) {
  return (
    <div
      className={cn(
        'v2-note-fonts v2-draft-doc prose prose-neutral max-w-none dark:prose-invert',
        'text-base leading-relaxed prose-headings:font-semibold prose-headings:tracking-tight',
        '[&_code]:before:content-none [&_code]:after:content-none',
        '[&_.tableWrapper]:my-4 [&_.tableWrapper]:overflow-x-auto [&_.tableWrapper]:overscroll-x-contain',
        '[&_table]:my-0 [&_table]:w-full [&_table]:border-collapse',
        '[&_td]:min-w-[6em] [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top',
        '[&_th]:min-w-[6em] [&_th]:border [&_th]:border-border [&_th]:bg-secondary/50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:align-top',
        className,
      )}
    >
      {(diff.content ?? []).map((node, index) => renderNode(node, `b${index}`))}
    </div>
  );
}

/** Added words: underlined in green, on a faint green (here and in the version history's key). */
export const ADDED_WORDS =
  'rounded-[0.2em] bg-emerald-500/12 px-[0.05em] text-inherit underline decoration-emerald-600 decoration-2 underline-offset-[3px] dark:decoration-emerald-400';
/** Removed words: struck through in red, on a faint red, a little quieter. */
export const REMOVED_WORDS =
  'rounded-[0.2em] bg-red-500/10 px-[0.05em] text-red-700 decoration-red-600 decoration-[1.5px] [text-decoration-line:line-through] dark:text-red-300 dark:decoration-red-400';

/** A whole block that is new or gone: a bar at its side, so it is seen at a glance. */
function blockTone(diff: DiffMark | undefined): string | undefined {
  if (diff === 'add') return 'border-l-[3px] border-emerald-500 pl-3';
  if (diff === 'del') return 'border-l-[3px] border-red-500 pl-3';
  return undefined;
}

function children(node: DiffNode, key: string): ReactNode[] {
  return (node.content ?? []).map((child, index) => renderNode(child, `${key}.${index}`));
}

function renderNode(node: DiffNode, key: string): ReactNode {
  const tone = blockTone(node.diff);
  switch (node.type) {
    case 'paragraph':
      return <p key={key} className={tone}>{children(node, key)}</p>;
    case 'heading': {
      const level = Number(node.attrs?.level ?? 2);
      const Tag = level <= 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
      return <Tag key={key} className={tone}>{children(node, key)}</Tag>;
    }
    case 'bulletList':
      return <ul key={key} className={tone}>{children(node, key)}</ul>;
    case 'orderedList':
      return <ol key={key} className={tone} start={typeof node.attrs?.start === 'number' ? node.attrs.start : undefined}>{children(node, key)}</ol>;
    case 'listItem':
      return <li key={key} className={tone}>{children(node, key)}</li>;
    case 'blockquote':
      return <blockquote key={key} className={tone}>{children(node, key)}</blockquote>;
    case 'codeBlock':
      return <pre key={key} className={tone}><code>{children(node, key)}</code></pre>;
    case 'horizontalRule':
      return <hr key={key} className={tone} />;
    case 'table':
      return (
        <div key={key} className={cn('tableWrapper', tone)}>
          <table>
            <tbody>{children(node, key)}</tbody>
          </table>
        </div>
      );
    case 'tableRow':
      return <tr key={key}>{children(node, key)}</tr>;
    case 'tableHeader':
      return <th key={key}>{children(node, key)}</th>;
    case 'tableCell':
      return <td key={key}>{children(node, key)}</td>;
    case 'hardBreak':
      return <br key={key} />;
    case 'text':
      return renderText(node, key);
    default:
      return <span key={key}>{children(node, key)}</span>;
  }
}

/** A run of text in its marks (bold, italic, fonts…), then marked added or removed. */
function renderText(node: DiffNode, key: string): ReactNode {
  let out: ReactNode = node.text ?? '';
  for (const mark of node.marks ?? []) out = wrapMark(mark, out);
  if (node.diff === 'add') return <ins key={key} className={ADDED_WORDS}>{out}</ins>;
  if (node.diff === 'del') return <del key={key} className={REMOVED_WORDS}>{out}</del>;
  return <span key={key}>{out}</span>;
}

function wrapMark(mark: NonNullable<JSONContent['marks']>[number], inner: ReactNode): ReactNode {
  switch (mark.type) {
    case 'bold':
      return <strong>{inner}</strong>;
    case 'italic':
      return <em>{inner}</em>;
    case 'strike':
      return <s>{inner}</s>;
    case 'underline':
      return <u>{inner}</u>;
    case 'code':
      return <code>{inner}</code>;
    case 'link':
      return <span className="underline decoration-primary/60 underline-offset-2">{inner}</span>;
    case 'fontStyle':
      return (
        <span data-font={mark.attrs?.font ?? undefined} data-size={mark.attrs?.size != null ? String(mark.attrs.size) : undefined}>
          {inner}
        </span>
      );
    default:
      return inner;
  }
}
