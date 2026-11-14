import type { QueryClient } from '@tanstack/react-query';

import { orderedCategories } from '@/lib/utils/redaction-categories';
import type { RedactionCategory, RedactionDefaultResponse } from '@/types/redaction';

/** The cached answer of `GET /users/redaction-default`, per signed-in person. */
export const redactionDefaultKey = (userId: number | null) => ['redaction-default', userId] as const;

/** Every person's cached default: the key's first part. */
const REDACTION_DEFAULT_ROOT = ['redaction-default'] as const;

/**
 * The default once a redacted chat has started with `sent`: the server makes
 * the first message's choice the person's default (ChatController), so the
 * cached answer takes it too. Nothing sent (the server used the saved default)
 * leaves it as it was.
 */
export function defaultAfterStart(
  previous: RedactionDefaultResponse | undefined,
  sent: readonly RedactionCategory[] | undefined,
): RedactionDefaultResponse | undefined {
  const chosen = sent ? orderedCategories(sent) : [];
  if (!previous || chosen.length === 0) return previous;
  return { ...previous, data: { ...previous.data, categories: chosen } };
}

/**
 * THE HOME BOX NEVER STARTS FROM A DEFAULT THE SERVER HAS REPLACED (Fable's
 * review of V3, 14 November 2026). The default was kept for five minutes, so
 * after a chat that hid names only, the next redacted chat within that time
 * said "all 6 kinds" and sent six, setting the server's default back. When a
 * redacted chat starts, the cached default takes the choice it was sent with
 * at once, and is read again from the server, which stays the one source.
 */
export function settleRedactionDefault(client: QueryClient, sent: readonly RedactionCategory[] | undefined): void {
  client.setQueriesData<RedactionDefaultResponse>({ queryKey: REDACTION_DEFAULT_ROOT }, (previous) =>
    defaultAfterStart(previous, sent),
  );
  void client.invalidateQueries({ queryKey: REDACTION_DEFAULT_ROOT });
}
