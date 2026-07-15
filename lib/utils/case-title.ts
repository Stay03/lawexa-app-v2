/**
 * Returns the title intended for display by the case API. The legacy `title`
 * remains as a fallback while clients and cached API responses are updated.
 */
export function getCaseDisplayTitle(caseItem: {
  title?: string | null;
  display_title?: string | null;
}): string {
  return caseItem.display_title ?? caseItem.title ?? 'Untitled case';
}
