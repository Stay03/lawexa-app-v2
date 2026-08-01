'use client';

import { memo, type ReactNode } from 'react';

import { aknAnchorId, childByLocal, localName, type AknBlock } from './akn';
import { SectionCopyLink } from './SectionLink';

/**
 * AknNode — the hardened rewrite of v1's `AknElementRenderer`.
 *
 * ── THE HARDENING, CONCRETELY ───────────────────────────────────────────────
 * v1 had NINE `dangerouslySetInnerHTML` sites, injecting semi-trusted admin
 * XML (`element.innerHTML` of `<p>`, `<th>`, `<td>`, whole `<ul>` subtrees)
 * into a public reader unsanitised. This renderer has ZERO: every text node
 * becomes a React string (React escapes it), every element becomes a React
 * element from a fixed vocabulary, and anything unrecognised degrades to its
 * text — markup can never smuggle handlers or scripts because no markup
 * string is ever handed to the DOM. That also removed the sanitiser
 * dependency question entirely.
 *
 * Other v1 defects fixed here: namespace-unsafe `querySelector(':scope > …')`
 * lookups (now `localName` walks), the double-`<div>` wrappers, `<table>`
 * rows without a `<tbody>` (a React DOM-nesting warning), no
 * `thead`/`caption` handling, tables blowing out mobile (now wrapped in an
 * `overflow-x-auto` scroller), and the hanging-indent-by-text-indent hack
 * (now a real two-column grid: num in the gutter, body in the column —
 * which also makes wide roman-numeral nums like "(viii)" lay out correctly).
 *
 * ── SHAPE ───────────────────────────────────────────────────────────────────
 * `AknBlockView` (memoized — the ONLY component boundary, so a progressive-
 * mount batch append reconciles mounted blocks in O(blocks) reference checks)
 * renders one `AknBlock`; everything below it is plain function recursion
 * over the immutable parsed DOM. All styling comes from `statute-document.css`
 * (`.v2-statute-doc` scope, theme tokens).
 */

/* ── Vocabulary ──────────────────────────────────────────────────────────── */

/** Numbered blocks: num in the gutter, everything else in the body column. */
const NUMBERED = new Set([
  'subsection',
  'paragraph',
  'subparagraph',
  'item',
  'point',
  'clause',
  'subclause',
  'rule',
  'subrule',
  'article',
  'regulation',
  'transitional',
]);

/** Pure containers — render children, add nothing. */
const CONTAINERS = new Set([
  'content',
  'intro',
  'wrapup',
  'blocklist',
  'blockcontainer',
  'hcontainer',
  'body',
  'mainbody',
  'doc',
  'attachment',
  'attachments',
  'preface',
  'preamble',
  'conclusions',
  'act',
  'akomantoso',
]);

/** Inline phrase-level elements a `<p>` can carry. */
const INLINE_MAP: Record<string, 'strong' | 'em' | 'u' | 'sup' | 'sub'> = {
  b: 'strong',
  i: 'em',
  u: 'u',
  sup: 'sup',
  sub: 'sub',
};

/* ── The block component (the memo boundary) ─────────────────────────────── */

export const AknBlockView = memo(function AknBlockView({
  block,
}: {
  block: AknBlock;
}) {
  if (block.kind === 'division') {
    return (
      <DivisionHeading
        element={block.element}
        depth={block.depth}
        id={block.id ?? undefined}
      />
    );
  }

  if (block.kind === 'crossheading') {
    return (
      <p id={block.id ?? undefined} className="akn-block akn-crossheading">
        {renderInlineChildren(block.element)}
      </p>
    );
  }

  return (
    <div
      id={block.id ?? undefined}
      // `akn-cv` = content-visibility: auto — offscreen body blocks skip
      // layout and paint entirely (the big-document lever, with progressive
      // mounting). Division headings stay always-rendered: they are tiny,
      // and keeping them laid out makes outline jumps land exactly.
      className="akn-block akn-cv"
    >
      {renderElement(block.element, 0, true)}
    </div>
  );
});

