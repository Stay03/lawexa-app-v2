import type { AknOutlineDivision, AknOutlineSection } from '../akn';

/**
 * contents-model — the pure half of the three Contents designs behind
 * `?contents=a|b|c` (finding 10: Stay wants a cleaner panel than the left
 * sheet; three to choose from, filmed, then two of them go). Everything here
 * is plain data over the outline the reader already has, so each design is
 * only a surface over the same tree, the same active mark and the same jump.
 *
 * Nothing in this folder runs unless the address carries the parameter; with
 * no parameter the statute page keeps `StatuteContentsSheet`.
 */

export type ContentsVariant = 'a' | 'b' | 'c';

/** The `?contents=` value, or `null` for today's sheet (any other value too:
 *  a stray parameter must never change what a reader sees). */
export function contentsVariantOf(param: string | null): ContentsVariant | null {
  return param === 'a' || param === 'b' || param === 'c' ? param : null;
}

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

/* ── Search (design B) ───────────────────────────────────────────────────── */

export interface OutlineMatchGroup {
  division: AknOutlineDivision;
  /** True when the division's own label matched, so its heading row is a
   *  result in its own right (jumps to the division). */
  divisionMatched: boolean;
  sections: AknOutlineSection[];
}

/** One row of the flat result list the keyboard walks: a division heading
 *  or a section, in document order. */
export interface OutlineMatchRow {
  id: string;
  kind: 'division' | 'section';
  label: string;
  locked: boolean;
  /** The division the row sits under (itself, for a division row). */
  divisionId: string;
}

/**
 * The outline narrowed to what matches `query`, grouped by division and kept
 * in document order. An empty query is the whole outline, sections only: the
 * group label already names each division, so a heading row would say it
 * twice. A query that is a number ("12", "12a") matches section numbers by
 * prefix, so "1" offers 1, 10 to 19 and 100 onward rather than only "1"; any
 * query also matches titles by every word it contains, in any order, and a
 * division whose own label matches becomes a row that jumps to its start.
 * Matching ignores case.
 */
export function matchOutline(
  outline: readonly AknOutlineDivision[],
  query: string,
): OutlineMatchGroup[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    // A division with no sections is itself the row (a flat act's sections
    // are the outline's top level), so it keeps its heading row.
    return outline.map((division) => ({
      division,
      divisionMatched: division.sections.length === 0,
      sections: division.sections,
    }));
  }
  const numeric = /^\d+[a-z]*$/.test(words[0]) && words.length === 1 ? words[0] : null;
  const matchesTitle = (label: string) => {
    const text = label.toLowerCase();
    return words.every((word) => text.includes(word));
  };
  const matchesSection = (label: string) => {
    if (matchesTitle(label)) return true;
    if (numeric === null) return false;
    const { num } = splitSectionLabel(label);
    return num !== null && num.toLowerCase().replace(/^art\.\s+/, '').startsWith(numeric);
  };

  const groups: OutlineMatchGroup[] = [];
  for (const division of outline) {
    const divisionMatched = matchesTitle(division.label);
    const sections = division.sections.filter((section) => matchesSection(section.label));
    if (divisionMatched || sections.length > 0) {
      groups.push({ division, divisionMatched, sections });
    }
  }
  return groups;
}

/** The groups flattened to the rows the keyboard moves through. */
export function matchRows(groups: readonly OutlineMatchGroup[]): OutlineMatchRow[] {
  const rows: OutlineMatchRow[] = [];
  for (const { division, divisionMatched, sections } of groups) {
    if (divisionMatched) {
      rows.push({
        id: division.id,
        kind: 'division',
        label: division.label,
        locked: division.locked ?? false,
        divisionId: division.id,
      });
    }
    for (const section of sections) {
      rows.push({
        id: section.id,
        kind: 'section',
        label: section.label,
        locked: section.locked ?? false,
        divisionId: division.id,
      });
    }
  }
  return rows;
}

/** How many of the rows are sections (the count the panel reports). */
export function sectionCount(rows: readonly OutlineMatchRow[]): number {
  return rows.reduce((count, row) => (row.kind === 'section' ? count + 1 : count), 0);
}

/**
 * The next highlighted row for an arrow key: wraps at both ends, so the
 * keyboard never dead-ends. `-1` (nothing highlighted) steps onto the first
 * or the last row.
 */
export function stepHighlight(
  current: number,
  delta: 1 | -1,
  count: number,
): number {
  if (count === 0) return -1;
  if (current < 0) return delta === 1 ? 0 : count - 1;
  return (current + delta + count) % count;
}
