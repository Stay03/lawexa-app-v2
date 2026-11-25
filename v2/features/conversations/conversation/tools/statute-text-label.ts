/**
 * The step line for search_statute_text, a search inside one statute's text
 * (25 November 2026: it read as a bare "Search Statute Text"). Its arguments
 * are { statute: slug, query }. The line names the statute by its title when
 * one is known, else by the slug written as words.
 */

/** A statute's slug as words: "nigerian-ports-authority-act-1999" → "Nigerian Ports Authority Act 1999". */
export function statuteFromSlug(slug: unknown): string | null {
  if (typeof slug !== 'string' || !slug.trim()) return null;
  return slug
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function searchStatuteTextLabel(
  parameters: Record<string, unknown>,
  isComplete: boolean,
  /** The statute's title from the result or its metadata, when there is one. */
  title: string | null,
): { action: string; detail?: string } {
  const statute = title || statuteFromSlug(parameters.statute);
  const query = typeof parameters.query === 'string' && parameters.query.trim() ? parameters.query.trim() : null;
  const where = statute ? `in ${statute}` : null;
  const what = query ? `for "${query}"` : null;
  return {
    action: isComplete ? 'Searched statute text' : 'Searching statute text',
    detail: [where, what].filter(Boolean).join(' ') || undefined,
  };
}
