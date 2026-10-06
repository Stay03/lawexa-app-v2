import { dehydrate, type DehydratedState, type QueryKey } from '@tanstack/react-query';
import type { CaseDetailResponse } from '@/types/case';
import { makeQueryClient } from '@/v2/runtime/query';

/**
 * The case page's hydration state from the server's read of the case, or
 * nothing. Kept out of `server.ts` (which is `server-only`) so the rule is
 * tested directly.
 *
 * NOTHING ON ANY FAILED READ. `apiFetch` throws on every non-2xx answer, and a
 * timeout or a network error throws too. The one that matters most is 401: the
 * case route has no `auth:sanctum` and would serve a dead cookie token as a
 * guest with 200, so the API refuses an SSR read whose bearer does not resolve
 * to a user (SSR cross-check N1). That 401 lands here, nothing is hydrated,
 * and the screen fetches the case with the reader's own token, as before.
 * An answer without the case is treated the same.
 *
 * A fresh query client, so this boundary carries this case and nothing from
 * the layout's shared client.
 */
export async function caseDetailState(
  queryKey: QueryKey,
  read: () => Promise<CaseDetailResponse>,
): Promise<DehydratedState | undefined> {
  let detail: CaseDetailResponse;
  try {
    detail = await read();
  } catch {
    return undefined;
  }
  if (!detail?.success || !detail.data) return undefined;

  const queryClient = makeQueryClient();
  queryClient.setQueryData(queryKey, detail);
  return dehydrate(queryClient);
}
