/**
 * The Folders page's bulk actions for what is ticked (Arthur, 20 October
 * 2026: "keep the actions context-specific"). Pure, so the rule is pinned by
 * a test and the bar only draws what it says.
 *
 *   both kinds                      move to a space, delete
 *   folders only                    move, make private, make public, plus both
 *   files only                      add to a folder, plus both
 *   nothing ticked                  the shared two, off
 */
export type FoldersBulkAction = 'move' | 'add_to_folder' | 'space' | 'make_private' | 'make_public' | 'delete';

export function foldersBulkActions(ticked: { folders: number; files: number }): FoldersBulkAction[] {
  const actions: FoldersBulkAction[] = [];
  const onlyFolders = ticked.folders > 0 && ticked.files === 0;
  const onlyFiles = ticked.files > 0 && ticked.folders === 0;
  if (onlyFolders) actions.push('move');
  if (onlyFiles) actions.push('add_to_folder');
  actions.push('space');
  if (onlyFolders) actions.push('make_private', 'make_public');
  actions.push('delete');
  return actions;
}
