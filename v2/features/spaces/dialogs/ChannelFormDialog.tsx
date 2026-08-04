'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Textarea } from '@/components/ui/textarea';
import { extractApiError } from '@/lib/utils/api-error';
import type { ChannelVisibility } from '@/types/collab';
import { CHANNEL_DESCRIPTION_MAX, CHANNEL_NAME_MAX } from '../model';
import { useCreateChannel } from '../mutations';

/**
 * ChannelFormDialog — create a channel inside a space (space owner/admin).
 *
 * CREATE ONLY, deliberately. Editing a channel belongs to the channel screen,
 * where the reader can see what they are changing — and where the settings
 * that only make sense in context (`ai_mentions_notify`, and W6's
 * `quiz_host_policy`) already live. Splitting create from edit is what keeps
 * this dialog to the three decisions that actually have to be made before a
 * channel can exist.
 *
 * The dialog closes and the router lands IN the new channel: nobody creates a
 * channel in order to look at a list. Failures surface inline (`silentError`
 * mutation) — a duplicate name or a policy refusal is an answer, not an
 * interruption. Phase-5 W4, study A2 KEEP — 2026-08-04.
 */
export function ChannelFormDialog({
  open,
  onOpenChange,
  spaceUuid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceUuid: string;
}) {
  const router = useRouter();
  const createChannel = useCreateChannel(spaceUuid);

  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<ChannelVisibility>('space_public');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submitting = createChannel.isPending;
  const canSubmit = name.trim().length > 0 && !submitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setError(null);
    createChannel.mutate(
      {
        name: name.trim(),
        visibility,
        description: description.trim() || undefined,
      },
      {
        onSuccess: (response) => {
          onOpenChange(false);
          router.push(`/channels/${response.data.uuid}`);
        },
        onError: (failure) => setError(extractApiError(failure).message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a channel</DialogTitle>
          <DialogDescription>
            Channels are where the conversation happens — one per topic works
            better than one per person.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel-name">Name</Label>
            <Input
              id="channel-name"
              maxLength={CHANNEL_NAME_MAX}
              placeholder="e.g. general"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-visibility">Visibility</Label>
            <Select
              value={visibility}
              onValueChange={(value) => setVisibility(value as ChannelVisibility)}
            >
              <SelectTrigger id="channel-visibility" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="space_public">
                  Public — anyone in the space
                </SelectItem>
                <SelectItem value="private">Private — invite only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-description">Description</Label>
            <Textarea
              id="channel-description"
              maxLength={CHANNEL_DESCRIPTION_MAX}
              rows={3}
              placeholder="What is this channel about?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
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
            Create channel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
