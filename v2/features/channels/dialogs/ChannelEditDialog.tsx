'use client';

import { useState } from 'react';
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
import type { Channel, ChannelVisibility } from '@/types/collab';
import { useUpdateChannel } from '../membership-mutations';

/**
 * ChannelEditDialog — owner/admin channel settings: name, visibility,
 * description, and the `ai_mentions_notify` switch (Ruling B's channel-side
 * knob — OFF by default so Lawexa can't ping everyone; digest §D). A v2 port
 * of v1's `ChannelFormDialog` in EDIT mode only — creation belongs to the W4
 * space screen. `quiz_host_policy` joins this dialog with W6 (the setting
 * exists server-side; surfacing a control before the quiz UI exists would be
 * a dead knob). Failures surface inline (`silentError` mutation). Phase-5
 * W2, study A3 KEEP — 2026-08-04.
 */
export function ChannelEditDialog({
  channel,
  open,
  onOpenChange,
}: {
  channel: Channel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateChannel = useUpdateChannel(channel.uuid);

  const [name, setName] = useState(channel.name);
  const [visibility, setVisibility] = useState<ChannelVisibility>(channel.visibility);
  const [description, setDescription] = useState(channel.description ?? '');
  const [aiMentionsNotify, setAiMentionsNotify] = useState<boolean>(
    Boolean(channel.settings?.ai_mentions_notify),
  );
  const [error, setError] = useState<string | null>(null);

  const submitting = updateChannel.isPending;
  const canSubmit = name.trim().length > 0 && !submitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setError(null);
    updateChannel.mutate(
      {
        name: name.trim(),
        visibility,
        description: description.trim() || undefined,
        settings: {
          ...(channel.settings ?? {}),
          ai_mentions_notify: aiMentionsNotify,
        },
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (mutationError) =>
          setError(extractApiError(mutationError).message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit channel</DialogTitle>
          <DialogDescription>
            Update this channel&rsquo;s details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel-name">Name</Label>
            <Input
              id="channel-name"
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Visibility</Label>
            <Select
              value={visibility}
              onValueChange={(value) => setVisibility(value as ChannelVisibility)}
            >
              <SelectTrigger className="w-full">
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

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="channel-ai-mentions-notify">
                Notify members when Lawexa @mentions them
              </Label>
              <p className="text-xs text-muted-foreground">
                Off by default, so Lawexa can&rsquo;t ping everyone. Human
                @mentions always notify.
              </p>
            </div>
            <Switch
              id="channel-ai-mentions-notify"
              checked={aiMentionsNotify}
              onCheckedChange={setAiMentionsNotify}
            />
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
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 aria-hidden className="size-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
