'use client';

import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, Building2, Globe, GraduationCap, Loader2, Lock, User } from 'lucide-react';

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
import type { Space, SpaceType } from '@/types/collab';
import { ChoiceCards, type Choice } from '@/v2/features/collab/kit/ChoiceCards';
import { SpaceCrest } from '@/v2/features/collab/kit/Crest';
import { organizationsQueries } from '@/v2/features/organizations/queries';
import { SPACE_DESCRIPTION_MAX, SPACE_NAME_MAX } from '../model';
import { useCreateSpace, useUpdateSpace } from '../mutations';

/**
 * SpaceFormDialog — create or edit a space.
 *
 * ── THE FORKS ARE CARDS, NOT DROPDOWNS ─────────────────────────────────────
 * The two decisions that DEFINE the object — what kind of space this is and
 * who owns it — used to be two identical grey `Select`s, and privacy was a
 * `Switch` whose consequence sat in 12px muted text quieter than its own
 * label. All three are `ChoiceCards` now: a glyph, a title, and one sentence
 * saying what choosing it does, visible BEFORE the choice rather than behind a
 * dropdown. The keyboard model is the platform's own (see `ChoiceCards`).
 *
 * ── THE PREVIEW MAKES THE OBJECT VISIBLE WHILE IT IS BEING MADE ────────────
 * The right column shows the real `SpaceCrest` at 64px with the monogram
 * re-deriving on every keystroke, over the chips the finished space will carry.
 * The point is that nobody should fill in five fields to find out what they
 * built. In EDIT mode the crest is the space's actual crest, hue and all.
 *
 * IN CREATE MODE THE CREST HAS NO HUE, AND THAT IS THE HONEST RENDER. A
 * crest's colour comes from the uuid, which only exists once the server has
 * made the space (`crest-model.ts`). Deriving a preview hue from the NAME
 * would look better and be a lie — the crest would visibly change colour the
 * moment the space was created. So the preview shows the neutral ground with
 * the live monogram, and the colour arrives with the object.
 *
 * ── THE STARTER CHANNEL IS THE SERVER'S, NOT OURS ──────────────────────────
 * The open question here was whether creating `general` from the client would
 * duplicate a channel the backend already makes. It is answered: `POST
 * /api/spaces` creates a starter channel in the same transaction and returns it
 * as `default_channel`, so this dialog creates no channels and instead hands
 * the new channel's uuid to its host, which is what turns "create a space" into
 * "land in a room that works".
 *
 * MEASURED, NOT DOCUMENTED: `default_channel` is a REDUCED channel
 * ({@link Space.default_channel}) — no `is_member`, no `my_role`, no counts.
 * The uuid is all this flow takes from it, and the channel screen reads the
 * channel itself for everything viewer-scoped. It is also OPTIONAL, so a
 * response without it falls back to the space — an older API, a transaction
 * that made the space but not the channel, and any future shape change all
 * degrade to the behaviour that shipped before, never to a broken navigation.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ──────────────────────────────────────────
 * The brief's second step — an invite list in the same submit — is not in this
 * pass.
 *
 * THE OWNING ORGANIZATION IS IMMUTABLE, which is why that fork only exists in
 * create mode: `PUT /spaces/{uuid}` takes no `organization_uuid`, so offering
 * the control on edit would be offering a change the server cannot make. It
 * appears at all only when the caller HAS an organization — the server has the
 * final say (a 422 lands inline, in its own words).
 *
 * FAILURES ARE INLINE, never a toast: both mutations are `silentError`, and
 * the sentence appears under the fields it is about, next to the button that
 * produced it.
 *
 * ── CREATE REPORTS, IT DOES NOT NAVIGATE ───────────────────────────────────
 * The reader's next move after creating a space is always INTO the room, but
 * the dialog raises {@link onCreated} and the SCREEN performs the move. The URL
 * overlay contract requires it: a dialog closing as part of a move must
 * rewrite its history entry (`closeInPlace`) rather than pop it, or the
 * navigation lands on the entry the pop is about to discard. Only the screen
 * holds that overlay handle. An EDIT save is a dismissal, not a move, so it
 * closes through `onOpenChange` exactly as Cancel does.
 *
 * `onCreated` therefore carries BOTH halves of the destination — the space and
 * its starter channel — and {@link spaceCreationHref} turns them into the one
 * URL a host should push, so no caller has to re-derive the fallback rule.
 */

