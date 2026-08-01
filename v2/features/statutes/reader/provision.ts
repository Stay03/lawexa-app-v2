/**
 * provision — the citation-shaped deep-link grammar for the statute reader.
 *
 * A URL can point at one provision the way a lawyer cites it:
 *
 *   /statutes/courts-act-1993/section-54     → section 54
 *   /statutes/courts-act-1993/section-54-2   → subsection (2) of section 54
 *
 * This module owns everything about that grammar and nothing about scrolling:
 * parsing the path segment, normalizing the nums real documents carry ("54.",
 * "(2)", "54A."), the first-wins section index a parsed document exposes to
 * both the resolver and the copy affordance, and resolving a citation to the
 * `akn-{eId}` anchors the reader already jumps to. `StatuteDocument` consumes
 * the answers; the route's `generateMetadata` consumes only the pure string
 * half (parse + label) — which is why nothing here touches the DOM at module
 * scope and the file carries no `'use client'` directive.
 *
 * ── THE GRAMMAR, EXACTLY ────────────────────────────────────────────────────
 * `section-{num}` or `section-{num}-{sub}`, where each token is digits with an
 * optional letter tail ("54", "54a"). Case-insensitive on the way in; minted
 * lower-case on the way out. The `section-` prefix is the URL grammar for
 * EVERY section-grade unit (a constitution's articles included) — the path is
 * an address, not a legal quotation, and one stable prefix keeps it guessable.
 *
 * Anything that does not match is NOT an error at the route level: the statute
 * still renders, and the reader shows a quiet notice (see `StatuteDocument`).
 */

import {
  SECTION_GRADE,
  childByLocal,
  collapsedText,
  localName,
  type AknBlock,
} from './akn';

/* ── The citation ────────────────────────────────────────────────────────── */

export interface ProvisionCitation {
  /** Normalized section num — "54", "54a". */
  section: string;
  /** Normalized subsection num — "2" — or null for a whole-section citation. */
  subsection: string | null;
}

/** One section or subsection token: digits, optional letter tail ("54a"). */
const SEGMENT = /^section-(\d+[a-z]*)(?:-(\d+[a-z]*))?$/;

/**
 * Parse one path segment into a citation. `null` for anything that is not
 * citation-shaped — a deeper hierarchy ("section-54-2-1"), a lettered-only
 * token, arbitrary garbage. Callers treat `null` as "render the statute
 * normally and say the link pointed nowhere".
 */
export function parseProvisionSegment(segment: string): ProvisionCitation | null {
  const match = SEGMENT.exec(segment.toLowerCase());
  if (!match) return null;
  return { section: match[1], subsection: match[2] ?? null };
}

/* ── Num normalization ───────────────────────────────────────────────────── */

/**
 * Collapse a document num to its citable token: "54." → "54", "(2)" → "2",
 * "54A." → "54a". Leading brackets and the trailing punctuation run go; the
 * comparison (and the minted URL) is always lower-case.
 */
export function normalizeNum(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[([]+/, '')
    .replace(/[.:)\]]+$/, '');
}

/** True when a normalized num can live in a citation path ("54", "54a") —
 *  dotted ("12.1") or roman ("iv") schemes never mint or match. */
export function isCitableNum(num: string): boolean {
  return /^\d+[a-z]*$/.test(num);
}

/** "54a" → "54A" — citations print their letters upper-case. */
export function displayNum(num: string): string {
  return num.replace(/[a-z]+$/, (letters) => letters.toUpperCase());
}

/** "Section 54", "Section 54(2)" — titles, notices, announcements. */
export function formatProvisionLabel(citation: ProvisionCitation): string {
  const section = displayNum(citation.section);
  return citation.subsection
    ? `Section ${section}(${displayNum(citation.subsection)})`
    : `Section ${section}`;
}

/* ── The section index ───────────────────────────────────────────────────── */

export interface SectionTarget {
  /** The section block's anchor (`akn-{eId}`, or the parse serial) — both the
   *  mount-through key and the scroll target. */
  anchorId: string;
  /** The section element — subsection resolution searches inside it. */
  element: Element;
  /** The path segment this section mints — `section-54`. */
  path: string;
  /** The human reference — `section 54` — for labels and announcements. */
  label: string;
}

