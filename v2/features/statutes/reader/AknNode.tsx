'use client';

import { Fragment, memo, type ReactNode } from 'react';

import { aknAnchorId, childByLocal, localName, type AknBlock } from './akn';
import { printedLines } from './printed-lines';
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

/** True when `el` carries `name` among its `class` values (AKN keeps the
 *  HTML-style attribute; the form markers ride on it). */
function hasClass(el: Element, name: string): boolean {
  return (el.getAttribute('class') ?? '').split(/\s+/).includes(name);
}

/**
 * The longest text a form sets at the margin after a blank: a name or
 * initials ("B.", "C.D."). Anything longer is the rest of a sentence,
 * and the blank before it stays inline.
 */
const MARGIN_NAME_MAX = 16;

/**
 * The longest label a blank with words after it stretches after to the
 * margin: "A.B. …… Claimant", "C.D and E.F …… Defendants". After a longer
 * run of words the blank and the words after it stay inline at a fixed
 * width, as the print sets them ("…Lagos State, this ……… day", "…20
 * ……]:"), instead of the words landing alone on a line of their own (the
 * 230-form compare, 29 September 2026).
 */
const STRETCH_LABEL_MAX = 40;

function inlineText(nodes: readonly ChildNode[]): string {
  return nodes
    .map((node) => node.textContent ?? '')
    .join('')
    .trim();
}

function isFill(node: ChildNode): boolean {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    localName(node as Element) === 'span' &&
    hasClass(node as Element, 'fill')
  );
}

/**
 * A paragraph's layout markers, for the printed forms (the marker set agreed
 * with backend on 28 September 2026, b20a3778/cb8983ac, widened on 29
 * September, fb9b9081): one of `centre`, `right` or `gap` (an empty line of
 * space), and `indent-1` or `indent-2` to set the line in by one or two
 * steps. Bold comes as `<b>` inside the line. A paragraph with none keeps
 * the default.
 */
