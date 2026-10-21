import type { IBlockedReason, TBlockedReasonCode } from '@/types/message-pack';

/**
 * out-of-messages — what the ONE out-of-messages notice says and offers (v2
 * Stage 1, item 6; Stay approved 19 October 2026). The same notice shows in a
 * chat, on the home's composer, on Usage and on New radar, so a reader who
 * runs out meets one set of words and one set of doors everywhere.
 *
 * THE SERVER DECIDES WHY. A block arrives as `IBlockedReason` (the refused
 * send's error, or `/users/limits` → `ai_messages.blocked_reason`, or a radar's
 * `first_scan.block_reason`): this never works the count out itself. What it
 * offers follows the reason, as v1's `MessageBlockBanner` does:
 *
 *   free_no_subscription, plan_exhausted, account_flagged
 *                             → Upgrade plan, Buy message pack
 *   cancelled_grace_exhausted → Reactivate plan, Buy message pack (a lapsed
 *                               plan: reactivating is subscribing again)
 *   hard_limit                → nothing to buy: the reset time only
 *
 * A reason this build does not know reads as `plan_exhausted`. A flagged
 * account reads like plain exhaustion, never "flagged" (v1's rule).
 *
 * THE RESET TIME, ONCE, IN ONE FORMAT. Date and time in the reader's own zone
 * ("15 Mar 2026, 01:00"); without a time, the server's own reset sentence;
 * without either, no line at all, never "Invalid Date". A lapsed plan gets no
 * reset line at all: its messages come back only if it is reactivated, and a
 * plan that ends before the reset never reaches it (backend's run, 19 October
 * 2026: "Subscription ends on 13 November" over "come back on 14 Nov").
 *
 * OUR OWN SENTENCE FOR A REASON WE KNOW. The server's message names the reset
 * date too, so with our reset line the date read twice; for the five reasons
 * above the notice says its own sentence and the date shows once, in the
 * reset line. The server's words stay for a reason this build does not know,
 * and for a refusal that came with words only.
 *
 * Pure, no JSX, so the tests pin it.
 */

export interface NoticeAction {
  label: string;
  /** The strip's word for it (C4): "Upgrade", "Reactivate", "Buy pack". */
  shortLabel: string;
  href: string;
  /** The first, filled button; the rest are outlined. */
  primary: boolean;
}

export interface OutOfMessagesView {
  heading: string;
  /** The strip's one line (C4, Stay 19 October 2026 20:12Z): "Free messages used". */
  short: string;
  /** The strip's reset line: "Back on 15 Mar 2026, 01:00", or null as for `reset`. */
  resetShort: string | null;
  /** The server's own sentence, which already names the plan and the date. */
  body: string;
  /** When the messages come back, or null when nobody knows. */
  reset: string | null;
  actions: NoticeAction[];
}

const UPGRADE = { label: 'Upgrade plan', shortLabel: 'Upgrade', href: '/pricing' };
const REACTIVATE = { label: 'Reactivate plan', shortLabel: 'Reactivate', href: '/pricing' };
const BUY_PACK = { label: 'Buy message pack', shortLabel: 'Buy pack', href: '/settings/message-packs' };

const KNOWN: readonly TBlockedReasonCode[] = [
  'free_no_subscription',
  'plan_exhausted',
  'account_flagged',
  'hard_limit',
  'cancelled_grace_exhausted',
];

function reasonOf(blocked: Pick<IBlockedReason, 'reason'> | null): TBlockedReasonCode {
  const reason = blocked?.reason;
  return reason && KNOWN.includes(reason) ? reason : 'plan_exhausted';
}

/** The notice's own sentence for each reason it knows. */
const BODY: Record<TBlockedReasonCode, string> = {
  free_no_subscription:
    'Your free messages are used up. Choose a plan for a monthly allowance, or buy a message pack.',
  plan_exhausted: 'You have used every message your plan includes for now.',
  account_flagged: 'You have used every message your plan includes for now.',
  cancelled_grace_exhausted:
    'Your plan has ended, so it no longer includes messages. Reactivate it, or buy a message pack.',
  hard_limit: 'You have reached the most messages this account can send for now.',
};

/** The free reason's sentence once a message pack has been used up too. */
const FROM_PACK_BODY =
  'Your free messages and your message pack are used up. Buy another message pack, or choose a plan for a monthly allowance.';

/** "15 Mar 2026, 01:00" in the reader's zone, or null for a missing or broken time. */
export function formatResetMoment(iso: string | null | undefined, timeZone?: string): string | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return null;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(at);
}

export function outOfMessagesView({
  blocked,
  fallbackMessage,
  resetsAt,
  resetMessage,
  timeZone,
}: {
  /** The server's block, when the surface has it. */
  blocked: IBlockedReason | null;
  /** The words to show when there is no block object (a chat's error row). */
  fallbackMessage?: string | null;
  /** The limits' own reset time, used when the block carries none. */
  resetsAt?: string | null;
  /** The server's reset sentence (`ai_messages.reset_message`). */
  resetMessage?: string | null;
  /** For tests; the reader's own zone otherwise. */
  timeZone?: string;
}): OutOfMessagesView {
  const reason = reasonOf(blocked);
  // A user without a plan who bought (or was given) a message pack has used
  // more than free messages: the notice no longer calls them free (Tester, 20
  // October 2026, finding 21; backend's `last_message_from_pack`).
  const fromPack = reason === 'free_no_subscription' && blocked?.last_message_from_pack === true;
  // A free allowance is for life (no reset time), so its heading promises
  // nothing back; "for now" is for a plan that renews.
  const heading =
    reason === 'hard_limit'
      ? 'You’ve hit your usage limit'
      : reason === 'cancelled_grace_exhausted'
        ? 'Your plan access has ended'
        : fromPack
          ? 'You’ve used your messages'
          : reason === 'free_no_subscription'
            ? 'You’ve used your free messages'
            : 'You’ve used your messages for now';
  const short =
    reason === 'hard_limit'
      ? 'Usage limit reached'
      : reason === 'cancelled_grace_exhausted'
        ? 'Plan cancelled · messages used up'
        : fromPack
          ? 'Messages used up'
          : reason === 'free_no_subscription'
            ? 'Free messages used'
            : 'Messages used for now';
  const known = !!blocked?.reason && KNOWN.includes(blocked.reason);
  const body = fromPack
    ? FROM_PACK_BODY
    : known
      ? BODY[reason]
      : blocked?.message?.trim() || fallbackMessage?.trim() || '';
  // Nothing comes back to a lapsed plan, nor to one that ends before the reset.
  const resetIso = blocked?.resets_at ?? resetsAt ?? null;
  const endsFirst =
    !!blocked?.subscription_ends_at &&
    !!resetIso &&
    Date.parse(blocked.subscription_ends_at) < Date.parse(resetIso);
  const comesBack = reason !== 'cancelled_grace_exhausted' && !endsFirst;
  const moment = comesBack ? formatResetMoment(resetIso, timeZone) : null;
  const serverReset = comesBack ? resetMessage?.trim() || null : null;
  const reset = moment ? `Your messages come back on ${moment}.` : serverReset;
  const resetShort = moment ? `Back on ${moment}` : serverReset;
  const doors =
    reason === 'hard_limit'
      ? []
      : reason === 'cancelled_grace_exhausted'
        ? [REACTIVATE, BUY_PACK]
        : [UPGRADE, BUY_PACK];
  return {
    heading,
    short,
    resetShort,
    body,
    reset,
    actions: doors.map((door, index) => ({ ...door, primary: index === 0 })),
  };
}
