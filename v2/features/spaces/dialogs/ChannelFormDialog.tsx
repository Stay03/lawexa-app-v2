'use client';

import { useId, useState } from 'react';
import { Hash, Loader2, Lock } from 'lucide-react';

import { cn } from '@/lib/utils';
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
import { Textarea } from '@/components/ui/textarea';
import { extractApiError } from '@/lib/utils/api-error';
import type { ChannelVisibility } from '@/types/collab';
import { ChoiceCards, type Choice } from '@/v2/features/collab/kit/ChoiceCards';
import { CHANNEL_DESCRIPTION_MAX, CHANNEL_NAME_MAX } from '../model';
import { useCreateChannel } from '../mutations';

/**
 * ChannelFormDialog — create a channel inside a space (space owner/admin).
 *
 * ── VISIBILITY IS A FORK, NOT A DROPDOWN ───────────────────────────────────
 * It used to be a `Select` whose two options were whole sentences, so the
 * consequence of the choice was readable only while the menu was open and
 * invisible the moment it closed. It is a `ChoiceCards` pair now: both
 * outcomes on screen, both explained, one glyph each — and the glyph is the
 * same one the channel will wear everywhere afterwards.
 *
 * ── THE PREVIEW IS THE HEADER IT WILL ACTUALLY GET ─────────────────────────
 * The strip at the top renders the channel's own header: the visibility glyph
 * (swapping the instant the fork changes), `#` plus the live name, and the
 * purpose underneath exactly where the real header puts it. The purpose field
 * is labelled by its question for the same reason — you can see where the
 * answer lands.
 *
 * The name is previewed AS TYPED. The brief wanted a normalised result shown
 * under the field; the server's normalisation rule is not in any contract we
 * hold, and inventing one would teach a transformation that may not happen.
 * The placeholder and the hint teach the convention instead, and the `#`
 * prefix on the field says what kind of name this is.
 *
 * CREATE ONLY, deliberately. Editing a channel belongs to the channel screen,
 * where the reader can see what they are changing — and where the settings
 * that only make sense in context (`ai_mentions_notify`, `quiz_host_policy`)
 * already live. Splitting create from edit is what keeps this dialog to the
 * three decisions that have to be made before a channel can exist.
 *
 * ── SUCCESS IS REPORTED, NOT ACTED ON ──────────────────────────────────────
 * Nobody creates a channel in order to look at a list, so the reader does land
 * IN the new channel — but the dialog raises {@link onCreated} and the SCREEN
 * performs the move. That split is required by the URL overlay contract: a
 * dialog closing as part of a move must rewrite its history entry
 * (`closeInPlace`) rather than pop it, or the navigation lands on the entry the
 * pop is about to discard. Only the screen holds that overlay handle, so only
 * the screen can close it correctly.
 *
 * Failures surface inline (`silentError` mutation) — a duplicate name or a
 * policy refusal is an answer, not an interruption.
 */

const VISIBILITY_CHOICES: readonly Choice<ChannelVisibility>[] = [
  {
    value: 'space_public',
    icon: Hash,
    title: 'Open to the space',
    description: 'Everyone in the space can find it and join.',
  },
  {
    value: 'private',
    icon: Lock,
    title: 'Private',
    description: 'Invite only. It stays hidden from the rest of the space.',
  },
];

export function ChannelFormDialog({
  open,
  onOpenChange,
  spaceUuid,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceUuid: string;
  /** The channel exists. The host closes IN PLACE and navigates — see above. */
  onCreated: (channelUuid: string) => void;
}) {
  const uid = useId();
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
        onSuccess: (response) => onCreated(response.data.uuid),
        onError: (failure) => setError(extractApiError(failure).message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a channel</DialogTitle>
          <DialogDescription>
            Channels are where the conversation happens — one per topic works
            better than one per person.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ChannelPreview
            name={name}
            visibility={visibility}
            description={description}
          />

          <div className="space-y-2">
            <Label htmlFor={`${uid}-name`}>Name</Label>
            <div className="relative">
              <span
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
              >
                #
              </span>
              <Input
                id={`${uid}-name`}
                className="pl-7"
                maxLength={CHANNEL_NAME_MAX}
                placeholder="general"
                aria-describedby={`${uid}-name-hint`}
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
            <p id={`${uid}-name-hint`} className="text-xs text-muted-foreground">
              Short and lowercase reads best — <code>general</code>,{' '}
              <code>matter-4471</code>.
            </p>
          </div>

          <ChoiceCards
            legend="Who can join"
            choices={VISIBILITY_CHOICES}
            value={visibility}
            onChange={setVisibility}
          />

          <div className="space-y-2">
            <Label htmlFor={`${uid}-description`}>
              What&rsquo;s this channel for?
            </Label>
            <Textarea
              id={`${uid}-description`}
              maxLength={CHANNEL_DESCRIPTION_MAX}
              rows={3}
              aria-describedby={`${uid}-description-hint`}
              placeholder="Filings, hearings and deadlines for matter 4471."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <p id={`${uid}-description-hint`} className="text-xs text-muted-foreground">
              Optional. It shows in the channel header and greets whoever opens
              it first.
            </p>
          </div>

          {error && (
            <p
              role="alert"
              className="text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
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

/** The channel header as it will render. `aria-hidden` — everything in it is
 *  already the announced state of the control that set it. */
function ChannelPreview({
  name,
  visibility,
  description,
}: {
  name: string;
  visibility: ChannelVisibility;
  description: string;
}) {
  const Glyph = visibility === 'private' ? Lock : Hash;
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  return (
    <div
      aria-hidden
      className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border bg-secondary/30 px-3 py-2.5"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground">
        <Glyph className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block min-w-0 truncate text-sm font-semibold',
            trimmedName ? 'text-foreground' : 'text-muted-foreground/60',
          )}
        >
          {trimmedName ? `#${trimmedName}` : '#your-channel'}
        </span>
        <span className="block min-w-0 truncate text-xs text-muted-foreground">
          {trimmedDescription ||
            (visibility === 'private'
              ? 'Private — invite only'
              : 'Open to everyone in the space')}
        </span>
      </span>
    </div>
  );
}
