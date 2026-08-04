import { toast } from 'sonner';
import type { NotifyLevel } from '@/types/collab';
import { isPushArmed } from '@/v2/runtime/push/state';
import { getActiveChannelUuid } from './active-channel';
import { readNotifyPreferences, type NotifyPreferences } from './preferences';
import type { ChannelUnreadEvent } from './protocol';
import { playMentionChime } from './sound';

/**
 * THE ONE DISPATCHER — every `.channel.unread` event's toast/sound decision
 * runs through {@link decideInterruption}, and nothing else in v2 may raise a
 * collab toast or sound. Contract: the interruption ladder
 * (design-research.md DIRECTION 6, binding) + foundation-standards §5
 * "Delivery decision" + digest §D (2026-08-04).
 *
 * SEPARATION OF POWERS, LOAD-BEARING: BADGES ARE NOT DECIDED HERE. The cache
 * writers always assign the absolute counts (badge accuracy is the backend's
 * stated contract — even muted members' badges stay true), and title/favicon/
 * app-badge DERIVE from those caches. The dispatcher gates only the two
 * interrupting surfaces: toast and sound. That is what makes "muted = badge
 * only" exact rather than approximate.
 *
 * THE LADDER, AS IMPLEMENTED (top rule wins):
 *  1. Plain arrival (`is_mention: false` — includes own-pointer echoes and
 *     delete recounts) → nothing. Toast-for-arrivals is banned outright.
 *  2. Paused → nothing.
 *  3. The event's channel is OPEN and the document VISIBLE → nothing (inline
 *     rendering is the notification).
 *  4. `my_notify_level === 'muted'` → nothing (Ruling A: badge only, even for
 *     a direct @you).
 *  5. Otherwise (a mention, elsewhere, not muted — `all` and `mentions_only`
 *     converge here because plain arrivals already exited at rule 1) → toast
 *     if toasts are on, chime if sound is on (D8: sound defaults OFF) AND no
 *     closed-app push is about to make the same noise (see below).
 *
 * UNKNOWN MUTE STATE (`notifyLevel: null` after the spine's cache-then-fetch
 * resolution failed): DELIVER. A missed personal mention is the worst failure
 * a comms tool has; an extra toast on a transient network error is a shrug.
 * The trade is deliberate and this line is where to reverse it.
 *
 * ── PUSH DEDUP: THE SOUND ONLY, NEVER THE TOAST (W5, audit H1/M1) ──────────
 * The two delivery paths divide the world by DOCUMENT VISIBILITY:
 *
 *  - FCM's own service-worker logic shows an OS notification only when NO
 *    window client is visible. A visible tab instead receives the payload
 *    in-page — where v2 registers no `onMessage` handler at all, so it is
 *    discarded (digest §F.16: "ignore FCM foreground messages entirely").
 *    Nothing in the shared service worker had to change for that, which is
 *    what keeps v1 byte-identical.
 *  - Hidden + armed, this end suppresses the CHIME. Two sounds for one
 *    mention — the OS notification's and ours, seconds apart, into a room
 *    nobody is looking at — is the only genuine double-notification. The
 *    toast is not: while the document is hidden nobody is reading toasts, so
 *    it is not a second interruption, it is a QUEUE ENTRY. It therefore
 *    always fires, and (below) it is made persistent so it is still there
 *    when the reader comes back.
 *
 * WHY THE TOAST MAY NOT BE SUPPRESSED, EVEN THOUGH IT LOOKS LIKE A DUPLICATE:
 * `isPushArmed()` reads a localStorage MIRROR of the registration, and a
 * mirror can lie — a rotated FCM token, a service worker unregistered by the
 * browser, evicted storage. When it lies with the document hidden, suppressing
 * the toast would destroy the mention on BOTH surfaces: no OS notification
 * (the registration is dead) and no toast (we believed it wasn't). That is the
 * one failure this whole spine exists to prevent, and it is exactly the
 * deliver-under-uncertainty rule `push/state.ts` and the unknown-mute case
 * already follow. A stale chime suppression, by contrast, costs a sound.
 */

export interface InterruptionInput {
  isMention: boolean;
  /** The caller's notify level for the event's channel; `null` = unknowable. */
  notifyLevel: NotifyLevel | null;
  /** Event channel is the registered open channel AND the document is visible. */
  isVisibleConversation: boolean;
  /**
   * The document is HIDDEN and this device holds an armed push registration,
   * so the same event also arrives as an OS notification. Silences the CHIME
   * only — see the module docblock for why it must never silence the toast.
   */
  pushWillCover: boolean;
  prefs: NotifyPreferences;
}

export interface InterruptionDecision {
  toast: boolean;
  sound: boolean;
}

const SILENCE: InterruptionDecision = { toast: false, sound: false };

/** The pure ladder — exported so the decision table is testable in isolation. */
export function decideInterruption(input: InterruptionInput): InterruptionDecision {
  if (!input.isMention) return SILENCE;
  if (input.prefs.paused) return SILENCE;
  if (input.isVisibleConversation) return SILENCE;
  if (input.notifyLevel === 'muted') return SILENCE;
  return {
    toast: input.prefs.toast,
    sound: input.prefs.sound && !input.pushWillCover,
  };
}

/** What the spine resolved about the event's channel before dispatching. */
export interface ResolvedChannelContext {
  notifyLevel: NotifyLevel | null;
  channelName: string | null;
}

/**
 * Execute the decision for one `.channel.unread`. Reads the volatile context
 * (open channel, document visibility, preferences) at EVENT time — never
 * captured earlier, so a decision can't act on a stale screen state.
 *
 * The toast is keyed per channel (`id`), so a burst of mentions in one channel
 * updates a single toast instead of stacking — the toast-storm ban. Its action
 * navigates to the channel at `?m=` — the SAME public URL a push notification
 * opens, so the two paths converge on one address and one landing behaviour
 * (W5 put `/channels/*` in the manifest, which is what made that address the
 * v2 screen for an opted-in reader; W1 note N5 is closed).
 *
 * A TOAST RAISED WHILE THE DOCUMENT IS HIDDEN IS PERSISTENT. Sonner's default
 * is ~4 seconds, which for an unattended tab means the mention expires before
 * anyone can see it — the toast would be neither an interruption nor a queue,
 * just a no-op. `duration: Infinity` makes it wait, and `closeButton` gives it
 * the dismissal a persistent toast must have. A visible document keeps the
 * normal timed behaviour: the reader is right there.
 */
export function dispatchChannelUnread(
  event: ChannelUnreadEvent,
  resolved: ResolvedChannelContext,
  navigate: (href: string) => void,
): void {
  const documentVisible =
    typeof document !== 'undefined' && document.visibilityState === 'visible';

  const decision = decideInterruption({
    isMention: event.is_mention,
    notifyLevel: resolved.notifyLevel,
    isVisibleConversation:
      getActiveChannelUuid() === event.channel_uuid && documentVisible,
    pushWillCover: !documentVisible && isPushArmed(),
    prefs: readNotifyPreferences(),
  });

  if (decision.toast) {
    toast('You were mentioned', {
      id: `collab-mention-${event.channel_uuid}`,
      description: resolved.channelName
        ? `In ${resolved.channelName}`
        : 'In one of your channels',
      // Hidden document ⇒ wait on screen instead of expiring unseen.
      duration: documentVisible ? undefined : Infinity,
      closeButton: !documentVisible,
      action: {
        label: 'Open',
        onClick: () =>
          navigate(`/channels/${event.channel_uuid}?m=${event.message_uuid}`),
      },
    });
  }
  if (decision.sound) {
    playMentionChime(event.channel_uuid);
  }
}