type Privacy = 'private' | 'open';

/**
 * Where a freshly created space lands its creator: THE ROOM when the server
 * made one, the space page otherwise.
 *
 * `defaultChannelUuid` is the starter channel `POST /api/spaces` creates in the
 * same transaction, and the creator is already its active owner — so they
 * arrive somewhere that works, with a composer, instead of at a channel list.
 *
 * The space page is now the FALLBACK rather than the destination. It stays
 * because `default_channel` is optional on the wire (an older API, a response
 * shape that moves, a transaction that made the space but not the channel), and
 * a space that exists is always a better landing than a broken navigation.
 *
 * Exported because the HOST navigates, not this dialog (see the note above), and
 * the rule must not be re-derived at each call site.
 */
export function spaceCreationHref(
  spaceUuid: string,
  defaultChannelUuid: string | null,
): string {
  return defaultChannelUuid
    ? `/channels/${defaultChannelUuid}`
    : `/spaces/${spaceUuid}`;
}

const TYPE_CHOICES: readonly Choice<SpaceType>[] = [
  {
    value: 'work',
    icon: Briefcase,
    title: 'Work',
    description: 'A firm, a team or a matter — where the work gets done.',
  },
  {
    value: 'study',
    icon: GraduationCap,
    title: 'Study',
    description: 'A course, a reading group or exam prep.',
  },
];

const PRIVACY_CHOICES: readonly Choice<Privacy>[] = [
  {
    value: 'private',
    icon: Lock,
    title: 'Private',
    description: 'Only invited members can find it or join.',
  },
  {
    value: 'open',
    icon: Globe,
    title: 'Open',
    description: 'Anyone can find it and join without an invitation.',
  },
];

