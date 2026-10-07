'use client';

import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useIntentPrefetch, type IntentSource } from '@/v2/shell/use-intent-prefetch';
import { useV2Session } from '@/v2/runtime/session-context';
import { casesQueries } from '../queries';
import { canPrefetchCase } from '../case-prefetch';
import { layerOffInBrowser } from '@/v2/runtime/perf-switch';

/**
 * A search row's intent handlers: the route prefetch every reader gets
 * (`useIntentPrefetch`), plus, for a signed-in account, a read of the case
 * itself into the memory cache, so the case route's loading boundary can draw
 * the case the moment the row is tapped (owner, 7 October 2026, option 2).
 *
 * The read carries the prefetch header and counts no view. Mouse, pen and
 * keyboard focus only: a touch keeps the route prefetch alone (see onIntent).
 * The mouse leaving cancels a read still in flight, unless the row was
 * clicked: then the read is the one the tap is waiting for.
 */
export function useCaseRowIntent(href: string, slug: string, searchQuery?: string) {
  const queryClient = useQueryClient();
  const allowed = canPrefetchCase(useV2Session());
  const opened = useRef(false);

  const onIntent = useCallback((source: IntentSource) => {
    // A finger is not read ahead: the tap follows within about 100 ms, so the
    // read and the boundary's code would compete with the navigation itself on
    // a phone's link (measured 7 October 2026: no gain, 0.3 to 0.5 s slower on
    // a Lighthouse mobile profile). Phones keep the route prefetch only.
    if (!allowed || source === 'touch') return;
    // The case read performance layer can be off in this browser (`perf-switch.ts`).
    if (layerOffInBrowser('read')) return;
    opened.current = false;
    void queryClient.prefetchQuery(casesQueries.prefetchDetail(slug, searchQuery));
    // The loading boundary is a client component that carries the whole case
    // screen; until its code is in the browser the router holds the tap on
    // the list (measured: about 0.4 s on a local build). Load it now.
    void import('../detail/CaseLoading');
  }, [allowed, queryClient, slug, searchQuery]);

  const onAbandon = useCallback(() => {
    if (!allowed || opened.current) return;
    void queryClient.cancelQueries({
      queryKey: casesQueries.detail(slug, searchQuery).queryKey,
      exact: true,
    });
  }, [allowed, queryClient, slug, searchQuery]);

  const intent = useIntentPrefetch(href, { onIntent, onAbandon });

  return {
    ...intent,
    onClick: () => {
      opened.current = true;
    },
  };
}