/** A part/chapter/schedule heading: label voice num over a serif heading. */
function DivisionHeading({
  element,
  depth,
  id,
}: {
  element: Element;
  depth: number;
  id?: string;
}) {
  const num = childByLocal(element, 'num');
  const heading = childByLocal(element, 'heading');
  const subheading = childByLocal(element, 'subheading');
  // All three are lifted by the walk (`labelsLifted`), so ANY present label
  // must render here or it renders nowhere.
  if (!num && !heading && !subheading) return null;

  return (
    <div id={id} className="akn-block akn-division" data-depth={depth > 0 ? 1 : 0}>
      {num ? <p className="akn-division-num">{num.textContent}</p> : null}
      {heading ? (
        <h2 className="akn-division-heading">{renderInlineChildren(heading)}</h2>
      ) : null}
      {subheading ? (
        <p className="akn-division-sub">{renderInlineChildren(subheading)}</p>
      ) : null}
    </div>
  );
}

/* ── Element recursion ───────────────────────────────────────────────────── */

/**
 * `blockRoot` is true ONLY for the element a block wrapper renders directly:
 * the wrapper already carries that element's `akn-{eId}` id (the spy's and the
 * jump machinery's target), so the root must not stamp it again — a duplicate
 * DOM id. Every NESTED provision (a subsection under its section) stamps its
 * own eId anchor instead, which is what lets a deep link land on it.
 */
function renderElement(
  element: Element,
  keyIndex: number,
  blockRoot = false,
): ReactNode {
  const tag = localName(element);
  const key = keyIndex;

  // A `num` that reaches this dispatch was NOT lifted by any consumer
  // (SectionView, NumberedBlock and DivisionHeading all exclude the nums
  // they consume) — render it rather than drop it: a number is law text.
  if (tag === 'num') {
    return (
      <span key={key} className="akn-num">
        {element.textContent}
      </span>
    );
  }

  if (tag === 'section') {
    return <SectionView key={key} element={element} blockRoot={blockRoot} />;
  }

  if (NUMBERED.has(tag)) {
    // An article/rule with a HEADING is playing the section role (a
    // constitution's "1. Supremacy of the Constitution") — give it the
    // section grammar; a bare-numbered one is a provision and gets the
    // gutter grid.
    if (childByLocal(element, 'heading')) {
      return <SectionView key={key} element={element} blockRoot={blockRoot} />;
    }
    return <NumberedBlock key={key} element={element} blockRoot={blockRoot} />;
  }

  if (tag === 'p') {
    return (
      <p key={key} className="akn-p">
        {renderInlineChildren(element)}
      </p>
    );
  }

  if (tag === 'heading' || tag === 'subheading') {
    return (
      <p key={key} className="akn-inner-heading">
        {renderInlineChildren(element)}
      </p>
    );
  }

  if (tag === 'crossheading') {
    return (
      <p key={key} className="akn-crossheading">
        {renderInlineChildren(element)}
      </p>
    );
  }

  if (tag === 'longtitle') {
    return (
      <div key={key} className="akn-longtitle">
        {renderBlockChildren(element)}
      </div>
    );
  }

  if (tag === 'proviso') {
    return (
      <div key={key} className="akn-proviso">
        {renderBlockChildren(element)}
      </div>
    );
  }

  if (tag === 'listintroduction' || tag === 'listwrapup') {
    return (
      <p key={key} className="akn-p">
        {renderInlineChildren(element)}
      </p>
    );
  }

  if (tag === 'table') return <TableView key={key} element={element} />;

  if (tag === 'ul') {
    return (
      <ul key={key} className="akn-list">
        {renderBlockChildren(element)}
      </ul>
    );
  }
  if (tag === 'ol') {
    return (
      <ol key={key} className="akn-list">
        {renderBlockChildren(element)}
      </ol>
    );
  }

  if (tag === 'li') {
    return (
      <li key={key} className="akn-list-item">
        {renderMixedChildren(element)}
      </li>
    );
  }

  if (CONTAINERS.has(tag)) {
    // A KNOWN container carrying a `num` is a numbered provision in
    // container clothing (some exporters hang the num on an `hcontainer`) —
    // give it the gutter grammar instead of letting the num float loose.
    if (childByLocal(element, 'num')) {
      return <NumberedBlock key={key} element={element} blockRoot={blockRoot} />;
    }
    return <Fragmented key={key}>{renderBlockChildren(element)}</Fragmented>;
  }

  /* Unknown element — degrade structurally, never drop law text:
     a `num` child makes it a numbered block; element children make it a
     container; bare text becomes a paragraph. */
  if (childByLocal(element, 'num')) {
    return <NumberedBlock key={key} element={element} blockRoot={blockRoot} />;
  }
  if (element.children.length > 0) {
    return <Fragmented key={key}>{renderBlockChildren(element)}</Fragmented>;
  }
  const text = element.textContent?.trim();
  return text ? (
    <p key={key} className="akn-p">
      {text}
    </p>
  ) : null;
}

