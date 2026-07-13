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
import { useCreateChannel, useUpdateChannel } from '@/lib/hooks/useCollab';
import { extractApiError } from '@/lib/utils/api-error';
import type { Channel, ChannelVisibility } from '@/types/collab';

interface ChannelFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceUuid: string;
  /** Presence switches the dialog into edit mode. */
  channel?: Channel;
}

/** Create or edit a channel within a space. */
export function ChannelFormDialog({
  open,
  onOpenChange,
  spaceUuid,
  channel,
}: ChannelFormDialogProps) {
  const isEdit = !!channel;
  const router = useRouter();
  const createChannel = useCreateChannel(spaceUuid);
  const updateChannel = useUpdateChannel(channel?.uuid ?? '');

  const [name, setName] = useState(channel?.name ?? '');
  const [visibility, setVisibility] = useState<ChannelVisibility>(
    channel?.visibility ?? 'space_public'
  );
  const [description, setDescription] = useState(channel?.description ?? '');
  const [aiMentionsNotify, setAiMentionsNotify] = useState<boolean>(
    Boolean(channel?.settings?.ai_mentions_notify)
  );
  const [error, setError] = useState<string | null>(null);
  const submitting = createChannel.isPending || updateChannel.isPending;

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setError(null);
    try {
      if (isEdit && channel) {
        await updateChannel.mutateAsync({
          name: trimmed,
          visibility,
          description: description.trim() || undefined,
          settings: {
            ...(channel?.settings ?? {}),
            ai_mentions_notify: aiMentionsNotify,
          },
        });
        toast.success('Channel updated');
        onOpenChange(false);
      } else {
        const response = await createChannel.mutateAsync({
          name: trimmed,
          visibility,
          description: description.trim() || undefined,
        });
        toast.success('Channel created');
        onOpenChange(false);
        router.push(`/channels/${response.data.uuid}`);
      }
    } catch (err) {
      setError(extractApiError(err).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit channel' : 'Create a channel'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this channel’s details.'
              : 'Channels are where conversations happen inside a space.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel-name">Name</Label>
            <Input
              id="channel-name"
              autoFocus
              maxLength={80}
              placeholder="e.g. general"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Visibility</Label>
            <Select
              value={visibility}
              onValueChange={(value) =>
                setVisibility(value as ChannelVisibility)
              }
            >
              <SelectTrigger>
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
              maxLength={5000}
              rows={3}
              placeholder="What is this channel about?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          {isEdit && (
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="channel-ai-mentions-notify">
                  Notify members when Lawexa @mentions them
                </Label>
                <p className="text-xs text-muted-foreground">
                  Off by default, so Lawexa can&apos;t ping everyone. Human
                  @mentions always notify.
                </p>
              </div>
              <Switch
                id="channel-ai-mentions-notify"
                checked={aiMentionsNotify}
                onCheckedChange={setAiMentionsNotify}
              />
            </div>
          )}

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
            {isEdit ? 'Save changes' : 'Create channel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
