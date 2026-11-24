import type { ToolResult } from '@/types/chat';

/**
 * The server's own softening of a failed lookup (since d5045bf8, 22 October
 * 2026): a reader below researcher gets the step as a SUCCESS with this
 * sentence in place of the error, which drew a tick and "Read section 13" for
 * a read that found nothing. It is a lookup that found nothing.
 *
 * In lib so a single step (step-failure.ts) and a batch's lookups
 * (tool-batch.ts) read it the same way.
 */
export const SOFTENED_LOOKUP_MISS = 'That lookup found nothing, so Lawexa tried another way.';

/** The softened miss, on a lazy row's `error` or in the fetched result's `message`. */
export function isSoftenedMiss(result: ToolResult | null | undefined): boolean {
  if (!result) return false;
  if (typeof result.error === 'string' && result.error.trim() === SOFTENED_LOOKUP_MISS) return true;
  const { data } = result;
  if (typeof data === 'string') return data.trim() === SOFTENED_LOOKUP_MISS;
  const text = data && typeof data === 'object' ? (data as Record<string, unknown>).message : null;
  return typeof text === 'string' && text.trim() === SOFTENED_LOOKUP_MISS;
}
