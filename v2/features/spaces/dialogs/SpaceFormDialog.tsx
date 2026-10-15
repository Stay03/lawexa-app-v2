'use client';

import { useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  Building2,
  ChevronRight,
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
import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import type { Space, SpaceKind, SpaceType } from '@/types/collab';
import { ChoiceCards, type Choice } from '@/v2/features/collab/kit/ChoiceCards';
import { canOpenTeamChannels } from '@/v2/features/collab/model';
import { organizationsQueries } from '@/v2/features/organizations/queries';
import { useV2Session } from '@/v2/runtime/session-context';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
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
 * ── CREATE IS TWO STEPS (Stay, 15 October 2026) ────────────────────────────
 * "Remove the preview, first show only the option of work/study then when they
 * select on that show the other two options." Step one is "What are you
 * working on?" over the Work and Study cards (Arthur's sentences), and nothing
 * else; picking one is the step forward, so the cards are buttons, not radios
 * (an arrow key moving through a radio group would advance the form). Step two
 * names the type chosen, with Change to go back, then Space name (focused),
 * "What are you trying to achieve? (Optional)", the forks a researcher or an
 * organisation member has, and Create Space. Each step slides in from the side
 * it comes from; with reduced motion it only appears. The edit form keeps one
 * page: the type is already chosen there. The crest preview is gone.
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
 * The title, "What are you working on?" and its line, "Space name", "What are
 * you trying to achieve? (Optional)" (the space's `description`), the two type
 * sentences and "Create Space" are his. The edit form uses the same labels and
 * type sentences, so a space reads the same both ways.
 *
 * THE EXAMPLES FOLLOW THE TYPE (Stay, 15 October 2026: "for work an example
 * should be the name of a client or something"): the two fields' placeholders
 * are a client matter for Work and a course for Study (`TYPE_EXAMPLES`). The
 * names are made up.
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

/** The examples in the name and goal fields, by the type picked. */
const TYPE_EXAMPLES: Readonly<Record<SpaceType, { name: string; goal: string }>> = {
  work: {
    name: 'e.g. Okafor & Sons',
    goal: 'e.g. Review the lease and draft a reply to the landlord’s notice',
  },
  study: {
    name: 'e.g. Constitutional Law, Bar Finals prep',
    goal: 'e.g. Revise for the Bar Finals and practise past questions',
  },
};

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
  // No type until the reader picks one: picking it is create's first step.
  const [type, setType] = useState<SpaceType | null>(space?.type ?? null);
  // Create only: which step shows, and how it was reached (`opened` plays no
  // slide, since the dialog itself is animating in).
  const [step, setStep] = useState<{ at: 'type' | 'details'; entered: 'opened' | 'forward' | 'back' }>(
    { at: 'type', entered: 'opened' },
  );
  const nameRef = useRef<HTMLInputElement>(null);
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

  const canSubmit = type !== null && name.trim().length > 0 && changed && !submitting;
  const showsTypeStep = !isEdit && step.at === 'type';

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

  // Picking a type is the step forward; the name is asked for next, so it
  // takes the focus once its step has drawn.
  const chooseType = (next: SpaceType) => {
    setType(next);
    setError(null);
    setStep({ at: 'details', entered: 'forward' });
    requestAnimationFrame(() => nameRef.current?.focus());
  };
  // Back to the cards, with the focus on the one chosen, so Change and a
  // second pick are two key presses.
  const changeType = () => {
    setStep({ at: 'type', entered: 'back' });
    requestAnimationFrame(() => document.getElementById(`${uid}-type-${type}`)?.focus());
  };

  const handleSubmit = () => {
    if (!canSubmit || type === null) return;
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

  // Only drawn once a type is picked (step two, or the edit form).
  const examples = TYPE_EXAMPLES[type ?? 'work'];

  const nameField = (
    <div className="space-y-2">
      <Label htmlFor={`${uid}-name`}>Space name</Label>
      <Input
        ref={nameRef}
        id={`${uid}-name`}
        maxLength={SPACE_NAME_MAX}
        placeholder={examples.name}
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
  );

  const goalField = (
    <div className="space-y-2">
      <Label htmlFor={`${uid}-description`}>
        What are you trying to achieve?
        <span className="font-normal text-muted-foreground">(Optional)</span>
      </Label>
      <Textarea
        id={`${uid}-description`}
        maxLength={SPACE_DESCRIPTION_MAX}
        rows={3}
        placeholder={examples.goal}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
    </div>
  );

  const privacyField = canBeOpen ? (
    <ChoiceCards
      legend="Who can join"
      choices={PRIVACY_CHOICES}
      value={privacy}
      onChange={setPrivacy}
    />
  ) : null;

  const chosen = TYPE_CHOICES.find((choice) => choice.value === type) ?? null;

  return (
    /* ── TALLER THAN A PHONE, SO ON A PHONE IT IS THE WHOLE PHONE ──────────
       `ResponsiveOverlay` keeps three bands: a header that stays, a body that
       scrolls, a footer that stays. On a phone it gives them the whole screen
       (the bug Arthur photographed on 2026-08-07 was a centred box taller than
       the viewport, with Save and the close X both off-screen). Above `md:` it
       is a centred card. Each create step is short enough to fit a phone. */
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Rename space' : 'Create a Space'}
      // The create form's heading and its line open the first step (below).
      description={
        isEdit ? 'Change its name and details. Everyone in it sees the change.' : undefined
      }
      className="md:max-w-xl"
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          {showsTypeStep ? null : (
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {submitting && <Loader2 aria-hidden className="size-4 animate-spin" />}
              {isEdit ? 'Save changes' : 'Create Space'}
            </Button>
          )}
        </>
      }
    >
      {isEdit ? (
        <div className="space-y-4">
          {nameField}
          {goalField}
          <ChoiceCards
            legend="Type"
            choices={TYPE_CHOICES}
            value={type ?? 'work'}
            onChange={setType}
          />
          {privacyField}
        </div>
      ) : showsTypeStep ? (
        <div key="type" className={stepMotion(step.entered)}>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              What are you working on?
            </h3>
            <p className="text-pretty text-sm text-muted-foreground">
              Keep conversations and resources together, and invite others to collaborate.
            </p>
          </div>
          <div role="group" aria-label="Type" className="mt-5 grid gap-3 sm:grid-cols-2">
            {TYPE_CHOICES.map((choice) => (
              <TypeCard
                key={choice.value}
                id={`${uid}-type-${choice.value}`}
                choice={choice}
                chosen={choice.value === type}
                onChoose={() => chooseType(choice.value)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div key="details" className={cn('space-y-4', stepMotion(step.entered))}>
          {chosen ? <ChosenType choice={chosen} onChange={changeType} /> : null}
          {nameField}
          {goalField}

          {canChooseKind ? (
            <ChoiceCards
              legend="Kind"
              choices={KIND_CHOICES}
              value={chosenKind}
              onChange={setChosenKind}
            />
          ) : null}

          {organization ? (
            <ChoiceCards
              legend="Owner"
              choices={ownerChoices}
              value={owner}
              onChange={setOwner}
            />
          ) : null}

          {privacyField}
        </div>
      )}

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

/** How a create step comes in: from the side it was reached from, and with
 *  reduced motion not at all. The first step plays nothing on opening, since
 *  the dialog itself is animating in. */
function stepMotion(entered: 'opened' | 'forward' | 'back'): string {
  if (entered === 'opened') return '';
  return cn(
    'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 motion-safe:ease-out',
    entered === 'forward' ? 'motion-safe:slide-in-from-right-4' : 'motion-safe:slide-in-from-left-4',
  );
}

/** One of create's first-step cards: picking it moves to the next step, so it
 *  is a button. A column of two on a phone, two side by side above `sm:`. */
function TypeCard({
  id,
  choice,
  chosen,
  onChoose,
}: {
  id: string;
  choice: Choice<SpaceType>;
  /** The type picked before Change brought the reader back. */
  chosen: boolean;
  onChoose: () => void;
}) {
  const Icon = choice.icon;
  return (
    <button
      id={id}
      type="button"
      onClick={onChoose}
      className={cn(
        'group v2-interactive flex w-full items-start gap-3 rounded-xl border bg-background p-4 text-left sm:flex-col sm:p-5',
        'transition-colors duration-150 motion-reduce:transition-none',
        'hover:border-primary/50 hover:bg-primary/5',
        chosen ? 'border-primary/60 bg-primary/5' : 'border-border',
        FOCUS_RING,
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 motion-reduce:transition-none',
          'group-hover:bg-primary/10 group-hover:text-primary',
          chosen ? 'bg-primary/10 text-primary' : 'bg-secondary text-foreground',
        )}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block text-[15px] font-semibold text-foreground">{choice.title}</span>
        <span className="block text-pretty text-sm leading-relaxed text-muted-foreground">
          {choice.description}
        </span>
      </span>
      <ChevronRight
        aria-hidden
        className="mt-3 size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none sm:hidden"
      />
    </button>
  );
}

/** Step two's first line: the type picked, and the way back to change it. */
function ChosenType({
  choice,
  onChange,
}: {
  choice: Choice<SpaceType>;
  onChange: () => void;
}) {
  const Icon = choice.icon;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 py-2.5 pl-3 pr-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon aria-hidden className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">Type</span>
        <span className="block text-sm font-medium text-foreground">{choice.title}</span>
      </span>
      <Button type="button" variant="ghost" size="sm" className="v2-interactive" onClick={onChange}>
        Change<span className="sr-only"> type</span>
      </Button>
    </div>
  );
}
