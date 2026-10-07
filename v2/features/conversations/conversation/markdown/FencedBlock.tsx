'use client';

import { useState, type ComponentProps } from 'react';
import type { ExtraProps } from 'react-markdown';
import { Check, Copy, FileText } from 'lucide-react';
import { copyText } from './copy-text';
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
 * The document block reads like the answer around it: the chat's font, lines
 * that wrap on a phone, and the AI's line breaks and indents kept
 * (`whitespace-pre-wrap`) for form headings and signature lines. A light page
 * border and a Copy button mark it as the document to take away. Colours come
 * from the theme tokens (card, border, muted), so it holds in light and dark.
 */
export function FencedBlock({ node, children, ...rest }: ComponentProps<'pre'> & ExtraProps) {
  const code = node?.children.find((child) => child.type === 'element' && child.tagName === 'code');
  const language = code && code.type === 'element' ? fenceLanguage(code.properties.className) : '';
  const text = code ? textOf(code).replace(/\n$/, '') : '';

  if (!code || fenceKind(language, text) === 'code') return <pre {...rest}>{children}</pre>;
  return <DocumentBlock text={text} />;
}

function DocumentBlock({ text }: { text: string }) {
  return (
    <figure className="not-prose my-4 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xs">
      <figcaption className="flex items-center justify-between gap-2 border-b border-border/70 bg-muted/40 py-1 pl-3 pr-1">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <FileText className="size-3.5" aria-hidden />
          Document
        </span>
        <CopyDocumentButton text={text} />
      </figcaption>
      <div className="whitespace-pre-wrap break-words px-4 py-3 text-sm leading-relaxed">{text}</div>
    </figure>
  );
}

function CopyDocumentButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (!(await copyText(text))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={copied ? 'Document copied' : 'Copy document'}
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
