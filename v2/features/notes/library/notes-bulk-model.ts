/**
 * My notes' bulk actions for what is ticked (Arthur, 20 October 2026: "keep
 * the actions context-specific"). Pure, so the rule is pinned by a test and
 * the bar only draws what it says.
 *
 *   any draft ticked              publish
 *   any published note ticked     unpublish (back to a draft)
 *   always                        make private, make public, delete
 *
 * A row whose status the list did not carry counts as both, so neither
 * action is hidden on a guess. With nothing ticked every action shows, off.
 */
export type NotesBulkAction = 'publish' | 'unpublish' | 'make_private' | 'make_public' | 'delete';

export function notesBulkActions(ticked: { drafts: number; published: number; unknown: number }): NotesBulkAction[] {
  const none = ticked.drafts + ticked.published + ticked.unknown === 0;
  const actions: NotesBulkAction[] = [];
  if (none || ticked.drafts > 0 || ticked.unknown > 0) actions.push('publish');
  if (none || ticked.published > 0 || ticked.unknown > 0) actions.push('unpublish');
  actions.push('make_private', 'make_public', 'delete');
  return actions;
}
