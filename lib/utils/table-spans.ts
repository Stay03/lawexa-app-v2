/**
 * The row and column span a statute table cell asks for, ready to spread onto
 * a React `<th>` or `<td>`.
 *
 * WHY. Both statute readers build cells from the AKN document and used to
 * create them with no attributes, so every `rowspan`/`colspan` the export
 * carried was lost: a one-cell heading row ("SCREENING OF OFFENDERS",
 * `colspan="7"`, Kano ACJL 2019) sat in the first column, and a two-level
 * header ("Penalty" over Fine and Additional) shifted every column under it
 * (6 October 2026). Shared by the v2 reader (`v2/features/statutes/reader/
 * AknNode.tsx`) and v1's (`components/statutes-v2/AknElementRenderer.tsx`).
 *
 * Only a whole number of 2 or more is kept: 1 is the default, and anything
 * else (0, negative, text) would be ignored by the browser anyway. Values are
 * capped at HTML's own limits (colspan 1000, rowspan 65534), so a corrupt
 * number cannot ask for a million columns.
 */
export interface TableCellSpans {
  rowSpan?: number;
  colSpan?: number;
}

const MAX_COLSPAN = 1000;
const MAX_ROWSPAN = 65534;

function span(value: string | null, max: number): number | undefined {
  if (!value) return undefined;
  const text = value.trim();
  if (!/^\d+$/.test(text)) return undefined;
  const n = Number(text);
  return n >= 2 ? Math.min(n, max) : undefined;
}

export function tableCellSpans(cell: { getAttribute(name: string): string | null }): TableCellSpans {
  const spans: TableCellSpans = {};
  const rowSpan = span(cell.getAttribute('rowspan'), MAX_ROWSPAN);
  const colSpan = span(cell.getAttribute('colspan'), MAX_COLSPAN);
  if (rowSpan) spans.rowSpan = rowSpan;
  if (colSpan) spans.colSpan = colSpan;
  return spans;
}
