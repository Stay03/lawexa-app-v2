import { toast } from 'sonner';
import type { NotifyLevel } from '@/types/collab';
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
 *     if toasts are on, chime if sound is on (D8: sound defaults OFF).
 *
 * UNKNOWN MUTE STATE (`notifyLevel: null` after the spine's cache-then-fetch
 * resolution failed): DELIVER. A missed personal mention is the worst failure
 * a comms tool has; an extra toast on a transient network error is a shrug.
 * The trade is deliberate and this line is where to reverse it.
 *
 * W5 SEAM: push dedup (suppress toast/sound when the document is hidden AND a
 * push subscription will deliver the same event) lands with the push wave —
 * until then a hidden tab still toasts/chimes, which is the correct interim
 * behaviour for a backgrounded workspace.
 */

export interface InterruptionInput {
  isMention: boolean;
  /** The caller's notify level for the event's channel; `null` = unknowable. */
  notifyLevel: NotifyLevel | null;
  /** Event channel is the registered open channel AND the document is visible. */
  isVisibleConversation: boolean;
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
  return { toast: input.prefs.toast, sound: input.prefs.sound };
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
 * navigates to the channel at `?m=` (the public URL: v1's screen today, the
 * W2 screen after cutover — same address either way).
 */
export function dispatchChannelUnread(
  event: ChannelUnreadEvent,
  resolved: ResolvedChannelContext,
  navigate: (href: string) => void,
): void {
  const decision = decideInterruption({
    isMention: event.is_mention,
    notifyLevel: resolved.notifyLevel,
    isVisibleConversation:
      getActiveChannelUuid() === event.channel_uuid &&
      typeof document !== 'undefined' &&
      document.visibilityState === 'visible',
    prefs: readNotifyPreferences(),
  });

  if (decision.toast) {
    toast('You were mentioned', {
      id: `collab-mention-${event.channel_uuid}`,
      description: resolved.channelName
        ? `In ${resolved.channelName}`
        : 'In one of your channels',
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