export function SpaceFormDialog({
  open,
  onOpenChange,
  space,
  viewerId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Presence switches the dialog into edit mode. */
  space?: Space;
  viewerId: number | null;
  /**
   * CREATE MODE ONLY: the space exists, and the host closes in place and
   * navigates. Absent (the edit mounts), a successful create just closes.
   *
   * Both halves of the destination are handed over — the space, and the starter
   * channel the server created with it (`null` when the response carried none).
   * Feed them to {@link spaceCreationHref} for the URL to push.
   */
  onCreated?: (spaceUuid: string, defaultChannelUuid: string | null) => void;
}) {
  const isEdit = !!space;
  const uid = useId();

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
  const [privacy, setPrivacy] = useState<Privacy>(
    (space?.is_private ?? true) ? 'private' : 'open',
  );
  const [owner, setOwner] = useState<string>(space?.organization?.uuid ?? 'personal');
  const [error, setError] = useState<string | null>(null);

  const isPrivate = privacy === 'private';
  const submitting = createSpace.isPending || updateSpace.isPending;

  // An untouched edit form must not fire a PUT. Compared against the values the
  // dialog was mounted with, which the `openKey` remount keeps current.
  const changed =
    !isEdit ||
    name.trim() !== (space?.name ?? '') ||
    type !== space?.type ||
    description.trim() !== (space?.description ?? '') ||
    isPrivate !== (space?.is_private ?? true);

  const canSubmit = name.trim().length > 0 && changed && !submitting;

  const ownerChoices: readonly Choice<string>[] = organization
    ? [
        {
          value: 'personal',
          icon: User,
          title: 'Personal',
          description: 'Yours. You invite people to it directly.',
        },
        {
          value: organization.uuid,
          icon: Building2,
          title: organization.name,
          description: `Owned by ${organization.name}. Its admins can manage it too.`,
        },
      ]
    : [];

  const ownerLabel =
    owner === 'personal' ? 'Personal' : (organization?.name ?? 'Organization');

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
          const created = response.data;
          if (onCreated) {
            onCreated(created.uuid, created.default_channel?.uuid ?? null);
          } else onOpenChange(false);
        },
        onError: (failure) => setError(extractApiError(failure).message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* ── TALLER THAN A PHONE, SO IT IS BUILT AS THREE BANDS ──────────────
          A header that stays, a body that scrolls, a footer that stays.

          It used to be one block, and the block WAS the dialog. Measured on a
          360px phone it came to ~1,115px — the two `ChoiceCards` groups stack
          below `sm:` and cost ~217px each — inside a 640px screen. A centred
          box taller than the viewport hangs off BOTH ends by equal amounts, so
          Save, Cancel and the close X were all off-screen at once with no
          scroll anywhere able to reach them: the page is locked and the dialog
          is portalled outside the app's only scroll region. That is the bug
          Arthur photographed (owner review, 2026-08-07).

          `DialogContent` now caps and scrolls by default, which on its own
          makes Save reachable. This file goes further, because reachable-by-
          scrolling is not the same as reachable: the primary action of a long
          form should never be something the reader has to go looking for.
          `overflow-hidden` takes the scroller off the box, `flex flex-col`
          makes the middle band the only thing that moves, and Save stays in
          view at every height. Same shape as `QuizFormDialog`, which had
          already worked this out. */}
      <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 px-6 pt-6 pr-12 pb-4">
          <DialogTitle>{isEdit ? 'Edit space' : 'Create a space'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this space’s details. Everyone in it sees the change.'
              : 'A space groups channels for one team, one matter or one subject.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
          {/* The preview leads on a phone (you see the object before you
              describe it) and sits beside the fields from `sm` up. */}
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_13rem]">
            <div className="order-2 min-w-0 space-y-4 sm:order-1">
              <div className="space-y-2">
                <Label htmlFor={`${uid}-name`}>Name</Label>
                <Input
                  id={`${uid}-name`}
                  maxLength={SPACE_NAME_MAX}
                  placeholder="e.g. Firm HQ"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    // IME Enter confirms the composition; it must never submit.
                    if (
                      event.key === 'Enter' &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      handleSubmit();
                    }
                  }}
                />
              </div>

              <ChoiceCards
                legend="Type"
                choices={TYPE_CHOICES}
                value={type}
                onChange={setType}
              />

              {!isEdit && organization ? (
                <ChoiceCards
                  legend="Owner"
                  choices={ownerChoices}
                  value={owner}
                  onChange={setOwner}
                />
              ) : null}

              <div className="space-y-2">
                <Label htmlFor={`${uid}-description`}>Description</Label>
                <Textarea
                  id={`${uid}-description`}
                  maxLength={SPACE_DESCRIPTION_MAX}
                  rows={3}
                  placeholder="What is this space for?"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>

              <ChoiceCards
                legend="Who can join"
                choices={PRIVACY_CHOICES}
                value={privacy}
                onChange={setPrivacy}
              />
            </div>

            <div className="order-1 sm:order-2">
              <SpacePreview
                uuid={space?.uuid ?? null}
                name={name}
                type={type}
                isPrivate={isPrivate}
                ownerLabel={ownerLabel}
              />
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
            >
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-4">
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

/** The object as it is being made: its crest, its name, and the three facts the
 *  forks above decide. `aria-hidden` — every value in here is already the
 *  announced state of the control that set it. */
function SpacePreview({
  uuid,
  name,
  type,
  isPrivate,
  ownerLabel,
}: {
  /** `null` in create mode: no uuid yet, so no hue yet. */
  uuid: string | null;
  name: string;
  type: SpaceType;
  isPrivate: boolean;
  ownerLabel: string;
}) {
  const trimmed = name.trim();
  return (
    <div
      aria-hidden
      className="flex flex-col items-center gap-3 rounded-xl border border-border bg-secondary/30 p-4 text-center"
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Preview
      </span>

      <SpaceCrest uuid={uuid} name={trimmed || '?'} type={type} size="xl" />

      <span
        className={
          trimmed
            ? 'min-w-0 max-w-full truncate text-[15px] font-semibold text-foreground'
            : 'text-[15px] font-semibold text-muted-foreground/60'
        }
      >
        {trimmed || 'Your space'}
      </span>

      <span className="flex flex-wrap items-center justify-center gap-1">
        <PreviewChip>{type === 'study' ? 'Study' : 'Work'}</PreviewChip>
        <PreviewChip>{isPrivate ? 'Private' : 'Open'}</PreviewChip>
        <PreviewChip>{ownerLabel}</PreviewChip>
      </span>
    </div>
  );
}

function PreviewChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="max-w-full truncate rounded-md bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
      {children}
    </span>
  );
}