/** Keyed fragment helper (a bare `<>` cannot carry a key). */
function Fragmented({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/**
 * A numbered section: "1. Heading" as one hanging heading, then content. A
 * block-root section leaves its anchor id to the block wrapper; a nested one
 * carries its own. The heading hosts the copy-link affordance — which renders
 * only when the document host indexed this section as unambiguously citable
 * (see `SectionLink`).
 */
function SectionView({
  element,
  blockRoot = false,
}: {
  element: Element;
  blockRoot?: boolean;
}) {
  const anchorId = aknAnchorId(element);
  const num = childByLocal(element, 'num');
  const heading = childByLocal(element, 'heading');

  return (
    <div
      id={blockRoot ? undefined : (anchorId ?? undefined)}
      className="akn-section"
    >
      {num || heading ? (
        <h3 className="akn-section-heading">
          {num ? <span className="akn-section-num">{num.textContent} </span> : null}
          {heading ? renderInlineChildren(heading) : null}
          {/* DELIBERATE: mint-coverage ⊂ resolve-coverage. A section without
              an eId resolves through its serial block anchor but mints no
              affordance (no stable id to key the citable map on), and a
              headingless numbered unit resolves but never reaches this
              heading at all. Real exports (all nodes carry eIds, sections
              carry headings) hit neither gap — do not widen this. */}
          {anchorId ? <SectionCopyLink anchorId={anchorId} /> : null}
        </h3>
      ) : null}
      {renderBlockChildren(element, ['num', 'heading'])}
    </div>
  );
}

/**
 * A numbered provision — subsection "(1)", paragraph "(a)", item "(i)" — as a
 * real two-column grid: the num in the gutter, the whole body (intro,
 * content, nested provisions, wrap-up) in the column. Nesting indents
 * naturally, one gutter per level. A nested provision with an eId carries its
 * `akn-{eId}` anchor, so a subsection deep link (`section-54-2`, or the raw
 * `#akn-…` hash) has something to land on; a block-root one leaves the id to
 * its wrapper.
 */
function NumberedBlock({
  element,
  blockRoot = false,
}: {
  element: Element;
  blockRoot?: boolean;
}) {
  const anchorId = blockRoot ? null : aknAnchorId(element);
  const num = childByLocal(element, 'num');
  const body = renderBlockChildren(element, ['num']);

  if (!num) {
    return (
      <div id={anchorId ?? undefined} className="akn-unnumbered">
        {body}
      </div>
    );
  }

  return (
    <div id={anchorId ?? undefined} className="akn-numbered">
      <span className="akn-num">{num.textContent}</span>
      <div className="akn-numbered-body">{body}</div>
    </div>
  );
}

/**
 * A table, wrapped for mobile horizontal overflow (the audit's known v1
 * finding). Rows placed directly under `<table>` in the source are grouped
 * into a real `<tbody>` so React's DOM nesting stays valid.
 */
function TableView({ element }: { element: Element }) {
  const caption: ReactNode[] = [];
  const groups: ReactNode[] = [];
  const looseRows: ReactNode[] = [];

  let index = 0;
  for (const child of element.children) {
    const tag = localName(child);
    const key = index;
    index += 1;

    if (tag === 'caption') {
      caption.push(
        <caption key={key} className="akn-table-caption">
          {renderInlineChildren(child)}
        </caption>,
      );
    } else if (tag === 'thead') {
      groups.push(<thead key={key}>{renderTableRows(child)}</thead>);
    } else if (tag === 'tbody') {
      groups.push(<tbody key={key}>{renderTableRows(child)}</tbody>);
    } else if (tag === 'tfoot') {
      groups.push(<tfoot key={key}>{renderTableRows(child)}</tfoot>);
    } else if (tag === 'tr') {
      looseRows.push(<TableRow key={key} element={child} />);
    }
  }

  return (
    <div className="akn-table-wrap">
      <table className="akn-table">
        {caption}
        {groups}
        {looseRows.length > 0 ? <tbody>{looseRows}</tbody> : null}
      </table>
    </div>
  );
}

function renderTableRows(group: Element): ReactNode {
  const rows: ReactNode[] = [];
  let index = 0;
  for (const child of group.children) {
    if (localName(child) === 'tr') {
      rows.push(<TableRow key={index} element={child} />);
    }
    index += 1;
  }
  return rows;
}

function TableRow({ element }: { element: Element }) {
  const cells: ReactNode[] = [];
  let index = 0;
  for (const child of element.children) {
    const tag = localName(child);
    if (tag === 'th') {
      cells.push(<th key={index}>{renderBlockChildren(child)}</th>);
    } else if (tag === 'td') {
      cells.push(<td key={index}>{renderBlockChildren(child)}</td>);
    }
    index += 1;
  }
  return <tr>{cells}</tr>;
}

/* ── Child walks ─────────────────────────────────────────────────────────── */

/**
 * Render child nodes in order, optionally excluding consumed label elements.
 * Iterates `childNodes`, NOT `children`: a bare text node sitting beside
 * element children in a block container (a `content` or `td` with loose
 * text) is law text too, and skipping it would silently drop it. Whitespace-
 * only nodes (the XML's pretty-printing) are the only text discarded.
 */
function renderBlockChildren(parent: Element, exclude?: string[]): ReactNode {
  const excluded = exclude ? new Set(exclude) : null;
  const children: ReactNode[] = [];
  let index = 0;
  for (const node of parent.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node as Text).data;
      if (text.trim()) children.push(text);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (!excluded?.has(localName(el))) {
        children.push(renderElement(el, index));
      }
    }
    index += 1;
  }
  return children;
}

