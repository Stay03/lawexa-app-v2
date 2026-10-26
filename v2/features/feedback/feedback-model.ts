import type { FeedbackCategory, FeedbackContentType } from '@/types/feedback';

/**
 * feedback-model — what "Give feedback" offers on a case, a statute and a
 * note, and what it sends (v2 Stage 1, item 5: the old design has the button,
 * the new design lacked it). One model for all three, so a change to one
 * applies to all of them (Stay, 18 October 2026).
 *
 * THE SAME REPORT v1 SENDS. The issues are v1's, per type, word for word
 * (`components/feedback/feedback-constants.ts`), because the team reads these
 * reports by those words; the request is v1's `POST /feedback` through
 * `lib/api/feedback.ts` (`feedback_text`, `content_type`, `content_id`,
 * `attachments[]`). The text joins the ticked issues and the reader's own
 * words exactly as v1 does: "Issues: …" then "Details: …".
 *
 * Pure, no JSX, so the tests pin it.
 */

const SHARED_END: FeedbackCategory[] = [
  { id: 'no_issues', label: 'No issues, Lawexa rocks!' },
  { id: 'others', label: 'Others (Kindly tell us in the text box below)' },
];

export const FEEDBACK_CATEGORIES: Record<FeedbackContentType, readonly FeedbackCategory[]> = {
  case: [
    { id: 'app_crashed', label: 'The app crashed' },
    { id: 'unable_view_similar', label: 'I am unable to view similar case' },
    { id: 'unable_view_report', label: 'I am unable to view case full report' },
    { id: 'incomplete_facts', label: 'Incomplete facts of case' },
    { id: 'inaccurate_text', label: 'Inaccurate text provided' },
    { id: 'grammatical_errors', label: 'Grammatical Error in the text provided' },
    ...SHARED_END,
  ],
  note: [
    { id: 'app_crashed', label: 'The app crashed' },
    { id: 'unable_view_content', label: 'I am unable to view note content' },
    { id: 'formatting_issues', label: 'Formatting issues' },
    { id: 'inaccurate_text', label: 'Inaccurate text provided' },
    { id: 'grammatical_errors', label: 'Grammatical Error in the text provided' },
    ...SHARED_END,
  ],
  statute: [
    { id: 'app_crashed', label: 'The app crashed' },
    { id: 'unable_view_content', label: 'I am unable to view statute content' },
    { id: 'missing_sections', label: 'Missing sections or provisions' },
    { id: 'inaccurate_text', label: 'Inaccurate text provided' },
    { id: 'formatting_issues', label: 'Formatting issues' },
    ...SHARED_END,
  ],
};

/** The noun a sheet names its subject by. */
export const FEEDBACK_NOUN: Record<FeedbackContentType, string> = {
  case: 'case',
  note: 'note',
  statute: 'statute',
};

/** The longest the reader's own words may be (v1's limit). */
export const FEEDBACK_TEXT_MAX = 4500;
/** Pictures a report may carry, and the largest each may be (v1's limits). */
export const FEEDBACK_MAX_PICTURES = 4;
export const FEEDBACK_MAX_PICTURE_BYTES = 5 * 1024 * 1024;
export const FEEDBACK_PICTURE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
export const FEEDBACK_PICTURE_ACCEPT = '.jpg,.jpeg,.png,.gif,.webp';

/** Why a picture cannot go with the report, or null when it can. */
export function pictureRefusal(file: { name: string; type: string; size: number }): string | null {
  if (!(FEEDBACK_PICTURE_TYPES as readonly string[]).includes(file.type)) {
    return `${file.name} isn't a picture this can send (JPG, PNG, GIF or WebP).`;
  }
  if (file.size > FEEDBACK_MAX_PICTURE_BYTES) return `${file.name} is larger than 5 MB.`;
  return null;
}

/**
 * The report's text: the ticked issues by their words, then the reader's
 * own. Empty when there is nothing to send, which is the one case the sheet
 * refuses.
 */
export function feedbackText(
  type: FeedbackContentType,
  ticked: readonly string[],
  details: string,
): string {
  const labels = FEEDBACK_CATEGORIES[type]
    .filter((category) => ticked.includes(category.id))
    .map((category) => category.label);
  const parts: string[] = [];
  if (labels.length > 0) parts.push(`Issues: ${labels.join(', ')}`);
  if (details.trim()) parts.push(`Details: ${details.trim()}`);
  return parts.join('\n\n');
}

/**
 * Who may send feedback: an account, never a guest pass. The server refuses
 * a guest's report (403), so a guest is not offered the button (techlead, 26
 * October 2026; Arthur: a quiz question's report needs sign-in).
 */
export function canSendFeedback(session: { signedIn: boolean; role: string | null }): boolean {
  return session.signedIn && session.role !== null && session.role !== 'guest';
}
