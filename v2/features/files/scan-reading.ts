import type { OcrStatus } from '@/types/file';

/**
 * scan-reading — what the PDF reader says about a scanned file's pages being
 * read into text (Stay's yes, thread 1c93152c, 04:17Z 1 November 2026: every
 * scanned upload is read when it is uploaded; Backend's contract in 384c,
 * dc79c07d). The file's answer carries four fields; this turns them into the
 * reader's lines. No React, so node:test reads it.
 *
 *   ocr_status       null (no scanned pages, or not a PDF) | pending | done
 *                    | partial (past the plan, or some pages unread) | failed
 *   scanned_pages    pages with no text of their own; null until looked at
 *   ocr_pages_read   of those, read into text so far
 *   ocr_pages_cap    how many the plan reads for this file; null = no limit
 */
export interface ScanFacts {
  ocr_status?: OcrStatus | null;
  scanned_pages?: number | null;
  ocr_pages_read?: number | null;
  ocr_pages_cap?: number | null;
}

export interface ScanLines {
  /** "Reading pages… 40 of 250", while the pages are being read. */
  reading: string | null;
  /** "12 pages of this scan are past your plan", shown with the plans link. */
  pastPlan: string | null;
  /** "Some pages couldn’t be read.", for a failed or partly unread scan. */
  unread: string | null;
}

/** How often the reader asks again while the pages are being read. */
export const SCAN_POLL_MS = 4000;

const count = (n: number) => n.toLocaleString('en-GB');

/** How many scanned pages fall past the plan's cap, or 0. */
function pagesPastPlan(facts: ScanFacts): number {
  const scanned = facts.scanned_pages ?? null;
  const cap = facts.ocr_pages_cap ?? null;
  if (scanned === null || cap === null) return 0;
  return Math.max(0, scanned - cap);
}

/** Whether the server is still reading the file's pages. */
export function isReadingPages(facts: ScanFacts | null | undefined): boolean {
  return facts?.ocr_status === 'pending';
}

export function scanLines(facts: ScanFacts | null | undefined): ScanLines {
  const none: ScanLines = { reading: null, pastPlan: null, unread: null };
  if (!facts?.ocr_status) return none;
  const past = pagesPastPlan(facts);
  const scanned = facts.scanned_pages ?? null;
  const cap = facts.ocr_pages_cap ?? null;

  let reading: string | null = null;
  if (facts.ocr_status === 'pending') {
    if (scanned === null) {
      reading = 'Reading pages…';
    } else {
      const total = cap === null ? scanned : Math.min(scanned, cap);
      reading = `Reading pages… ${count(facts.ocr_pages_read ?? 0)} of ${count(total)}`;
    }
  }

  const pastPlan =
    past > 0 ? `${count(past)} ${past === 1 ? 'page' : 'pages'} of this scan ${past === 1 ? 'is' : 'are'} past your plan` : null;

  // `partial` with nothing past the plan means some pages could not be read.
  const unread =
    facts.ocr_status === 'failed' || (facts.ocr_status === 'partial' && past === 0)
      ? 'Some pages couldn’t be read.'
      : null;

  return { reading, pastPlan, unread };
}
