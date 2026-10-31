import type { AdminLimitPeriod } from '@/types/admin-plans';

/**
 * The periods a counted limit is saved with: the only two the server takes
 * (`UpdatePlanLimitsRequest`: `in:lifetime,billing_interval`). The form used
 * to offer "Per Month" and "Per Day" as well, and either one failed the whole
 * save (techlead's go, thread 1c93152c, 31 October 2026).
 */
export const LIMIT_PERIOD_OPTIONS: readonly { value: AdminLimitPeriod; label: string }[] = [
  { value: 'billing_interval', label: 'Each billing period' },
  { value: 'lifetime', label: 'In total (never resets)' },
];

/**
 * A stored period as the form holds it. A row saved before the server
 * narrowed its periods may say "month" or "day"; it reads as each billing
 * period, the server's default and its one-month window, so a save never
 * sends a value the server refuses.
 */
export function formPeriod(stored: string | null | undefined): AdminLimitPeriod {
  return stored === 'lifetime' ? 'lifetime' : 'billing_interval';
}
