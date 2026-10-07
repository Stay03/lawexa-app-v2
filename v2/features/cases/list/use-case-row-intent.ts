'use client';

import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useIntentPrefetch } from '@/v2/shell/use-intent-prefetch';
import { useV2Session } from '@/v2/runtime/session-context';
import { casesQueries } from '../queries';
import { canPrefetchCase } from '../case-prefetch';

/**
 * A search row's intent handlers: the route prefetch every reader gets
 * (`useIntentPrefetch`), plus, for a signed-in account, a read of the case
 * itself into the memory cache, so the case route's loading boundary can draw
 * the case the moment the row is tapped (owner, 7 October 2026, option 2).
 *
 * The read carries the prefetch header and counts no view. Moving on (the
 * mouse leaves, the finger scrolls) cancels a read still in flight, unless the
 * row was clicked: then the read is the one the tap is waiting for.
 */
export function useCaseRowIntent(href: string, slug: string, searchQuery?: string) {
  const queryClient = useQueryClient();
  const allowed = canPrefetchCase(useV2Session());
  const opened = useRef(false);

  const onIntent = useCallback(() => {
    if (!allowed) return;
    opened.current = false;
    void queryClient.prefetchQuery(casesQueries.prefetchDetail(slug, searchQuery));
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
