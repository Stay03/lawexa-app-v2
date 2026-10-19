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
 * THE RESET TIME, IN ONE FORMAT. Date and time in the reader's own zone
 * ("15 Mar 2026, 01:00"); without a time, the server's own reset sentence;
 * without either, no line at all, never "Invalid Date".
 *
 * Pure, no JSX, so the tests pin it.
 */

export interface NoticeAction {
  label: string;
  href: string;
  /** The first, filled button; the rest are outlined. */
  primary: boolean;
}

export interface OutOfMessagesView {
  heading: string;
  /** The server's own sentence, which already names the plan and the date. */
  body: string;
  /** When the messages come back, or null when nobody knows. */
  reset: string | null;
  actions: NoticeAction[];
}

const UPGRADE = { label: 'Upgrade plan', href: '/pricing' };
const REACTIVATE = { label: 'Reactivate plan', href: '/pricing' };
const BUY_PACK = { label: 'Buy message pack', href: '/settings/message-packs' };

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
  const heading =
    reason === 'hard_limit'
      ? 'You’ve hit your usage limit'
      : reason === 'cancelled_grace_exhausted'
        ? 'Your plan access has ended'
        : 'You’ve used your messages for now';
  const body = blocked?.message?.trim() || fallbackMessage?.trim() || '';
  const moment = formatResetMoment(blocked?.resets_at ?? resetsAt ?? null, timeZone);
  const reset = moment ? `Your messages come back on ${moment}.` : resetMessage?.trim() || null;
  const doors =
    reason === 'hard_limit'
      ? []
      : reason === 'cancelled_grace_exhausted'
        ? [REACTIVATE, BUY_PACK]
        : [UPGRADE, BUY_PACK];
  return {
    heading,
    body,
    reset,
    actions: doors.map((door, index) => ({ ...door, primary: index === 0 })),
  };
}
