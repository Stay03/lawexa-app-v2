'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  Briefcase,
  ChevronRight,
  Globe,
  GraduationCap,
  Loader2,
  Lock,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import type { Space, SpaceKind, SpaceType } from '@/types/collab';
import { ChoiceCards, type Choice } from '@/v2/features/collab/kit/ChoiceCards';
import { readHistoryStamp } from '@/v2/runtime/url-params';
import { OVERLAY_STAMP_KEY, useUrlOverlay } from '@/v2/runtime/use-url-overlay';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import {
  SPACE_DESCRIPTION_MAX,
  SPACE_NAME_MAX,
  canSpaceBeOpen,
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
 * STEP TWO HAS ITS OWN URL (Stay: "hope each part has its own url so back
 * works?"): `?step=work` or `?step=study`, pushed on top of the host's own
 * entry for the dialog (`?panel=new` on the spaces list). So Back from step two
 * returns to the cards, and Back again closes the dialog. Not `?type=`: that is
 * the spaces list's filter. Closing from step two (Cancel, the X, Esc) and a
 * create that succeeds there both leave over the two entries at once
 * (`history.go(-2)`), so the stack is left as the dialog found it and Back from
 * the new space goes to the list, never into a half-filled form.
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
 * A space comes in two kinds, and a new one is always shared (below). The kind
 * is fixed once made, so the edit form does not offer it. A SHARED SPACE IS
 * ALWAYS PRIVATE: the backend refuses `is_private: false` on one (422), so
 * "Who can join" shows only on the edit form of an older team space.
 *
 * ── ONLY THE TWO STEPS, NOTHING ELSE (Stay, 15 October 2026, second pass) ──
 * "Remove the kind and the private/org. We are not handling org now." Create
 * asks the type, then the name and the goal, and nothing more: every space is
 * made as a shared space (`kind: 'shared'`, sent without asking; with no kind
 * the server makes the old team space, which a plain account may not), owned
 * by the person making it, and private (the server keeps a shared space
 * private whatever it is sent). Public waits for Stay's answer on what it
 * means. The bar's chevron goes back a step on step two (`onBack`), and each
 * step says which it is ("Step 1 of 2").
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
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Presence switches the dialog into edit mode. */
  space?: Space;
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

  const [name, setName] = useState(space?.name ?? '');
  // Create's step two, in the URL (see the docblock); refused in edit, so a
  // stray `?step=` on a space page is stripped and does nothing.
  const stepParam = useUrlOverlay(STEP_PARAM, { canOpen: !isEdit });
  const urlType = isEdit ? null : parseStepType(stepParam.value);
  const [editType, setEditType] = useState<SpaceType>(space?.type ?? 'work');
  // No type until the reader picks one: picking it is create's first step.
  const type: SpaceType | null = isEdit ? editType : urlType;
  // The card picked last, lit when Change or Back returns to the cards.
  const [lastType, setLastType] = useState<SpaceType | null>(null);
  // How the step showing was reached, so it slides in from that side.
  // `opened` plays nothing, since the dialog itself is animating in. Adjusted
  // during render when the step changes, React's way to follow an input.
  const [seenType, setSeenType] = useState<SpaceType | null>(urlType);
  const [entered, setEntered] = useState<'opened' | 'forward' | 'back'>('opened');
  if (urlType !== seenType) {
    setSeenType(urlType);
    setEntered(urlType === null ? 'back' : 'forward');
  }
  const nameRef = useRef<HTMLInputElement>(null);
  /** Set while this dialog is walking back over its own two entries, so a
   *  second Cancel in the same moment cannot walk back two more. */
  const leavingRef = useRef(false);
  /** A create that succeeded on step two: the host is told once the two
   *  entries are gone, so its navigation lands after them. */
  const afterLeaveRef = useRef<(() => void) | null>(null);
  /** Whether the entry under step two is the host's overlay entry, read when
   *  step two is pushed. */
  const stepAboveOverlayRef = useRef(false);
  const [description, setDescription] = useState(space?.description ?? '');
  const [privacy, setPrivacy] = useState<Privacy>(
    (space?.is_private ?? true) ? 'private' : 'open',
  );
  const [error, setError] = useState<string | null>(null);

  // The kind this form is about: the space's own in edit; a new space is
  // always a shared one (see the docblock).
  const kind: SpaceKind = space ? spaceKind(space) : 'shared';
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
  const showsTypeStep = !isEdit && urlType === null;

  // Picking a type is the step forward: its own history entry.
  const chooseType = (next: SpaceType) => {
    setLastType(next);
    setError(null);
    stepAboveOverlayRef.current = readHistoryStamp(OVERLAY_STAMP_KEY) !== null;
    stepParam.show(next);
  };
  // Change is Back: it walks off step two's entry.
  const changeType = () => stepParam.close();

  // Step two leaves over BOTH of the dialog's entries at once when the one
  // under it is an overlay's own (stamped); a dialog opened from a shared link
  // has no such entry under it, so step two is blanked in place instead.
  const leaveFromStepTwo = (after: () => void) => {
    if (leavingRef.current) return;
    if (readHistoryStamp(OVERLAY_STAMP_KEY) === STEP_PARAM && stepAboveOverlayRef.current) {
      leavingRef.current = true;
      afterLeaveRef.current = after;
      window.history.go(-2);
      return;
    }
    stepParam.closeInPlace();
    after();
  };

  const handleOpenChange = (next: boolean) => {
    if (next || urlType === null) {
      onOpenChange(next);
      return;
    }
    // The host's own close already happened with the walk back: its param is
    // gone from the restored entry.
    leaveFromStepTwo(() => {});
  };

  // The focus follows the step: the name when step two draws, the card picked
  // last when Change or Back returns to the cards. And a walk back that this
  // dialog started is complete once step two's param is gone.
  useEffect(() => {
    if (isEdit) return;
    if (urlType !== null) {
      nameRef.current?.focus();
      return;
    }
    leavingRef.current = false;
    const after = afterLeaveRef.current;
    afterLeaveRef.current = null;
    if (after) {
      after();
      return;
    }
    if (entered === 'back' && lastType) document.getElementById(`${uid}-type-${lastType}`)?.focus();
  }, [entered, isEdit, lastType, uid, urlType]);

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
        kind: 'shared',
        description: trimmedDescription || undefined,
        is_private: isPrivate,
      },
      {
        onSuccess: (response) => {
          const created = response.data;
          const finish = () => {
            if (onCreated) {
              onCreated(created.uuid, created.default_channel?.uuid ?? null);
            } else onOpenChange(false);
          };
          if (urlType === null) finish();
          // From step two the host moves only once the dialog's entries are
          // gone, so Back from the new space goes to the list.
          else leaveFromStepTwo(finish);
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
      onOpenChange={handleOpenChange}
      // Step two's chevron goes back to the cards; on step one it closes.
      onBack={!isEdit && urlType !== null ? changeType : undefined}
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
            onClick={() => handleOpenChange(false)}
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
            value={editType}
            onChange={setEditType}
          />
          {privacyField}
        </div>
      ) : showsTypeStep ? (
        <div key="type" className={cn('space-y-5', stepMotion(entered))}>
          <StepHeading
            step="Step 1 of 2"
            title="What are you working on?"
            line="Keep conversations and resources together, and invite others to collaborate."
          />
          <div role="group" aria-label="Type" className="grid gap-3 sm:grid-cols-2">
            {TYPE_CHOICES.map((choice) => (
              <TypeCard
                key={choice.value}
                id={`${uid}-type-${choice.value}`}
                choice={choice}
                chosen={choice.value === lastType}
                onChoose={() => chooseType(choice.value)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div key="details" className={cn('space-y-5', stepMotion(entered))}>
          {chosen ? (
            <StepHeading
              step={`Step 2 of 2 · ${chosen.title}`}
              title="Name your space"
              line={chosen.description}
              icon={chosen.icon}
            />
          ) : null}
          <div className="space-y-4">
            {nameField}
            {goalField}
          </div>
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

/** Create's step-two param (see the docblock). */
const STEP_PARAM = 'step';

/** `?step=` read as a type; anything else is step one. */
function parseStepType(value: string | null): SpaceType | null {
  return value === 'work' || value === 'study' ? value : null;
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

/** A create step's heading: which step it is, what it asks, and one line
 *  under it. Step two carries the type picked, with its glyph. */
function StepHeading({
  step,
  title,
  line,
  icon: Icon,
}: {
  step: string;
  title: string;
  line: string;
  icon?: Choice<SpaceType>['icon'];
}) {
  return (
    <div className="flex items-start gap-3">
      {Icon ? (
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon aria-hidden className="size-5" />
        </span>
      ) : null}
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{step}</p>
        <h3 className="text-lg font-semibold tracking-tight text-balance text-foreground">{title}</h3>
        <p className="text-pretty text-sm text-muted-foreground">{line}</p>
      </div>
    </div>
  );
}
