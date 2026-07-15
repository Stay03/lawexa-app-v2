/**
 * Returns the complete case heading. `display_title` is the citation-free
 * title supplied by the API, so append its separate citation exactly once.
 * The legacy `title` remains as a fallback for cached API responses.
 */
export function getCaseDisplayTitle(caseItem: {
  title?: string | null;
  display_title?: string | null;
  citation?: string | null;
}): string {
  const title = caseItem.display_title ?? caseItem.title ?? 'Untitled case';
  const citation = caseItem.citation?.trim();

  return citation && !title.includes(citation) ? `${title}, ${citation}` : title;
}
