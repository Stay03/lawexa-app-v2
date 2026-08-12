'use client';

import { useQuery } from '@tanstack/react-query';
import { systemHealthApi } from '@/lib/api/system-health';

export const systemHealthKeys = {
  all: ['system-health'] as const,
};

/**
 * The live health of mail, the queue, the database and the cache.
 *
 * IT POLLS ON A FIXED INTERVAL, unlike the job summaries beside it, which only
 * poll while they can see work in flight. Those can tell from their own data
 * whether anything is happening; this one cannot — the whole point of it is to
 * notice something breaking while the screen sits open and nothing appears to
 * be happening at all.
 */
export function useSystemHealth() {
  return useQuery({
    queryKey: systemHealthKeys.all,
    queryFn: () => systemHealthApi.getHealth(),
    staleTime: 20 * 1000,
    refetchInterval: 30 * 1000,
  });
}
