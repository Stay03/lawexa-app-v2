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

/**
 * An amount that arrives as TEXT and must reach the file exactly as sent.
 *
 * The api sends money as a decimal string, "2000.00". A negative amount would
 * start with "-", and the formula guard in `csvField` would put a quote in front
 * of it. Excel and Sheets SHOW that quote when they open a CSV, so the cell
 * would read '-5000 and the column would stop summing. Turning the text into a
 * number would drop the ".00" and change the file. So an amount is wrapped in
 * this marker, and the guard passes a marked cell through untouched.
 *
 * The marker is only ever made for text that IS a plain decimal (`csvAmount`).
 * Anything else comes back as an ordinary string and is guarded, so the
 * exemption cannot carry a formula into the file.
 */
export interface CsvNumericText {
  readonly numericText: string;
}

/** A value a CSV cell can hold. `null` and `undefined` are empty cells. */
export type CsvValue = string | number | CsvNumericText | null | undefined;

/** Digits, an optional leading minus, and an optional decimal part. */
const PLAIN_DECIMAL = /^-?[0-9]+(\.[0-9]+)?$/;

/**
 * An amount from the api, marked so the formula guard leaves it alone. Text that
 * is not a plain decimal is returned unmarked, so it is guarded like any string.
 */
export function csvAmount(text: string | null | undefined): CsvValue {
  if (text === null || text === undefined) return null;
  return PLAIN_DECIMAL.test(text) ? { numericText: text } : text;
}

/**
 * The first characters that make a spreadsheet read a cell as a formula, from
 * OWASP's CSV injection guidance: = + - @, a tab and a carriage return.
 */
const FORMULA_START = new Set(['=', '+', '-', '@', '\t', '\r']);

/**
 * RFC 4180 quoting, only when it has to.
 *
 * A comma, a quote, a newline or a carriage return each end a field or a record
 * for a reader that does not see the quotes, and internal quotes are doubled.
 * University names carry commas often enough that this is not theoretical.
 */
function quoteIfNeeded(text: string): string {
  if (!/["\n\r,]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * One CSV field.
 *
 * ── A STRING THAT STARTS LIKE A FORMULA GETS A LEADING QUOTE ───────────────
 * Applicants type their own phone number, social handle, faculty and law
 * school, and a spreadsheet runs a cell starting with = + - @, a tab or a
 * carriage return as a formula. The rule, set 2026-09-11: prefix a single quote
 * to a STRING cell starting with one of those, and leave numbers alone.
 *
 * Measured on the live data the same night: 75 of the 153 applications have a
 * phone number starting with "+" and 31 have a social handle starting with "@",
 * so those cells now open as text with a visible leading quote. Without it
 * Excel turns "+2348012345678" into a number and drops the plus, and shows
 * #NAME? for an @handle. Across the 114 financials rows no text cell started
 * with one of those characters, and the only amount was a plain decimal, so the
 * financials file came out unchanged.
 *
 * A number is never a formula, and a `CsvNumericText` is an amount already
 * checked to be a plain decimal, so neither is touched.
 */
function csvField(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return quoteIfNeeded(String(value));
  if (typeof value === 'object') return quoteIfNeeded(value.numericText);
  const text = FORMULA_START.has(value.charAt(0)) ? `'${value}` : value;
  return quoteIfNeeded(text);
}

/**
 * A whole file: the header, then one line per row, CRLF between lines as RFC
 * 4180 has it, and every cell through `csvField`, which quotes and neutralises
 * formulas. The applications export builds its file with this too, so the two
 * files quote alike and both carry the guard.
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
 *
 * Amounts go through `csvAmount`, so a negative one would still sum.
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
      ...currencies.map((code) => csvAmount(row.revenue?.[code])),
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
