'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Rename, for a template. Mounted per open (the host keys it), so the field
 * starts from the name it is changing. The server's sentence shows under the
 * field when it refuses.
 */
export function RenameDialog({
  open,
  current,
  pending,
  error,
  onSave,
  onClose,
}: {
  open: boolean;
  current: string;
  pending: boolean;
  error: string | null;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(current);
  const trimmed = name.trim();
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed && trimmed !== current) onSave(trimmed);
          }}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>Rename template</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              value={name}
              maxLength={255}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              aria-invalid={error !== null}
              aria-describedby={error ? 'template-name-error' : undefined}
            />
            {error ? (
              <p id="template-name-error" role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!trimmed || trimmed === current || pending}>
              {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Delete one template or skill. Its "always" Spaces end with it, so the line says so when it has any. */
export function DeleteItemDialog({
  open,
  kind,
  name,
  spaces,
  pending,
  onDelete,
  onClose,
}: {
  open: boolean;
  kind: 'template' | 'skill';
  name: string;
  spaces: number;
  pending: boolean;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <AlertDialogContent className="sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Lawexa stops using this {kind} in your chats.
            {spaces > 0 ? ` It also stops in the ${spaces === 1 ? 'Space' : `${spaces} Spaces`} where you allowed it.` : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              onDelete();
            }}
            disabled={pending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
