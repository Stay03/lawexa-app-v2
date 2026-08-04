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
 *     `is_mention` is read as "the server says this message is personally
 *     addressed to me" — see THE REPLY QUESTION below for why that reading,
 *     and not "an @mention specifically", is the one the ladder needs.
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
 * ── THE REPLY QUESTION, ANSWERED WITHOUT GUESSING (2026-08-04) ─────────────
 * The backend shipped reply notifications and called them "full mention
 * parity". Read precisely, the parity they claim is over the NOTIFICATION
 * surface — the row appears in the inbox list, it moves the bell count, its
 * `action_url` deep-links — and they say nothing whatever about
 * `.channel.unread`, which is the event this dispatcher reads. Two readings
 * are therefore live, and the wire cannot settle it today (events are down in
 * production):
 *
 *   A. A reply leaves `is_mention: false`. Digest §D says the flag is `true`
 *      "only for mentioned members", and `mention_count` is defined as unread
 *      messages that @mention me — a reply creates no mention row. This is the
 *      documented reading and the likelier one.
 *   B. A reply sets `is_mention: true`, taking "mention parity" literally.
 *
 * WHAT IS CORRECT UNDER BOTH: leave the ladder's SHAPE alone. Rule 1 already
 * keys on the server's own judgement of "this is personally yours", and that
 * predicate is the set {mention} under A and {mention, reply} under B — either
 * way it is exactly the set that deserves an interruption. Nothing structural
 * needs to change, and nothing here may synthesise a reply signal: the event
 * carries no reply field, and inferring one (e.g. from a `mention_count` that
 * did not move) would put a fabricated label on a real alert.
 *
 * THE COPY STAYS PRECISE. Hedging it ("mentioned or replied to") would degrade
 * every real alert under reading A — the documented and likelier one, where
 * every toast this ladder raises IS a mention — to insure a case we judge
 * improbable, and the toast would still give the reader nothing to resolve the
 * ambiguity with. So the title asserts what the contract says, and the open
 * question is where an open question belongs: asked of the people who know.
 * It is filed in `docs/v2-docs/backend-ask-2026-08-04-spaces-channels-round-2.md`
 * ("Follow-up ask", 2026-08-04) — does a reply set `is_mention`, and does it
 * move `mention_count`. {@link PERSONAL_ALERT_TITLE} is the single line to
 * change if the answer comes back B.
 *
 * WHAT DELIBERATELY DID NOT HAPPEN: no toast was added on the `.notification`
 * broadcast. It is the one payload that would name a reply outright, and
 * raising alerts from it would break the rule that one message never produces
 * two — a mention broadcasts BOTH events, so it would ring twice — and would
 * escape Ruling B, since `.channel.unread`'s `is_mention` is the only signal
 * with the `ai_mentions_notify` rule already applied server-side. Under
 * reading A the consequence is honest and stated: a reply moves the bell and
 * the inbox list (the spine invalidates on `.notification`) but raises no
 * toast, and while the app is closed push still delivers it.
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

/**
 * The toast's title. It states what the contract says `is_mention: true` means
 * — an @mention — rather than hedging over a reply reading the backend has not
 * confirmed (THE REPLY QUESTION in the module docblock; the ask is filed in
 * `docs/v2-docs/backend-ask-2026-08-04-spaces-channels-round-2.md`). If the
 * answer comes back "a reply sets the flag too", this one line becomes the
 * fix, and nothing else in the ladder moves.
 */
const PERSONAL_ALERT_TITLE = 'You were mentioned';

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
    toast(PERSONAL_ALERT_TITLE, {
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
