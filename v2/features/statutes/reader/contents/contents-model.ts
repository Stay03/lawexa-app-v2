import type { AknOutlineDivision } from '../akn';

/**
 * contents-model — the pure half of a statute's Contents (`StatuteContents`,
 * design A, "where you are"; Stay, 23 October 2026: "Let's see A push that").
 * Plain data over the outline the reader already has: how a label splits for
 * the tabular rows, how far through the statute the reader is, and which
 * division holds the open section.
 */

/* ── Labels ──────────────────────────────────────────────────────────────── */

export interface SplitLabel {
  /** The citable number as a reader says it ("12", "12A", "Art. 3"), or
   *  `null` when the label has no leading number to set apart. */
  num: string | null;
  /** The rest of the label, or all of it. */
  title: string;
}

/**
 * A section label split for a tabular layout: "12. Interpretation" →
 * 12 / Interpretation, "Article 3 Definitions" → Art. 3 / Definitions. A
 * label that is a number alone keeps it as the title, so a row never prints
 * empty; a label with no leading number is all title.
 */
export function splitSectionLabel(label: string): SplitLabel {
  const text = label.trim();
  const article = /^Article\s+(\d+[A-Za-z]*)\.?\s+(.+)$/i.exec(text);
  if (article) return { num: `Art. ${article[1]}`, title: article[2] };
  const numbered = /^(\d+[A-Za-z]*)\.?\s+(.+)$/.exec(text);
  if (numbered) return { num: numbered[1], title: numbered[2] };
  return { num: null, title: text };
}

/**
 * A division label split on the em-dash join `akn.ts` makes ("Part II —
 * Lower Courts" → Part II / Lower Courts). A schedule or an unjoined label is
 * all title.
 */
export function splitDivisionLabel(label: string): SplitLabel {
  const at = label.indexOf(' — ');
  if (at < 0) return { num: null, title: label.trim() };
  return { num: label.slice(0, at).trim(), title: label.slice(at + 3).trim() };
}

/* ── Position ────────────────────────────────────────────────────────────── */

export interface OutlinePosition {
  /** Zero-based place of the active entry among every entry in document
   *  order (divisions and sections alike); 0 when nothing is active yet. */
  index: number;
  /** How many entries there are. */
  total: number;
  /** `index / (total - 1)`, clamped to 0..1; 0 for an empty outline. */
  fraction: number;
}

/** Where the active entry sits in the whole statute, for a progress line. */
export function outlinePosition(
  outline: readonly AknOutlineDivision[],
  activeId: string | null,
): OutlinePosition {
  let total = 0;
  let index = 0;
  for (const division of outline) {
    if (division.id === activeId) index = total;
    total += 1;
    for (const section of division.sections) {
      if (section.id === activeId) index = total;
      total += 1;
    }
  }
  const fraction = total > 1 ? index / (total - 1) : 0;
  return { index, total, fraction };
}

/** The division that owns `activeId` (itself or one of its sections), else
 *  the first division. Mirrors the rail's rule in `StatuteOutline.tsx`. */
export function owningDivisionOf(
  outline: readonly AknOutlineDivision[],
  activeId: string | null,
): string | null {
  if (!activeId) return outline[0]?.id ?? null;
  for (const division of outline) {
    if (division.id === activeId) return division.id;
    if (division.sections.some((section) => section.id === activeId)) {
      return division.id;
    }
  }
  return outline[0]?.id ?? null;
}
