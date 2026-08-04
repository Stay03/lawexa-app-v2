'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { extractApiError } from '@/lib/utils/api-error';
import type { Space, SpaceType } from '@/types/collab';
import { organizationsQueries } from '@/v2/features/organizations/queries';
import { SPACE_DESCRIPTION_MAX, SPACE_NAME_MAX } from '../model';
import { useCreateSpace, useUpdateSpace } from '../mutations';

/**
 * SpaceFormDialog — create or edit a space (study A1: KEEP, "behavior is
 * right", restyled on v2 primitives).
 *
 * THE OWNING ORGANIZATION IS IMMUTABLE, and that is why the field only exists
 * in create mode: `PUT /spaces/{uuid}` takes no `organization_uuid`, so
 * offering the control on edit would be offering a change the server cannot
 * make. It only appears at all when the caller HAS an organization —
 * `organization_uuid` is accepted from an org owner/admin, and the server has
 * the final say (a 422 lands inline, in its own words).
 *
 * FAILURES ARE INLINE, never a toast: both mutations are `silentError`, and
 * the sentence appears under the fields it is about, next to the button that
 * produced it. On create the dialog closes and the router lands on the new
 * space — the reader's next move is always into it.
 *
 * Phase-5 W4, 2026-08-04.
 */
export function SpaceFormDialog({
  open,
  onOpenChange,
  space,
  viewerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Presence switches the dialog into edit mode. */
  space?: Space;
  viewerId: number | null;
}) {
  const isEdit = !!space;
  const router = useRouter();

  const createSpace = useCreateSpace();
  const updateSpace = useUpdateSpace(space?.uuid ?? '');

  // Only asked for in create mode, and only to decide whether the owner
  // control is offered at all.
  const myOrganization = useQuery({
    ...organizationsQueries.mine({ viewerId }),
    enabled: open && !isEdit,
  });
  const organization = myOrganization.data?.data ?? null;

  const [name, setName] = useState(space?.name ?? '');
  const [type, setType] = useState<SpaceType>(space?.type ?? 'work');
  const [description, setDescription] = useState(space?.description ?? '');
  const [isPrivate, setIsPrivate] = useState(space?.is_private ?? true);
  const [owner, setOwner] = useState<string>(space?.organization?.uuid ?? 'personal');
  const [error, setError] = useState<string | null>(null);

  const submitting = createSpace.isPending || updateSpace.isPending;
  const canSubmit = name.trim().length > 0 && !submitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    setError(null);

    if (isEdit && space) {
      updateSpace.mutate(
        {
          name: trimmedName,
          type,
          description: trimmedDescription || undefined,
          is_private: isPrivate,
        },
        {
          onSuccess: () => onOpenChange(false),
          onError: (failure) => setError(extractApiError(failure).message),
        },
      );
      return;
    }

    createSpace.mutate(
      {
        name: trimmedName,
        type,
        description: trimmedDescription || undefined,
        is_private: isPrivate,
        organization_uuid: owner === 'personal' ? undefined : owner,
      },
      {
        onSuccess: (response) => {
          onOpenChange(false);
          router.push(`/spaces/${response.data.uuid}`);
        },
        onError: (failure) => setError(extractApiError(failure).message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit space' : 'Create a space'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this space’s details. Everyone in it sees the change.'
              : 'A space groups channels for one team, one matter or one subject.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="space-name">Name</Label>
            <Input
              id="space-name"
              maxLength={SPACE_NAME_MAX}
              placeholder="e.g. Firm HQ"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                // IME Enter confirms the composition; it must never submit.
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="space-type">Type</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as SpaceType)}
              >
                <SelectTrigger id="space-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work">Work</SelectItem>
                  <SelectItem value="study">Study</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!isEdit && organization ? (
              <div className="space-y-2">
                <Label htmlFor="space-owner">Owner</Label>
                <Select value={owner} onValueChange={setOwner}>
                  <SelectTrigger id="space-owner" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value={organization.uuid}>
                      {organization.name}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="space-description">Description</Label>
            <Textarea
              id="space-description"
              maxLength={SPACE_DESCRIPTION_MAX}
              rows={3}
              placeholder="What is this space for?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="space-private" className="text-sm font-medium">
                Private space
              </Label>
              <p className="text-xs text-muted-foreground">
                Only invited members can find it and join.
              </p>
            </div>
            <Switch
              id="space-private"
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
            >
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create space'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
