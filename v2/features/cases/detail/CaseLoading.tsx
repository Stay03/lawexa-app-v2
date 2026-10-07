'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { casesQueries } from '../queries';
import { drawableCase } from '../case-prefetch';
import { CaseFallback, CaseScreen } from './CaseScreen';

/**
 * The case route's loading boundary. While page.tsx waits on its server read
 * (the read that counts the view), this draws the case at once if the reader's
 * memory cache already holds it: a search row prefetched on intent, or a case
 * read earlier in the visit. Otherwise it is the skeleton, as before.
 *
 * The observer is DISABLED and uses the prefetch query function, so this
 * boundary never sends a read of its own: it only re-renders when the
 * prefetch lands. When the page arrives, its hydrated answer is newer and
 * replaces the cached one under the same key.
 */
export function CaseLoading() {
  const { slug } = useParams<{ slug: string }>();
  const searchQuery = useSearchParams().get('q')?.trim() || undefined;
  const { data } = useQuery({ ...casesQueries.prefetchDetail(slug, searchQuery), enabled: false });
  return drawableCase(data) ? <CaseScreen slug={slug} /> : <CaseFallback />;
}
