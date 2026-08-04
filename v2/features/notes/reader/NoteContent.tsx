'use client';

import { createElement, useMemo, type ReactNode } from 'react';
import Link from 'next/link';

import { CaseMentionLink } from '@/v2/features/conversations/conversation/markdown/CaseMentionLink';
import { parseNoteHtml, type NoteNode, type NoteTag } from './note-html';

/**
 * NoteContent — the note body, as REACT ELEMENTS.
 *
 * There is no `dangerouslySetInnerHTML` in this feature, under any wrapper.
 * `note-html.ts` (pure, no React) turns the stored HTML into a sanitised node
 * tree; this file turns that tree into elements. The split is what makes the
 * safety property checkable: the parser can be read and tested on its own, and
 * this renderer has NO input other than its output — it cannot invent a tag,
 * an attribute or a URL the parser did not already allow.
 *
 * ── THE ELEMENTS CARRY NO ATTRIBUTES ────────────────────────────────────────
 * A block or inline element is created from its tag and its children and
 * nothing else — no `className`, no `style`, no `id`. The reading surface is
 * styled by descendant rules in `note-document.css` (the `case-document.css`
 * precedent: text this component does not emit element-by-element is CSS's
 * job), which means the author's markup can only ever contribute STRUCTURE
 * while the page contributes every pixel of appearance. That is the structural
 * form of the owner's invisible-text fix — there is no attribute channel left
 * for a foreign colour to arrive through.
 *
 * The three node kinds that DO carry props are the three the parser validated:
 * a case mention (a slug), a link (a URL and how to open it), an image (a URL
 * and its alt text). Each is rendered by the component that owns that
 * behaviour, so this file holds no policy of its own.
 *
 * ── THE PARSE IS MEMOISED ON THE HTML STRING ────────────────────────────────
 * One `DOMParser` pass per content string, not per render — a note re-renders
 * whenever its bookmark state flips or its export button spins, and re-walking
 * a long document for those would be waste. The dependency is the string
 * itself, so a save that changes the body re-parses and nothing else does.
 */

/** Tags that must be created WITHOUT a children argument — React rejects any
 *  children on a void element, including an empty array. */
const VOID_TAGS: ReadonlySet<NoteTag> = new Set<NoteTag>(['br', 'hr']);

/**
 * The one link treatment for author-supplied links: the reading ink, marked
 * with a dotted gold underline — a reference mark, not a button. Deliberately
 * NOT a `.v2-note-body a` CSS rule: a case mention renders through
 * `CaseMentionLink`, which brings its own trigger styling, and a descendant
 * rule would have to know that component's class name to stay out of its way.
 */
const LINK_CLASS =
  'rounded-sm underline decoration-primary/45 decoration-dotted underline-offset-4 transition-colors hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export function NoteContent({ html }: { html: string }) {
  const nodes = useMemo(() => parseNoteHtml(html), [html]);
  if (nodes.length === 0) return null;
  return <div className="v2-note-body">{renderNodes(nodes)}</div>;
}

function renderNodes(nodes: readonly NoteNode[]): ReactNode {
  return nodes.map(renderNode);
}

function renderNode(node: NoteNode): ReactNode {
  switch (node.kind) {
    // A bare string inside an array needs no key (React keys elements, not
    // text), and the surrounding elements all carry the parser's stable keys.
    case 'text':
      return node.text;

    case 'element':
      return VOID_TAGS.has(node.tag)
        ? createElement(node.tag, { key: node.key })
        : createElement(node.tag, { key: node.key }, renderNodes(node.children));

    // The SAME component the assistant transcript uses for a case reference —
    // hover-card on a fine pointer, tap-to-preview popover on touch, a plain
    // navigable link before the pointer type resolves. Reused rather than
    // rebuilt so a case link behaves identically wherever a reader meets one.
    // The href is rebuilt from the validated slug (never the author's raw
    // attribute), so what that component re-parses is a canonical case path.
    case 'case':
      return (
        <CaseMentionLink
          key={node.key}
          href={`/cases/${encodeURIComponent(node.slug)}`}
        >
          {renderNodes(node.children)}
        </CaseMentionLink>
      );

    case 'link':
      return <NoteLink key={node.key} node={node} />;

    case 'image':
      return (
        // Plain `<img>`: note images live on whatever host `POST /api/files`
        // returns and authors may embed images from anywhere, so `next/image`
        // would need an open-ended `remotePatterns` allow-list we cannot
        // enumerate — the same rationale as `LawyerCard` and the shell logo.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={node.key}
          src={node.src}
          alt={node.alt}
          // Lazy + async so a note full of figures never blocks the reading,
          // and `h-auto` so a wide image scales instead of overflowing the
          // measure. The alt text is the author's; an image without one is
          // decorative as far as a screen reader is concerned, which is the
          // honest reading of an empty `alt`.
          loading="lazy"
          decoding="async"
          className="my-4 h-auto max-w-full rounded-xl border border-border/60"
        />
      );
  }
}

/**
 * One author-supplied link.
 *
 *  - INTERNAL (`/statutes/…`, `/cases` and friends) → `next/link`, so a
 *    reference inside a note is a client navigation like every other link in
 *    the app.
 *  - EXTERNAL (`http(s)://…`) → a new tab, `rel="noreferrer noopener"` so the
 *    opened page can neither reach back through `window.opener` nor read where
 *    it came from, and `nofollow` because a note is user-authored content.
 *    "opens in a new tab" is said OUT LOUD to a screen reader — a target
 *    change with no announcement is a small trap.
 *  - PROTOCOL (`mailto:` / `tel:`) → a plain anchor, no target: handing off to
 *    the OS must not also leave an empty tab behind.
 */
function NoteLink({
  node,
}: {
  node: Extract<NoteNode, { kind: 'link' }>;
}) {
  const children = renderNodes(node.children);

  if (node.mode === 'internal') {
    return (
      <Link href={node.href} className={LINK_CLASS}>
        {children}
      </Link>
    );
  }

  if (node.mode === 'protocol') {
    return (
      <a href={node.href} className={LINK_CLASS}>
        {children}
      </a>
    );
  }

  return (
    <a
      href={node.href}
      target="_blank"
      rel="noreferrer noopener nofollow"
      className={LINK_CLASS}
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
