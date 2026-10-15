'use client';

import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  Building2,
  FolderOpen,
  Globe,
  GraduationCap,
  Loader2,
  Lock,
  MessagesSquare,
  User,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { extractApiError } from '@/lib/utils/api-error';
import type { Space, SpaceKind, SpaceType } from '@/types/collab';
import { ChoiceCards, type Choice } from '@/v2/features/collab/kit/ChoiceCards';
import { SpaceCrest } from '@/v2/features/collab/kit/Crest';
import { canOpenTeamChannels } from '@/v2/features/collab/model';
import { organizationsQueries } from '@/v2/features/organizations/queries';
import { useV2Session } from '@/v2/runtime/session-context';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import {
  SPACE_DESCRIPTION_MAX,
  SPACE_NAME_MAX,
  canSpaceBeOpen,
  createSpaceKind,
  spaceKind,
} from '../model';
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
 *
 * ── SHARED OR TEAM (Spaces F2, 11 October 2026) ────────────────────────────
 * One Space now comes in two kinds. Below researcher there is nothing to
 * choose: the dialog sends NO kind and the server makes a shared space (it
 * refuses `team` there), which has no starter channel, so the creator lands
 * on the space page. A researcher or above chooses Shared space or Team space
 * and the choice is sent (`createSpaceKind`). The kind is fixed once made, so
 * the edit form does not offer it.
 *
 * A SHARED SPACE IS ALWAYS PRIVATE: the backend refuses `is_private: false` on
 * one (422). So "Who can join" is not offered for a shared space, in either
 * mode, and the form sends `is_private: true` for it.
 *
 * ── ARTHUR'S WORDS (15 October 2026) ───────────────────────────────────────
 * The create form opens on "What are you working on?" and asks three things in
 * this order: the space's name, what the reader is trying to achieve (the
 * space's `description`, optional), and Work or Study. The labels and the type
 * cards are the same in the edit form, so a space reads the same both ways.
 * The kind, the owner and who can join follow, as before.
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
    description: 'For legal research, drafting, a client matter, a department or a specific task.',
  },
  {
    value: 'study',
    icon: GraduationCap,
    title: 'Study',
    description: 'For coursework, final-year projects, Bar Finals, moots or exam preparation.',
  },
];