/**
 * Mixed content (an `<li>`): meaningful text nodes render as strings, block
 * elements (a nested `<ul>`) recurse as blocks, inline elements as inlines.
 */
function renderMixedChildren(parent: Element): ReactNode {
  const children: ReactNode[] = [];
  let index = 0;
  for (const node of parent.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node as Text).data;
      if (text.trim()) children.push(text);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tag = localName(el);
      if (tag === 'ul' || tag === 'ol' || tag === 'p' || tag === 'table') {
        children.push(renderElement(el, index));
      } else {
        children.push(<Fragmented key={index}>{renderInlineNode(el)}</Fragmented>);
      }
    }
    index += 1;
  }
  return children;
}

/**
 * Inline (phrase-level) content of a `<p>`, heading, or cell: text nodes as
 * React strings, known formatting elements as their HTML equivalents, and
 * ANY unknown element as its inline children — so unrecognised AKN inline
 * semantics (`ref`, `term`, `date`, …) keep their text and lose only markup.
 */
function renderInlineChildren(parent: Element): ReactNode {
  const children: ReactNode[] = [];
  let index = 0;
  for (const node of parent.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      children.push((node as Text).data);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      children.push(
        <Fragmented key={index}>{renderInlineNode(node as Element)}</Fragmented>,
      );
    }
    index += 1;
  }
  return children;
}

function renderInlineNode(element: Element): ReactNode {
  const tag = localName(element);

  if (tag === 'br' || tag === 'eol') return <br />;

  switch (INLINE_MAP[tag]) {
    case 'strong':
      return <strong>{renderInlineChildren(element)}</strong>;
    case 'em':
      return <em>{renderInlineChildren(element)}</em>;
    case 'u':
      return <u>{renderInlineChildren(element)}</u>;
    case 'sup':
      return <sup>{renderInlineChildren(element)}</sup>;
    case 'sub':
      return <sub>{renderInlineChildren(element)}</sub>;
    default:
      break;
  }

  if (tag === 'remark') {
    // Editorial annotations — "[As substituted by …]" — quiet, never loud.
    return <span className="akn-remark">{renderInlineChildren(element)}</span>;
  }

  return renderInlineChildren(element);
}
