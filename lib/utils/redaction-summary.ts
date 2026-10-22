import type { RedactionSummary } from '@/types/chat';

/**
 * Whether a value from the server is a redaction summary (backend contract, 22
 * October 2026): a whole-number `details_hidden` and `places_replaced`, and a
 * `by_type` map of kind to whole-number count. Anything else is treated as
 * absent, so a malformed summary shows "Sent as redacted" with no count rather
 * than a wrong one.
 */
export function isRedactionSummary(value: unknown): value is RedactionSummary {
  if (typeof value !== 'object' || value === null) return false;
  const { details_hidden, places_replaced, by_type } = value as Record<string, unknown>;
  if (!isCount(details_hidden) || !isCount(places_replaced)) return false;
  if (typeof by_type !== 'object' || by_type === null || Array.isArray(by_type)) return false;
  return Object.values(by_type).every(isCount);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
