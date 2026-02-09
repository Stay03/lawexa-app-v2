import type { FeedbackCategory, FeedbackContentType } from '@/types/feedback';

/******************************************************************************
                               Constants
******************************************************************************/

const CASE_CATEGORIES: FeedbackCategory[] = [
  { id: 'app_crashed', label: 'The app crashed' },
  { id: 'unable_view_similar', label: 'I am unable to view similar case' },
  { id: 'unable_view_report', label: 'I am unable to view case full report' },
  { id: 'incomplete_facts', label: 'Incomplete facts of case' },
  { id: 'inaccurate_text', label: 'Inaccurate text provided' },
  { id: 'grammatical_errors', label: 'Grammatical Error in the text provided' },
  { id: 'no_issues', label: 'No issues, Lawexa rocks!' },
  { id: 'others', label: 'Others (Kindly tell us in the text box below)' },
];

const NOTE_CATEGORIES: FeedbackCategory[] = [
  { id: 'app_crashed', label: 'The app crashed' },
  { id: 'unable_view_content', label: 'I am unable to view note content' },
  { id: 'formatting_issues', label: 'Formatting issues' },
  { id: 'inaccurate_text', label: 'Inaccurate text provided' },
  { id: 'grammatical_errors', label: 'Grammatical Error in the text provided' },
  { id: 'no_issues', label: 'No issues, Lawexa rocks!' },
  { id: 'others', label: 'Others (Kindly tell us in the text box below)' },
];

const FEEDBACK_CATEGORIES: Record<FeedbackContentType, FeedbackCategory[]> = {
  case: CASE_CATEGORIES,
  note: NOTE_CATEGORIES,
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 4;
const ACCEPTED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];
const ACCEPT_STRING = '.jpg,.jpeg,.png,.gif,.webp';

/******************************************************************************
                               Functions
******************************************************************************/

/**
 * Validate a single file for size and type.
 */
function validateFile(file: File): string | null {
  if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
    return `${file.name}: File type not supported`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `${file.name}: File exceeds 5MB limit`;
  }
  return null;
}

/**
 * Combine selected category labels and free text into a single feedback_text string.
 */
function buildFeedbackText(
  categories: string[],
  otherText: string,
  categoryOptions: FeedbackCategory[],
): string {
  const parts: string[] = [];
  // Map category IDs back to labels
  const selectedLabels = categories
    .map((id) => categoryOptions.find((c) => c.id === id)?.label)
    .filter(Boolean) as string[];
  if (selectedLabels.length > 0) {
    parts.push('Issues: ' + selectedLabels.join(', '));
  }
  if (otherText.trim()) {
    parts.push('Details: ' + otherText.trim());
  }
  return parts.join('\n\n');
}

/******************************************************************************
                               Export
******************************************************************************/

export {
  FEEDBACK_CATEGORIES,
  CASE_CATEGORIES,
  NOTE_CATEGORIES,
  MAX_FILE_SIZE,
  MAX_FILES,
  ACCEPTED_FILE_TYPES,
  ACCEPT_STRING,
  validateFile,
  buildFeedbackText,
};
