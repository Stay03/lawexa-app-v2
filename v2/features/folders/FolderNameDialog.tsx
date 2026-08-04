'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { extractApiError } from '@/lib/utils/api-error';
import { useCreateFolder, useRenameFolder } from './folder-mutations';
import { FOLDER_DEPTH_ENCOURAGED, folderHref } from './folder-row-model';

/**
 * FolderNameDialog — ONE dialog for the two things you can do to a folder's
 * name: create one, or change one.
 *
 * ── WHY ONE AND NOT v1's TWO ────────────────────────────────────────────────
 * v1 shipped `CreateFolderDialog` (259 lines) and `EditFolderDialog` (260),
 * about 95% identical, each with a name, a description, a 12-icon picker, a
 * 10-swatch colour picker and a public/private toggle. Every one of those extra
 * controls is gone by decision: monochrome glyphs only (decision 2), every
 * folder private with no toggle (decision 3), and a description nobody was
 * reading. What is left is the one field that names the thing — which is also
 * the whole form the picker's inline "Create folder" row needs, so the two
 * surfaces cannot drift into two different ideas of what creating a folder is.
 *
 * ── MOUNTED ONLY WHILE OPEN ─────────────────────────────────────────────────
 * Hosts render this conditionally (`{renaming && <FolderNameDialog …/>}`), so
 * the field initialises from the folder it is actually naming on every open —
 * no props-into-state effect, and no stale value from the last folder.
 *
 * ── DEPTH IS ENCOURAGED, NEVER BLOCKED ──────────────────────────────────────
 * The API nests without limit (eight levels probed) and filing practice says
 * three is where a tree stops helping. So a fourth level gets a quiet sentence
 * and the same working button — a warning, not a wall (decision 1).
 */

export type FolderNameDialogIntent =
  | {
      mode: 'create';
      /** The folder this one is created inside, or omitted for a root folder. */
      parent?: { uuid: string; name: string; depth: number };
    }
  | { mode: 'rename'; folder: { uuid: string; name: string } };

/** The server's own limit, measured: 256 characters answers 422. */
const NAME_MAX = 255;

export function FolderNameDialog({
  open,
  onOpenChange,
  intent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intent: FolderNameDialogIntent;
}) {
  const router = useRouter();
  const createFolder = useCreateFolder();
  // Called with `''` in create mode and never fired there — the rules of hooks
  // want both hooks unconditionally, and the endpoint is only ever reached
  // through the rename branch below.
  const renameFolder = useRenameFolder(
    intent.mode === 'rename' ? intent.folder.uuid : '',
  );

  const [name, setName] = useState(
    intent.mode === 'rename' ? intent.folder.name : '',
  );
  const [error, setError] = useState<string | null>(null);

  const submitting = createFolder.isPending || renameFolder.isPending;
  const trimmed = name.trim();
  const unchanged = intent.mode === 'rename' && trimmed === intent.folder.name.trim();
  const canSubmit = trimmed.length > 0 && !submitting && !unchanged;

  const parentDepth = intent.mode === 'create' ? (intent.parent?.depth ?? 0) : 0;
  const newDepth = parentDepth + 1;
  const deepNesting = newDepth > FOLDER_DEPTH_ENCOURAGED;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    // The dialog owns its own close: it stays open while the request is in
    // flight so the button can show its pending state, closes in `onSuccess`,
    // and keeps the reader's typing on a failure.
    const onError = (mutationError: Error) =>
      setError(extractApiError(mutationError).message);

    if (intent.mode === 'rename') {
      renameFolder.mutate(
        { name: trimmed },
        { onSuccess: () => onOpenChange(false), onError },
      );
      return;
    }

    createFolder.mutate(
      {
        name: trimmed,
        // Not a toggle the reader sees — v2 creates every folder private, and
        // the field is sent so the server is never left guessing (decision 3).
        is_private: true,
        parent_id: intent.parent?.uuid,
      },
      {
        onSuccess: (envelope) => {
          onOpenChange(false);
          const created = envelope.data;
          toast.success('Folder created', {
            description: `“${created.name}” is ready.`,
            action: {
              label: 'Open',
              onClick: () => router.push(folderHref(created.uuid)),
            },
          });
        },
        onError,
      },
    );
  };

  const isRename = intent.mode === 'rename';
  const parentName = intent.mode === 'create' ? intent.parent?.name : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {isRename ? 'Rename folder' : parentName ? 'New subfolder' : 'New folder'}
            </DialogTitle>
            <DialogDescription>
              {isRename
                ? 'Everything filed inside stays where it is.'
                : parentName
                  ? `Inside “${parentName}”. Only you can see it.`
                  : 'Group the cases, statutes and notes for one matter in one place. Only you can see it.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              autoFocus
              maxLength={NAME_MAX}
              placeholder="e.g. Adeyemi v Lagos State"
              value={name}
              onChange={(event) => setName(event.target.value)}
              // Renaming starts with the whole name selected, so typing
              // replaces it and the reader never has to clear the field first.
              onFocus={
                isRename ? (event) => event.currentTarget.select() : undefined
              }
              aria-describedby={
                error ? 'folder-name-error' : deepNesting ? 'folder-name-depth' : undefined
              }
              aria-invalid={error ? true : undefined}
            />

            {deepNesting ? (
              <p id="folder-name-depth" className="text-xs text-muted-foreground">
                This would be level {newDepth}. Folders more than{' '}
                {FOLDER_DEPTH_ENCOURAGED} deep get hard to find again — you can
                still create it.
              </p>
            ) : null}

            {error ? (
              <p
                id="folder-name-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? (
                <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
              ) : null}
              {isRename ? 'Save name' : 'Create folder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
