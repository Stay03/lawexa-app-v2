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
  ocr_cap_from?: 'own_plan' | 'space_plan' | null;
}

export interface ScanLines {
  /** "Reading pages… 40 of 250", while the pages are being read. */
  reading: string | null;
  /** "12 pages of this scan are past your plan". */
  pastPlan: string | null;
  /** Whether the plans link goes with `pastPlan`: only for the reader's own plan. */
  plansLink: boolean;
  /** "Some pages couldn’t be read.", for a failed or partly unread scan. */
  unread: string | null;
  /**
   * What a screen reader hears, once at the start and once at the end, not
   * on every count: the region holding it stays mounted.
   */
  announce: string;
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

/**
 * Whose plan the pages past the cap belong to. A Space or channel file is read
 * to the Space holder's plan, so a member is not sent to the plans for it; a
 * server that does not say keeps the plain words and no link.
 */
function pastPlanWords(facts: ScanFacts): { place: string; plansLink: boolean } {
  if (facts.ocr_cap_from === 'own_plan') return { place: 'your plan', plansLink: true };
  if (facts.ocr_cap_from === 'space_plan') return { place: 'this Space’s plan', plansLink: false };
  return { place: 'the plan’s limit', plansLink: false };
}

export function scanLines(facts: ScanFacts | null | undefined): ScanLines {
  const none: ScanLines = { reading: null, pastPlan: null, plansLink: false, unread: null, announce: '' };
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

  const words = pastPlanWords(facts);
  const pastPlan =
    past > 0 ? `${count(past)} ${past === 1 ? 'page' : 'pages'} of this scan ${past === 1 ? 'is' : 'are'} past ${words.place}` : null;

  // `partial` with nothing past the plan means some pages could not be read.
  const unread =
    facts.ocr_status === 'failed' || (facts.ocr_status === 'partial' && past === 0)
      ? 'Some pages couldn’t be read.'
      : null;

  const announce =
    facts.ocr_status === 'pending'
      ? 'Reading the scanned pages.'
      : facts.ocr_status === 'done'
        ? 'The scanned pages are read.'
        : [pastPlan, unread].filter(Boolean).join(' ');

  return { reading, pastPlan, plansLink: past > 0 && words.plansLink, unread, announce };
}
