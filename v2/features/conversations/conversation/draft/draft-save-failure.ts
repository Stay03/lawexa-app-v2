/**
 * draft-save-failure — what a failed Save as note says under the button in the
 * draft panel. Pure, so the wording is tested.
 */

/** The newer-copy refusal (409) and the size cap (413) by name; anything else as a retry. */
export function saveFailureSentence(error: unknown): string {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 409) return 'This note was changed somewhere else. Open it to see the newer copy.';
  if (status === 413) return 'This draft is too large to save as one note.';
  return "Couldn't save the note. Check your connection and try again.";
}
