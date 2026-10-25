import type { RecoverResult } from './types';

/**
 * recover-with-retry — a screen that opens a chat mid-turn must not lose the
 * turn to one failed read (Lucy, 25 October 2026).
 *
 * On open, a screen reads the conversation's status once (`recoverPendingState`)
 * to re-attach to a turn still running. That one read was the only way back: a
 * read that threw was swallowed, a turn whose answer this copy of the transcript
 * lacked stayed without it, and nothing ever looked again, so the answer only
 * showed after a reload.
 *
 * Now a read that throws ('load_history') is tried again after
 * {@link RECOVER_RETRY_DELAYS_MS}. If it still does not re-attach, the engine
 * follows the conversation until the turn is done whenever the transcript ends
 * on a question with no answer (`followUntilAnswered`), and the server's copy
 * then brings the answer in. A transcript that already ends on an answer is
 * left alone: nothing is polled for a finished chat.
 */

/** Waits before the second and third status reads. */
export const RECOVER_RETRY_DELAYS_MS = [1_000, 3_000] as const;

export interface RecoverWithRetryDeps {
  recover: (conversationId: string) => Promise<RecoverResult>;
  followUntilAnswered: (conversationId: string) => boolean;
  /** True once the screen has gone (or opened another chat): stop at once. */
  cancelled: () => boolean;
  wait?: (ms: number) => Promise<void>;
}

export type RecoverOutcome = RecoverResult | 'cancelled' | 'following';

export async function recoverWithRetry(conversationId: string, deps: RecoverWithRetryDeps): Promise<RecoverOutcome> {
  const wait = deps.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let result: RecoverResult = await deps.recover(conversationId).catch(() => 'load_history' as const);
  for (const delay of RECOVER_RETRY_DELAYS_MS) {
    if (result !== 'load_history') break;
    await wait(delay);
    if (deps.cancelled()) return 'cancelled';
    result = await deps.recover(conversationId).catch(() => 'load_history' as const);
  }
  if (deps.cancelled()) return 'cancelled';
  if (result === 'reconnected') return result;
  return deps.followUntilAnswered(conversationId) ? 'following' : result;
}
