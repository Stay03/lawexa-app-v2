import type { BulkItemId } from '@/v2/features/bulk/model';

/**
 * A Space's files' bulk actions for what is ticked (Arthur, 20 October
 * 2026: "keep the actions context-specific"; backend's rules, 21 October
 * 2026). Pure, so the rule is pinned by a test and the bar only draws what it
 * says.
 *
 *   always                          save copies to my files (any member)
 *   the reader is the Space's Owner remove from the space
 *   a ticked file the reader may delete (the Owner any, an Editor their own)
 *                                   delete
 *
 * With nothing ticked every action the reader could have shows, off.
 */
export type SpaceFilesBulkAction = 'copy_to_mine' | 'remove' | 'delete';

export function spaceFilesBulkActions({
  ticked,
  deletable,
  canRemove,
  mayDelete,
}: {
  /** How many files are ticked. */
  ticked: number;
  /** How many of them the reader may delete (`canDeleteSpaceFile`). */
  deletable: number;
  /** The reader is the Space's content Owner (`canRemoveFromSpace`). */
  canRemove: boolean;
  /** The reader may delete some file here at all (an Owner or an Editor). */
  mayDelete: boolean;
}): SpaceFilesBulkAction[] {
  const actions: SpaceFilesBulkAction[] = ['copy_to_mine'];
  if (canRemove) actions.push('remove');
  if (ticked === 0 ? mayDelete : deletable > 0) actions.push('delete');
  return actions;
}

/** A file's id from a result: the server echoes each `{type: 'file', id}` as sent. */
export function spaceFileIdOf(id: BulkItemId): number | null {
  if (typeof id !== 'object') return null;
  const value = Number(id.id);
  return Number.isFinite(value) ? value : null;
}