function paragraphClass(el: Element): string {
  const classes = ['akn-p'];
  if (hasClass(el, 'centre')) classes.push('akn-p-centre');
  else if (hasClass(el, 'right')) classes.push('akn-p-right');
  else if (hasClass(el, 'gap')) classes.push('akn-p-gap');
  if (hasClass(el, 'indent-2')) classes.push('akn-p-indent-2');
  else if (hasClass(el, 'indent-1')) classes.push('akn-p-indent-1');
  return classes.join(' ');
}

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
    // A form line whose last blank runs to the margin, as on the printed page:
    // "A.B. ……" (the blank ends the line), "……C.D." and "Signed……B." (only a
    // name or initials follow it, set at the margin), "……(Petitioners) as the
    // case may be)" (the blank opens the line, so no sentence is split), or a
    // whole writing line. The words on each side are one wrapper, so they
    // still wrap as ordinary text; only that blank stretches. A blank in the
    // middle of prose stays inline, or the sentence after it would break off
    // into a block of its own. (Letting every text run and blank become its
    // own flex item split long lines into columns: caught on the TF 001
    // sample, 28 September 2026. A lone blank at its 4ch minimum, a stub
    // before "B." and a stub opening TF 005's "(Petitioners)" line were caught
    // on backend's marked forms the same day.)
    const nodes = Array.from(element.childNodes).filter(
      (node) => node.nodeType !== Node.TEXT_NODE || (node as Text).data.trim() !== '',
    );
    //
    // The blank and the words after it are one unit (the tail), so a short
    // word after a blank ("day", "]:", "Filed.") never wraps onto a line of
    // its own. It never stretches on a right-aligned line: there the text
    // keeps to the right with a short blank ("Suit No. ……", "(Sgd) ……"), as
    // printed. After a longer run of words, a tail with words in it stays
    // inline at a fixed width. (Both caught by the
    // 230-form compare, 29 September 2026: a stretching blank pushed right-
    // aligned text to the left margin in about 50 forms, and left "day",
    // "]:" and ")" alone on their own lines in about 25.)
    const fillAt = nodes.findLastIndex(isFill);
    const after = nodes.slice(fillAt + 1);
    if (fillAt === 0 || (fillAt > 0 && inlineText(after).length <= MARGIN_NAME_MAX)) {
      const before = nodes.slice(0, fillAt);
      // A blank with nothing after it keeps the writing line it had: it runs
      // to the margin, or takes a full line of its own after a long sentence
      // (the Electoral and ISA forms were signed off that way, 28 September
      // 2026). Only a blank with words after it goes inline after a long
      // sentence.
      const stretch =
        !hasClass(element, 'right') &&
        (after.length === 0 || inlineText(before).length <= STRETCH_LABEL_MAX);
      const fill = (
        <span className={stretch ? 'akn-fill akn-fill-stretch' : 'akn-fill'}>
          {renderInlineChildren(nodes[fillAt] as Element)}
        </span>
      );
      const tail = (
        <span className={stretch ? 'akn-fill-tail' : 'akn-fill-tail-inline'}>
          {fill}
          {after.length > 0 && (stretch ? <span>{renderInlineNodes(after)}</span> : renderInlineNodes(after))}
        </span>
      );
      if (!stretch) {
        return (
          <p key={key} className={paragraphClass(element)}>
            {renderInlineNodes(before)}
            {tail}
          </p>
        );
      }
      return (
        <p key={key} className={`${paragraphClass(element)} akn-p-fill-line`}>
          {before.length > 0 && (
            <span className="akn-fill-words">{renderInlineNodes(before)}</span>
          )}
          {tail}
        </p>
      );
    }
    return (
      <p key={key} className={paragraphClass(element)}>
        {renderInlineChildren(element)}
      </p>
    );
  }

  // A printed form: the whole form's box. Its lines are ordinary paragraphs
  // carrying the layout markers above.
  if (tag === 'blockcontainer' && hasClass(element, 'form')) {
    return (
      <div key={key} className="akn-form">
        {renderBlockChildren(element)}
      </div>
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
    // A container with its own eId (a definition in an interpretation
    // section, `…__def-attorney-general-of-the-federation`) keeps that id on
    // the page, so a deep link or a researcher's note can find it. The
    // wrapper is `display: contents`: the layout is exactly the fragment's.
    // (Eight Electoral Act notes on s.155 definitions had no place to land
    // without it, 28 September 2026.)
    const anchorId = blockRoot ? null : aknAnchorId(element);
    if (anchorId) {
      return (
        <div key={key} id={anchorId} className="akn-anchor">
          {renderBlockChildren(element)}
        </div>
      );
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
 * One text node as the page shows it: a plain string, or, when the print had
 * line breaks in it (a form, a formula), its lines with a `<br>` between them.
 * Which breaks count is `printedLines`'s rule.
 */
function renderText(text: string, keyIndex: number): ReactNode {
  const lines = printedLines(text);
  if (lines.length === 1) return lines[0];
  return (
    <Fragmented key={keyIndex}>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          {line}
        </Fragment>
      ))}
    </Fragmented>
  );
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

  // A printed form's table (backend's marks, 29 September 2026): `form-table`
  // is a ruled register or account; `form-table side` is two things set side
  // by side on the page ("PROBATE REGISTRAR" beside the seal), with no rules.
  const formTable = hasClass(element, 'form-table');
  let tableClass = 'akn-table';
  if (formTable) tableClass += ' akn-form-table';
  if (formTable && hasClass(element, 'side')) tableClass += ' akn-form-table-side';

  return (
    <div className="akn-table-wrap">
      <table className={tableClass}>
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
      cells.push(<th key={index}>{renderCell(child)}</th>);
    } else if (tag === 'td') {
      cells.push(<td key={index}>{renderCell(child)}</td>);
    }
    index += 1;
  }
  return <tr>{cells}</tr>;
}

/**
 * A cell holding paragraphs renders them as blocks. A cell holding only a
 * line of text (a printed form's register row: words, a blank, bold) renders
 * it inline, so its blank stays on the cell's line instead of becoming a
 * paragraph of its own.
 */
function renderCell(cell: Element): ReactNode {
  const hasParagraph = Array.from(cell.children).some((child) => localName(child) === 'p');
  return hasParagraph ? renderBlockChildren(cell) : renderInlineChildren(cell);
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
      if (text.trim()) children.push(renderText(text, index));
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
      if (text.trim()) children.push(renderText(text, index));
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
  return renderInlineNodes(Array.from(parent.childNodes));
}

function renderInlineNodes(nodes: readonly ChildNode[]): ReactNode {
  const children: ReactNode[] = [];
  let index = 0;
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      children.push(renderText((node as Text).data, index));
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

  if (tag === 'span' && hasClass(element, 'fill')) {
    // A blank to fill in. The printed "……" stays in the text (search and note
    // quotes still see it); the stylesheet draws it as a dotted leader.
    return <span className="akn-fill">{renderInlineChildren(element)}</span>;
  }

  if (tag === 'remark') {
    // Editorial annotations — "[As substituted by …]" — quiet, never loud.
    return <span className="akn-remark">{renderInlineChildren(element)}</span>;
  }

  return renderInlineChildren(element);
}
