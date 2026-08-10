'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import {
  useCreateSpace,
  useMyOrganization,
  useUpdateSpace,
} from '@/lib/hooks/useCollab';
import { extractApiError } from '@/lib/utils/api-error';
import type { Space, SpaceType } from '@/types/collab';

interface SpaceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Presence switches the dialog into edit mode. */
  space?: Space;
}

/**
 * Create or edit a space. On create it can be personal or org-owned; the owning
 * organization is immutable on edit, so that field is hidden there.
 */
export function SpaceFormDialog({
  open,
  onOpenChange,
  space,
}: SpaceFormDialogProps) {
  const isEdit = !!space;
  const router = useRouter();
  const createSpace = useCreateSpace();
  const updateSpace = useUpdateSpace();
  const myOrg = useMyOrganization().data?.data ?? null;

  const [name, setName] = useState(space?.name ?? '');
  const [type, setType] = useState<SpaceType>(space?.type ?? 'work');
  const [description, setDescription] = useState(space?.description ?? '');
  const [isPrivate, setIsPrivate] = useState(space?.is_private ?? true);
  const [orgChoice, setOrgChoice] = useState<string>(
    space?.organization?.uuid ?? 'personal'
  );
  const [error, setError] = useState<string | null>(null);
  const submitting = createSpace.isPending || updateSpace.isPending;

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setError(null);
    try {
      if (isEdit && space) {
        await updateSpace.mutateAsync({
          uuid: space.uuid,
          payload: {
            name: trimmed,
            type,
            description: description.trim() || undefined,
            is_private: isPrivate,
          },
        });
        toast.success('Space updated');
        onOpenChange(false);
      } else {
        const response = await createSpace.mutateAsync({
          name: trimmed,
          type,
          description: description.trim() || undefined,
          is_private: isPrivate,
          organization_uuid:
            orgChoice !== 'personal' ? orgChoice : undefined,
        });
        toast.success('Space created');
        onOpenChange(false);
        router.push(`/spaces/${response.data.uuid}`);
      }
    } catch (err) {
      setError(extractApiError(err).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit space' : 'Create a space'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this space’s details.'
              : 'Spaces group your channels for a team or a subject.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="space-name">Name</Label>
            <Input
              id="space-name"
              autoFocus
              maxLength={255}
              placeholder="e.g. Firm HQ"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as SpaceType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work">Work</SelectItem>
                  <SelectItem value="study">Study</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!isEdit && myOrg && (
              <div className="space-y-2">
                <Label>Owner</Label>
                <Select value={orgChoice} onValueChange={setOrgChoice}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value={myOrg.uuid}>{myOrg.name}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="space-description">Description</Label>
            <Textarea
              id="space-description"
              maxLength={5000}
              rows={3}
              placeholder="What is this space for?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            {/* THE OFF STATE HAS TO SAY WHAT IT DOES. This read "Private space /
                Only invited members can find and join it" with nothing anywhere
                about turning it OFF — and since 2026-08-10 off means anybody on
                Lawexa can find the space and walk in. Two of the three spaces
                that were accidentally public were made through this switch.
                The sentence now follows the switch, so it describes the setting
                you are actually leaving it on. */}
            <div>
              <p className="text-sm font-medium">Private space</p>
              <p className="text-xs text-muted-foreground">
                {isPrivate
                  ? 'Only invited members can find and join it.'
                  : 'Off: anyone on Lawexa can find this space and join it.'}
              </p>
            </div>
            <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !name.trim()}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create space'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
