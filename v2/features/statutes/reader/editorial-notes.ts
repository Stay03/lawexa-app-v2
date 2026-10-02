/**
 * An editorial notes block: the publisher's notes on the law ("Textual
 * Amendments", "Modifications etc. (not altering text)", "Marginal
 * Citations" in a legislation.gov.uk export), not the law's own words.
 *
 * The importer keeps no name or class on a stored part, so the one marker
 * that survives an import is the eId: backend's builder gives every notes
 * block an `hcontainer` whose eId ends in `notes-N` (a2b848cc, 2 October
 * 2026, for the Wills Act 1837).
 */
const NOTES_EID = /(?:^|[_-])notes-\d+$/;

export function isEditorialNotesEid(eid: string | null | undefined): boolean {
  return typeof eid === 'string' && NOTES_EID.test(eid);
}
