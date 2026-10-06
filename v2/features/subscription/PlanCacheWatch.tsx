'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { noteDeviceCachePlan } from '@/v2/runtime/persist/device-cache';
import { planKeyOf } from '@/v2/runtime/persist/policy';
import { subscriptionQueries } from './queries';

/**
 * Drops the pages kept on this device when the reader's plan changes. Renders
 * nothing.
 *
 * A case, note or statute kept under one plan must not paint under another
 * (device-cache plan, amendment 1). The kept copy of a gated page is sent again
 * on every open anyway, and a limited answer then replaces it; this wipe means
 * a lapsed plan does not even get the one paint of the old full text.
 *
 * It reads the same `subscription/current` query the account row in the shell
 * already runs, so it adds no request. The plan is fingerprinted by
 * `planKeyOf` (plan id, subscription status, free or paid); the device cache
 * compares it with the last one it recorded for this reader.
 */
export function PlanCacheWatch({ userId }: { userId: number | null }) {
  const { data } = useQuery({
    ...subscriptionQueries.current(),
    enabled: userId !== null,
  });
  const planKey = userId === null ? null : planKeyOf(data);

  useEffect(() => {
    if (planKey) void noteDeviceCachePlan(planKey);
  }, [planKey]);

  return null;
}
