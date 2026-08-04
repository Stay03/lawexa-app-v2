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
import type { QuizHostPolicy } from '@/types/channel-quiz';
import type { Channel, ChannelVisibility } from '@/types/collab';
import { useUpdateChannel } from '../membership-mutations';
import { readQuizHostPolicy } from '../quiz/model';

/**
 * ChannelEditDialog — owner/admin channel settings: name, visibility,
 * description, and the `ai_mentions_notify` switch (Ruling B's channel-side
 * knob — OFF by default so Lawexa can't ping everyone; digest §D). A v2 port
 * of v1's `ChannelFormDialog` in EDIT mode only — creation belongs to the W4
 * space screen. Failures surface inline (`silentError` mutation). Phase-5 W2,
 * study A3 KEEP — 2026-08-04.
 *
 * W6 ADDED `quiz_host_policy` (`all_members` | `admins_only`), the channel
 * setting that gates BOTH writing a quiz and putting one live. It waited for
 * this wave on purpose: a knob with no feature behind it is a dead control.
 * Unknown values behave as `all_members` server-side, and `readQuizHostPolicy`
 * mirrors that exactly, so a channel whose settings predate the feature opens
 * this dialog on the true default rather than on a guess.
 *
 * BOTH SWITCHES RIDE THE UNTYPED `settings` BAG, which is why every save
 * SPREADS the channel's existing settings first: this dialog must never drop a
 * key it doesn't know about.
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
  const [quizHostPolicy, setQuizHostPolicy] = useState<QuizHostPolicy>(() =>
    readQuizHostPolicy(channel.settings),
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
          quiz_host_policy: quizHostPolicy,
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

          <div className="space-y-2">
            <Label htmlFor="channel-quiz-host-policy">Who can run quizzes</Label>
            <Select
              value={quizHostPolicy}
              onValueChange={(value) =>
                setQuizHostPolicy(value as QuizHostPolicy)
              }
            >
              <SelectTrigger id="channel-quiz-host-policy" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_members">
                  Anyone in the channel
                </SelectItem>
                <SelectItem value="admins_only">Admins only</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Covers both writing a quiz and starting a live game. Everyone can
              play either way.
            </p>
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
