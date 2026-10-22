import type { RedactionSummary } from '@/types/chat';

/**
 * The words of the "Sent as redacted" line under a question in a redacted chat
 * (Stay chose option D, 22 October 2026; the techlead approved the breakdown
 * over the text, because the bubble already shows the redacted text Lawexa
 * received). Pure, so the tests pin every case.
 */

/** Singular and plural per kind (backend's `by_type` keys). */
const KIND_WORDS: Readonly<Record<string, readonly [string, string]>> = {
  PERSON: ['person', 'people'],
  ADDRESS: ['address', 'addresses'],
  PHONE: ['phone number', 'phone numbers'],
  EMAIL: ['email address', 'email addresses'],
  DOB: ['date of birth', 'dates of birth'],
  ACCOUNT: ['account number', 'account numbers'],
  BVN: ['BVN', 'BVNs'],
  NIN: ['NIN', 'NINs'],
  PASSPORT: ['passport number', 'passport numbers'],
  LICENSE: ['licence number', 'licence numbers'],
  TAX_ID: ['tax ID', 'tax IDs'],
  MEDICAL: ['medical detail', 'medical details'],
  ORG: ['organisation', 'organisations'],
  CASE_NUMBER: ['case number', 'case numbers'],
  OTHER: ['other detail', 'other details'],
};

/** The order kinds are named in: people first, then the rest as the backend lists them. */
const KIND_ORDER = Object.keys(KIND_WORDS);

export interface RedactionNote {
  /** The line under the question. */
  line: string;
  /** What opening the line shows, or null when there is nothing to open. */
  breakdown: string | null;
}

/**
 * The line and its breakdown for one question in a redacted chat.
 *
 *   no summary (a question from before the server sent one)   "Sent as redacted"
 *   nothing found                                             "Sent as redacted · nothing personal found"
 *   N found                                                   "Sent as redacted · N details hidden"
 *
 * The breakdown names each kind with its count, people first ("4 people,
 * 2 addresses, 1 phone number"). A kind the app does not know is counted as
 * other details, so a new kind from the server still adds up.
 */
export function redactionNote(summary: RedactionSummary | undefined): RedactionNote {
  if (!summary) return { line: 'Sent as redacted', breakdown: null };
  const count = summary.details_hidden;
  if (count === 0) return { line: 'Sent as redacted · nothing personal found', breakdown: null };
  return {
    line: `Sent as redacted · ${count} ${count === 1 ? 'detail' : 'details'} hidden`,
    breakdown: kindsSentence(summary.by_type),
  };
}

function kindsSentence(byType: Readonly<Record<string, number>>): string | null {
  const counts = new Map<string, number>();
  for (const [kind, count] of Object.entries(byType)) {
    if (count <= 0) continue;
    const known = kind in KIND_WORDS ? kind : 'OTHER';
    counts.set(known, (counts.get(known) ?? 0) + count);
  }
  const parts = KIND_ORDER.filter((kind) => counts.has(kind)).map((kind) => {
    const count = counts.get(kind) ?? 0;
    const [one, many] = KIND_WORDS[kind];
    return `${count} ${count === 1 ? one : many}`;
  });
  return parts.length > 0 ? parts.join(', ') : null;
}
