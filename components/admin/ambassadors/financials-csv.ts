import type { FinancialsRow } from './financials';

/**
 * The financials table as a CSV file.
 *
 * ── ONE COLUMN PER CURRENCY, NEVER A TOTAL ─────────────────────────────────
 * `revenue` is a currency map and a spreadsheet is exactly where a single
 * "revenue" column would get summed by hand — naira added to dollars, the
 * mistake the server itself made until 2026-08-11. So every currency present in
 * the loaded rows gets its OWN column, named with its code, and no column adds
 * two of them together.
 *
 * ── AND THE HEADER SAYS WHAT THE NUMBER IS ─────────────────────────────────
 * "Their referrals spent" is what the referred people spent. It is not
 * commission, not earnings and not owed, and a column heading is exactly how a
 * decision like that gets made by accident. The name travels with the file.
 *
 * A row holding no amount in a currency leaves that cell EMPTY rather than
 * writing 0.00 — the map carries no currency there, so a zero would be naming
 * one the server did not.
 */

/** A value a CSV cell can hold. `null` and `undefined` are empty cells. */
export type CsvValue = string | number | null | undefined;

/**
 * One CSV field, quoted only when it has to be.
 *
 * A comma, a quote, a newline or a carriage return each end a field or a record
 * for a reader that does not see the quotes, and internal quotes are doubled —
 * RFC 4180. University names carry commas often enough that this is not
 * theoretical.
 */
function csvField(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (!/["\n\r,]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * A whole file: the header, then one line per row, CRLF between lines as RFC
 * 4180 has it, and every cell through `csvField`. The applications export
 * builds its file with this too, so the two files quote alike.
 */
export function csvDocument(header: string[], rows: CsvValue[][]): string {
  const lines: CsvValue[][] = [header, ...rows];
  return lines.map((values) => values.map(csvField).join(',')).join('\r\n');
}

/**
 * A timestamp as the calendar day, in the reader's own timezone.
 *
 * The table prints local days, so the file has to as well — the same referral
 * shown as 8 Sep must not be exported as the 9th. Written as YYYY-MM-DD, which
 * is the one date format a spreadsheet sorts correctly without being told what
 * it is looking at.
 */
export function localDay(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A timestamp from the API as `localDay`, or an empty cell when there is none
 *  or it does not parse. */
export function localDayOf(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return localDay(date);
}

/**
 * The rows exactly as the screen is showing them — filtered, searched, sorted
 * and in the same order.
 *
 * `currencies` comes from every loaded row rather than only the exported ones,
 * so two exports of the same screen have the same columns whatever the filter
 * was. There is no "flagged" column: `unusual_activity` is a prompt to look at
 * a day-by-day record, and a boolean in a spreadsheet outlives every bit of
 * that context. The busiest day and its size are exported instead, which is the
 * evidence itself.
 */
export function financialsCsv(rows: FinancialsRow[], currencies: string[]): string {
  const header = [
    'Ambassador',
    'Email',
    'Code',
    'University',
    'Level',
    'Country',
    'Signed up',
    'Ever paid',
    ...currencies.map((code) => `Their referrals spent (${code})`),
    'Free messages given',
    'Last referral',
    'Busiest day',
    'Most signups in a day',
  ];

  return csvDocument(
    header,
    rows.map((row) => [
      row.name,
      row.email,
      row.code,
      row.university,
      row.level,
      row.country,
      row.referred_count,
      row.paid_count,
      ...currencies.map((code) => row.revenue?.[code] ?? null),
      row.gifted_messages,
      localDayOf(row.last_referral_at),
      localDayOf(row.busiest_day?.date ?? null),
      row.busiest_day?.signups ?? 0,
    ])
  );
}

/**
 * Hands the file to the browser.
 *
 * The leading U+FEFF is for Excel: without it Excel on Windows reads the file
 * in the local codepage and mangles every non-ASCII university name. Other
 * readers treat it as a zero-width no-break space and show nothing.
 *
 * The object URL is revoked after the click because the blob stays in memory
 * for the life of the document otherwise, and this screen can be exported
 * repeatedly.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
