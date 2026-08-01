/**
 * akn — parse an Akoma Ntoso 3.0 export into the reader's render model.
 *
 * CLIENT-ONLY BY CONTRACT: this module uses `DOMParser`, which exists only in
 * a browser document context (not in RSCs, not in workers — a worker has no
 * DOM, which is also why the parse cannot be moved off the main thread and is
 * instead memoized to run exactly once per document). The one consumer,
 * `StatuteDocument`, only calls it after the XML query resolves in the
 * browser.
 *
 * ── WHAT THE MODEL IS, AND WHY ──────────────────────────────────────────────
 * One walk of the parsed DOM produces two things at once:
 *
 *  1. BLOCKS — the document flattened into a render sequence at SECTION
 *     granularity. A 719-node Act (measured: courts-act-1993) rendered as one
 *     synchronous tree is a multi-hundred-millisecond main-thread block; a
 *     flat block list is what lets `StatuteDocument` mount progressively (a
 *     first paintable slice, then frame-yielding batches) and lets CSS
 *     `content-visibility: auto` skip offscreen layout per block. Structural
 *     containers (part/chapter/schedule) are SPLIT — their heading becomes a
 *     `division` block and their children continue the flat sequence — so no
 *     single block ever contains a whole chapter.
 *
 *  2. OUTLINE — the wayfinding tree (divisions → sections) the rail and the
 *     mobile contents sheet render, derived from the SAME walk so the map can
 *     never name a part the document does not have. Anchor ids come from the
 *     backend's own `eId` attributes (verified present on all 719 nodes),
 *     prefixed `akn-` — stable across sessions, so deep links hold.
 *
 * ── NAMESPACE SAFETY ────────────────────────────────────────────────────────
 * AKN documents may or may not carry the namespace (v1's `querySelector('act')`
 * silently breaks on some parser/namespace combinations). Nothing here uses
 * CSS selectors: every lookup walks `children` and compares `localName`
 * case-insensitively, which is namespace-proof by construction.
 */

/* ── Model ───────────────────────────────────────────────────────────────── */

export type AknBlockKind = 'division' | 'crossheading' | 'body';

export interface AknBlock {
  /** Stable React key within one parsed document. */
  key: string;
  /** Anchor id (`akn-{eId}`) when this block is a wayfinding target. */
  id: string | null;
  kind: AknBlockKind;
  /**
   * The DOM subtree this block renders. For a `division` block the renderer
   * reads ONLY the element's own `num`/`heading` children — the division's
   * content continues as subsequent blocks.
   */
  element: Element;
  /** Structural nesting depth (0 = top-level part/chapter) — heading scale. */
  depth: number;
}

export interface AknOutlineSection {
  id: string;
  label: string;
}

export interface AknOutlineDivision {
  id: string;
  label: string;
  sections: AknOutlineSection[];
}

export interface AknDocumentModel {
  blocks: AknBlock[];
  outline: AknOutlineDivision[];
}

/* ── Namespace-safe DOM helpers (shared with the renderer) ───────────────── */

/** Lower-cased local name — tag identity independent of namespace/prefix. */
export function localName(el: Element): string {
  return el.localName.toLowerCase();
}

/** The first child ELEMENT with the given lower-cased local name. */
export function childByLocal(el: Element, name: string): Element | null {
  for (const child of el.children) {
    if (localName(child) === name) return child;
  }
  return null;
}