const KIND_CHOICES: readonly Choice<SpaceKind>[] = [
  {
    value: 'shared',
    icon: FolderOpen,
    title: 'Shared space',
    description: 'Conversations, folders and files you share with the people you invite. Always private.',
  },
  {
    value: 'team',
    icon: MessagesSquare,
    title: 'Team space',
    description: 'Adds Team Channels for discussion. Only researchers and above see channels.',
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
  const session = useV2Session();
  // Only a create, and only for an account that may open Team Channels.
  const canChooseKind = !isEdit && canOpenTeamChannels(session);

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
  // A researcher's create starts on Team, the kind the server would make for
  // them unasked, so nothing changes for anyone who does not touch it.
  const [chosenKind, setChosenKind] = useState<SpaceKind>('team');
  const [error, setError] = useState<string | null>(null);

  // The kind this form is about: the space's own in edit; the choice when
  // there is one; otherwise shared, which is what the server makes.
  const kind: SpaceKind = space
    ? spaceKind(space)
    : canChooseKind
      ? chosenKind
      : 'shared';
  const canBeOpen = canSpaceBeOpen(kind);
  const isPrivate = !canBeOpen || privacy === 'private';
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

  // The organisation the space will belong to, or nothing: "Personal" beside
  // "Shared" read as a second kind of space (design round 1).
  const ownerLabel =
    owner === 'personal' ? null : (organization?.name ?? 'Organization');

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
        kind: createSpaceKind(chosenKind, canChooseKind),
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
    /* ── TALLER THAN A PHONE, SO ON A PHONE IT IS THE WHOLE PHONE ──────────
       This form is the reason `ResponsiveOverlay` exists. Measured on a 360px
       phone it came to ~1,115px — the two `ChoiceCards` groups stack below
       `sm:` and cost ~217px each — inside a 640px screen. As a centred box
       taller than the viewport it hung off BOTH ends by equal amounts, so
       Save, Cancel and the close X were off-screen at once with no scroll able
       to reach them (the page is locked and the dialog is portalled outside the
       app's only scroll region). That is the bug Arthur photographed on
       2026-08-07.

       Capping the box made Save reachable. Reachable by scrolling is not the
       same as reachable, and a box is the wrong shape for a form this long at
       any height. The overlay keeps the three bands — a header that stays, a
       body that scrolls, a footer that stays — and on a phone gives them the
       whole screen. Above `md:` it is the same centred card it always was. */
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Rename space' : 'Create a Space'}
      // The create form's heading and its line open the body (below).
      description={
        isEdit ? 'Change its name and details. Everyone in it sees the change.' : undefined
      }
      className="md:max-w-2xl"
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create Space'}
          </Button>
        </>
      }
    >
      {isEdit ? null : (
        <div className="mb-5 space-y-1">
          <h3 className="text-lg font-semibold tracking-tight text-foreground">
            What are you working on?
          </h3>
          <p className="text-pretty text-sm text-muted-foreground">
            Keep conversations and resources together, and invite others to collaborate.
          </p>
        </div>
      )}

      {/* The preview leads on a phone (you see the object before you describe
          it) and sits beside the fields from `sm` up. */}
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_13rem]">
        <div className="order-2 min-w-0 space-y-4 sm:order-1">
          <div className="space-y-2">
            <Label htmlFor={`${uid}-name`}>Space name</Label>
            <Input
              id={`${uid}-name`}
              maxLength={SPACE_NAME_MAX}
              placeholder="e.g. Contract Review, Constitutional Law"
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

          <div className="space-y-2">
            <Label htmlFor={`${uid}-description`}>
              What are you trying to achieve?
              <span className="font-normal text-muted-foreground">(Optional)</span>
            </Label>
            <Textarea
              id={`${uid}-description`}
              maxLength={SPACE_DESCRIPTION_MAX}
              rows={3}
              placeholder="Describe your goal or what you want to accomplish..."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <ChoiceCards
            legend="Type"
            choices={TYPE_CHOICES}
            value={type}
            onChange={setType}
          />

          {canChooseKind ? (
            <ChoiceCards
              legend="Kind"
              choices={KIND_CHOICES}
              value={chosenKind}
              onChange={setChosenKind}
            />
          ) : null}

          {!isEdit && organization ? (
            <ChoiceCards
              legend="Owner"
              choices={ownerChoices}
              value={owner}
              onChange={setOwner}
            />
          ) : null}

          {canBeOpen ? (
            <ChoiceCards
              legend="Who can join"
              choices={PRIVACY_CHOICES}
              value={privacy}
              onChange={setPrivacy}
            />
          ) : null}
        </div>

        <div className="order-1 sm:order-2">
          <SpacePreview
            uuid={space?.uuid ?? null}
            name={name}
            type={type}
            kind={kind}
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
    </ResponsiveOverlay>
  );
}

/** The object as it is being made: its crest, its name, and the three facts the
 *  forks above decide. `aria-hidden` — every value in here is already the
 *  announced state of the control that set it. */
function SpacePreview({
  uuid,
  name,
  type,
  kind,
  isPrivate,
  ownerLabel,
}: {
  /** `null` in create mode: no uuid yet, so no hue yet. */
  uuid: string | null;
  name: string;
  type: SpaceType;
  kind: SpaceKind;
  isPrivate: boolean;
  /** The organisation, or `null` for a space that belongs to none. */
  ownerLabel: string | null;
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
        <PreviewChip>{kind === 'team' ? 'Team' : 'Shared'}</PreviewChip>
        <PreviewChip>{type === 'study' ? 'Study' : 'Work'}</PreviewChip>
        {/* A shared space is always private, so the chip only says
            something on a team space (`showsPrivateMark`'s rule). */}
        {kind === 'team' ? <PreviewChip>{isPrivate ? 'Private' : 'Open'}</PreviewChip> : null}
        {ownerLabel ? <PreviewChip>{ownerLabel}</PreviewChip> : null}
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
