import { queryOptions } from '@tanstack/react-query';

import { ambassadorsApi } from '@/lib/api/ambassadors';
import { STALE_TIMES } from '@/v2/runtime/query';

/**
 * The sharer's own ambassador code, cached once for the whole session.
 *
 * ── WHY A CACHED LOOKUP AND NOT A CALL PER SHARE ──────────────────────────
 * Every share button in the app needs to know whether the person pressing it
 * has a code. Asking each time a share sheet opens would mean a request per
 * press, on a screen the great majority of people can press without ever having
 * a code. So it is fetched once and read everywhere.
 *
 * ── THE ENDPOINT REFUSES NON-AMBASSADORS, AND THAT SHAPES THIS ────────────
 * `/ambassadors/code` answers 403 to anybody who is not an approved ambassador,
 * which is nearly everybody. A refusal here is a normal answer, not a fault: it
 * means "you have no code", and it must not retry, must not surface an error,
 * and must not stop the share from happening.
 *
 * So the failure path returns `null` rather than throwing. A share button that
 * breaks because somebody is not an ambassador would be a far worse bug than
 * the missing credit it was meant to add.
 *
 * ── LONG STALE TIME ON PURPOSE ────────────────────────────────────────────
 * A person's code changes when they deliberately claim a new one, on a screen
 * that invalidates this itself. Between those moments it is effectively fixed,
 * so re-asking on every screen visit buys nothing.
 */
export const sharingQueries = {
  all: () => ['v2', 'sharing'] as const,

  /** `viewerId` is in the key so a sign-out and a different sign-in cannot read
   *  the previous person's code out of the cache. */
  referralCode: (viewerId: number | null) =>
    queryOptions({
      queryKey: [...sharingQueries.all(), 'referral-code', { viewerId }] as const,
      queryFn: async (): Promise<string | null> => {
        try {
          const response = await ambassadorsApi.getCode();
          /* Two separate absences, both meaning no code: the payload itself can
             be null, and an ambassador who has never claimed one has a null
             `current`. Neither is an error and both end here. */
          return response.data?.current?.code ?? null;
        } catch {
          /* 403 for a non-ambassador is the ordinary case and means no code.
             Anything else — offline, a 500 — also means we cannot add a code to
             this link, and the share must still work. Same answer, no noise. */
          return null;
        }
      },
      staleTime: STALE_TIMES.reference,
      /* Signed-out people cannot have a code, so nothing is asked for them. */
      enabled: viewerId !== null,
      /* One refusal is the answer, not a transient failure to ride out. */
      retry: false,
    }),
};