/** Collapsed text content — labels and headings. */
export function collapsedText(el: Element | null): string {
  return el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

/** Anchor id from an element's backend `eId` — the `akn-` prefix every deep
 *  link keys on — or `null` when there is none (the renderer never invents an
 *  id nobody can address; only the block walk falls back to a serial). */
export function aknAnchorId(el: Element): string | null {
  const eId = el.getAttribute('eId');
  return eId ? `akn-${eId}` : null;
}

/* ── Vocabulary ──────────────────────────────────────────────────────────── */

/**
 * Hierarchical containers whose heading is lifted into a `division` block and
 * whose content continues the flat sequence. The AKN hierarchy names, per the
 * OASIS vocabulary and the `StatuteNodeType` union our backend emits.
 */
const STRUCTURAL = new Set([
  'part',
  'chapter',
  'subpart',
  'title',
  'book',
  'tome',
  'division',
  'subdivision',
]);

/** Containers that exist purely to hold others — walked straight through. */
const TRANSPARENT = new Set([
  'body',
  'mainbody',
  'doc',
  'attachments',
  'preface',
  'preamble',
  'conclusions',
]);

/** Non-content machinery that must never render (FRBR metadata etc.). */
const SKIPPED = new Set(['meta', 'coverpage', 'components']);

/**
 * Section-grade units: one body block each, and an outline entry. `section`
 * is what our Acts use (verified); `article`/`rule`/`regulation`/`clause`
 * play the same role in constitutions and subsidiary legislation (they are
 * in the backend's own `StatuteNodeType` union). They earn an outline entry
 * only when they surface at hierarchy level — one nested inside a section's
 * subtree never reaches this walk. Exported for `provision.ts`, whose section
 * index must mean exactly what this walk means by "section".
 */
export const SECTION_GRADE = new Set([
  'section',
  'article',
  'rule',
  'regulation',
  'clause',
]);

/* ── Parsing ─────────────────────────────────────────────────────────────── */

/**
 * Parse the raw AKN XML. Returns `null` when the XML does not parse or holds
 * no recognisable document — the caller renders the "unreadable" state.
 */
export function parseAkn(xml: string): AknDocumentModel | null {
  if (typeof DOMParser === 'undefined') return null;

  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  // Parser failures surface as an embedded <parsererror> element (Firefox
  // namespaces it, Chromium does not) — check namespace-agnostically.
  if (doc.getElementsByTagNameNS('*', 'parsererror').length > 0) return null;

  const documentElement = doc.documentElement;
  if (!documentElement) return null;

  // The document root: <akomaNtoso> wraps one document element (<act>, <bill>,
  // <doc>, …); tolerate exports that omit the wrapper.
  const root =
    localName(documentElement) === 'akomantoso'
      ? firstElementChild(documentElement)
      : documentElement;
  if (!root) return null;

  const builder = new ModelBuilder();
  builder.walk(root, 0, false);

  if (builder.blocks.length === 0) return null;
  return { blocks: builder.blocks, outline: builder.outline };
}

function firstElementChild(el: Element): Element | null {
  return el.children.length > 0 ? el.children[0] : null;
}

/** "Part I — SUPERIOR COURTS" / "1. Composition of the Supreme Court". */
function joinNumHeading(num: string, heading: string, separator: string): string {
  if (num && heading) return `${num}${separator}${heading}`;
  return num || heading;
}

class ModelBuilder {
  readonly blocks: AknBlock[] = [];
  readonly outline: AknOutlineDivision[] = [];
  /** Monotonic fallback for elements without an `eId`. */
  private serial = 0;
  /** The open outline division sections attach to (labelled ancestors only). */
  private divisionStack: AknOutlineDivision[] = [];

  /** Anchor id from the backend's stable `eId`, or a per-parse serial. */
  private anchorId(el: Element): string {
    const id = aknAnchorId(el);
    if (id) return id;
    this.serial += 1;
    return `akn-x${this.serial}`;
  }

  private push(block: Omit<AknBlock, 'key'>): void {
    this.blocks.push({ ...block, key: block.id ?? `b${this.blocks.length}` });
  }

  /**
   * Walk one container's children, emitting blocks in document order.
   *
   * `labelsLifted` — true only when the CALLER already consumed this
   * container's `num`/`heading`/`subheading` into a division block. A
   * transparent container's labels (a preamble with a heading, a schedule
   * `doc` with its own num) were lifted by nobody, so they are emitted as
   * body blocks instead of skipped — no label may vanish by construction.
   */
  walk(container: Element, depth: number, labelsLifted: boolean): void {
    for (const child of container.children) {
      const name = localName(child);

      if (SKIPPED.has(name)) continue;

      if (name === 'num' || name === 'heading' || name === 'subheading') {
        if (labelsLifted) continue;
        this.push({
          id: this.anchorId(child),
          kind: 'body',
          element: child,
          depth,
        });
        continue;
      }

      if (TRANSPARENT.has(name)) {
        this.walk(child, depth, false);
        continue;
      }

      if (STRUCTURAL.has(name)) {
        this.division(child, depth);
        continue;
      }

      if (name === 'attachment') {
        // A schedule/appendix: its heading is a top-level division, its
        // nested doc/mainBody continues the flat sequence.
        this.division(child, 0);
        continue;
      }

      if (name === 'crossheading') {
        this.push({
          id: this.anchorId(child),
          kind: 'crossheading',
          element: child,
          depth,
        });
        continue;
      }

      if (SECTION_GRADE.has(name)) {
        const id = this.anchorId(child);
        this.push({ id, kind: 'body', element: child, depth });
        const label = joinNumHeading(
          collapsedText(childByLocal(child, 'num')),
          collapsedText(childByLocal(child, 'heading')),
          ' ',
        );
        if (label) {
          const division = this.divisionStack[this.divisionStack.length - 1];
          if (division) {
            division.sections.push({ id, label });
          } else {
            // A flat act (sections straight under <body>, no parts): the
            // sections ARE the outline's top level.
            this.outline.push({ id, label, sections: [] });
          }
        }
        continue;
      }

      // Any other content at this level (hcontainer, longTitle, a stray
      // paragraph, an unknown future element) is one body block.
      this.push({
        id: this.anchorId(child),
        kind: 'body',
        element: child,
        depth,
      });
    }
  }

  /** Emit a division heading block + outline entry, then continue inside. */
  private division(el: Element, depth: number): void {
    const id = this.anchorId(el);
    const label = joinNumHeading(
      collapsedText(childByLocal(el, 'num')),
      collapsedText(childByLocal(el, 'heading')),
      ' — ',
    );

    this.push({ id, kind: 'division', element: el, depth });

    if (label) {
      // Only LABELLED divisions appear in the outline (an anonymous subpart
      // would be an empty rail row); their sections attach to the nearest
      // labelled ancestor either way.
      const entry: AknOutlineDivision = { id, label, sections: [] };
      this.outline.push(entry);
      this.divisionStack.push(entry);
      this.walk(el, depth + 1, true);
      this.divisionStack.pop();
      return;
    }

    this.walk(el, depth + 1, true);
  }
}