/**
 * Index a parsed document's BLOCK-LEVEL sections by normalized num, FIRST
 * WINS. First-wins is a correctness rule, not a shortcut: a schedule can
 * carry its own "1." sections after the main body's, and a citation like
 * `section-1` must always mean the one a lawyer means — the first in document
 * order. Later duplicates stay out of the index entirely, so they neither
 * resolve nor mint a copy link (an ambiguous link is worse than none).
 */
export function indexSections(
  blocks: readonly AknBlock[],
): Map<string, SectionTarget> {
  const index = new Map<string, SectionTarget>();
  for (const block of blocks) {
    if (block.kind !== 'body' || !block.id) continue;
    if (!SECTION_GRADE.has(localName(block.element))) continue;
    const num = normalizeNum(collapsedText(childByLocal(block.element, 'num')));
    if (!isCitableNum(num) || index.has(num)) continue;
    index.set(num, {
      anchorId: block.id,
      element: block.element,
      path: `section-${num}`,
      label: `section ${displayNum(num)}`,
    });
  }
  return index;
}

/* ── Resolution ──────────────────────────────────────────────────────────── */

export type ProvisionResolution =
  /** `provision` = the cited unit itself; `section` = the subsection was not
   *  found but its section was — land there and say so. */
  | { matched: 'provision' | 'section'; blockId: string; anchorId: string }
  | { matched: 'none' };

/**
 * Resolve a citation against the section index. Subsections are searched
 * direct-children first (the standard AKN shape: subsections sit straight
 * under their section), then any nested `subsection` descendant, for exports
 * that interpose a container — first match in document order either way. A
 * subsection found WITHOUT an eId still resolves, to the section's own anchor:
 * the reader lands one heading above it, which beats claiming it is missing.
 */
export function resolveCitation(
  index: ReadonlyMap<string, SectionTarget>,
  citation: ProvisionCitation,
): ProvisionResolution {
  const section = index.get(citation.section);
  if (!section) return { matched: 'none' };

  const own = { blockId: section.anchorId, anchorId: section.anchorId };
  if (!citation.subsection) return { matched: 'provision', ...own };

  const sub = findSubsection(section.element, citation.subsection);
  if (!sub) return { matched: 'section', ...own };

  const eId = sub.getAttribute('eId');
  if (!eId) return { matched: 'provision', ...own };
  return { matched: 'provision', blockId: section.anchorId, anchorId: `akn-${eId}` };
}

function findSubsection(section: Element, num: string): Element | null {
  for (const child of section.children) {
    if (normalizeNum(collapsedText(childByLocal(child, 'num'))) === num) {
      return child;
    }
  }
  return findNestedSubsection(section, num);
}

function findNestedSubsection(el: Element, num: string): Element | null {
  for (const child of el.children) {
    if (
      localName(child) === 'subsection' &&
      normalizeNum(collapsedText(childByLocal(child, 'num'))) === num
    ) {
      return child;
    }
    const hit = findNestedSubsection(child, num);
    if (hit) return hit;
  }
  return null;
}

/* ── Nested-anchor lookup (hash deep links to subsections) ───────────────── */

/**
 * The block index that holds a nested `akn-{eId}` anchor — the mount-through
 * target for a hash that points INSIDE a block (a subsection anchor, now that
 * the renderer stamps them). Scanned in REVERSE document order because a
 * division block's element contains its whole part subtree: among every block
 * whose subtree holds the eId, the LAST is the deepest — the one whose
 * rendered DOM actually carries the anchor. `null` when no block holds it.
 */
export function holderBlockIndex(
  blocks: readonly AknBlock[],
  anchorId: string,
): number | null {
  if (!anchorId.startsWith('akn-')) return null;
  const eId = anchorId.slice('akn-'.length);
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    if (holdsEId(blocks[i].element, eId)) return i;
  }
  return null;
}

function holdsEId(el: Element, eId: string): boolean {
  if (el.getAttribute('eId') === eId) return true;
  for (const child of el.children) {
    if (holdsEId(child, eId)) return true;
  }
  return false;
}
