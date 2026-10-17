'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { useV2Session } from '@/v2/runtime/session-context';
import { statutesQueries } from '../queries';
import { useStatutePeek } from '../statute-peek';
import { StatuteFallback } from './StatuteFallback';
import { StatuteDocument } from './StatuteDocument';
import { StatuteHeader } from './StatuteHeader';
import { StatuteNotesProvider } from '../notes/context';
import {
  STATUTE_COLUMN,
  StatuteErrorState,
  StatuteNotFoundState,
  StatuteRateLimitState,
  StatuteSignedOutState,
  isNotFound,
  isRateLimited,
} from './states';

/**
 * StatuteScreen — the `/statutes/[slug]` client root.
 *
 * TWO PARALLEL FETCHES, deliberately (the shape v1 got right and the study
 * kept): the small METADATA read gates the header — title, status, provenance
 * paint fast — while the heavy AKN XML streams behind the document skeleton
 * inside `StatuteDocument`. The reader is never made to wait on 275 KB of XML
 * to learn which Act they opened.
 *
 * The server shell above owns `generateMetadata`; this owns everything a
 * reader sees.
 *
 * SIGNED-OUT: measured July 31, 2026, both statute reads 401 without a bearer
 * token — the queries are gated and the visitor gets the designed sign-in
 * state (guests hold real tokens and read normally).
 *
 * `provision` is the citation path segment (`/statutes/{slug}/section-54-2`
 * → "section-54-2"), carried through untouched: resolving it needs the parsed
 * document, which only `StatuteDocument` holds.
 */
export function StatuteScreen({
  slug,
  provision,
}: {
  slug: string;
  provision: string | null;
}) {
  const { signedIn } = useV2Session();

  const query = useQuery({
    ...statutesQueries.detail(slug),
    enabled: signedIn,
  });
  const detail = query.data?.data ?? null;
  // A tapped row's name already on screen (`statute-peek.ts`, speed step 5)
  // stays still when the statute arrives: the kicker, the name and the
  // designation do not fade, everything else does (`v2-statute-arrive-peeked`
  // in statute-document.css). Decided once, at mount.
  const peeked = useStatutePeek(slug) !== null;
  const [arrival] = useState(() => (query.isPending && peeked ? 'peeked' : 'fade'));

  // THE TEXT STARTS WITH THE METADATA, NOT AFTER IT (speed step 5). The
  // document's read (`statutesQueries.akn`, up to ~900 KB) lives in
  // `StatuteDocument`, which mounts only once the metadata has answered, so the
  // body waited for one read and then the other. Its key is the slug alone and
  // nothing in the metadata decides whether it runs (backend, 17 October 2026:
  // a statute with no text answers a small empty document, read today all the
  // same; both reads count one view, deduplicated per reader). So it starts
  // here, beside the metadata, and `StatuteDocument` picks up the same entry.
  // Only for an open from a tapped row, whose slug the list proved: a pasted
  // dead link would otherwise spend a second 404 and a throttle hit. A
  // prefetch, so this screen does not re-render when the text lands.
  const queryClient = useQueryClient();
  const [fromRow] = useState(() => peeked);
  useEffect(() => {
    if (signedIn && fromRow) void queryClient.prefetchQuery(statutesQueries.akn(slug));
  }, [signedIn, fromRow, queryClient, slug]);

  /**
   * NOTHING IS PUBLISHED TO THE HEADER FROM HERE ANY MORE (phase 7). The bar
   * used to carry the short designation ("Act 9") while `StatuteHeader` below
   * it was headed with the Act's full name: one instrument under two names, on
   * one screen. The masthead keeps the name, with the country, the year, the
   * status and what repealed it around it; the bar keeps the way back and
   * nothing else. See `PushedTitle` in `v2/shell/pushed-route.ts`.
   */

  if (!signedIn) {
    return (
      <div className={STATUTE_COLUMN}>
        <StatuteSignedOutState />
      </div>
    );
  }

  // The route's loading shape, a tapped row's name included, so the hand-off
  // from the boundary to this wait moves nothing.
  if (query.isPending) return <StatuteFallback />;

  if (query.isError) {
    // A dead slug REJECTS (axios throws on 404) — it must land on the
    // not-found state, not on an error whose "Try again" can never succeed.
    return (
      <div className={STATUTE_COLUMN}>
        {isNotFound(query.error) ? (
          <StatuteNotFoundState />
        ) : isRateLimited(query.error) ? (
          <StatuteRateLimitState onRetry={() => void query.refetch()} />
        ) : (
          <StatuteErrorState onRetry={() => void query.refetch()} />
        )}
      </div>
    );
  }

  if (!detail) {
    return (
      <div className={STATUTE_COLUMN}>
        <StatuteNotFoundState />
      </div>
    );
  }

  return (
    // `relative` anchors the contents rail beside the column; the flex column
    // is what lets the mobile contents pill stick to the bottom edge for the
    // whole read (the CaseScreen layout mechanics). `.v2-statute-doc` scopes
    // the reading typography. The notes provider shares researchers' notes
    // between the header's Notes button and the document's underlines.
    <StatuteNotesProvider slug={slug} statuteId={detail.id}>
      <div className="v2-statute-doc relative mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pb-24 pt-5 sm:pt-8">
        <article
          aria-label={detail.title}
          className={cn(
            'flex flex-col gap-8',
            arrival === 'peeked'
              ? 'v2-statute-arrive-peeked'
              : 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300',
          )}
        >
          <StatuteHeader detail={detail} />
          {/* KEYED BY SLUG: a statute→statute navigation reuses this component
              instance, and an inherited `mountedCount` ≥ the new document's
              block count would mount the entire second document in ONE
              synchronous commit — the exact jank the progressive mount exists
              to prevent — and skip its deep link. The key resets the engine. */}
          <StatuteDocument key={slug} slug={slug} provision={provision} />
        </article>
      </div>
    </StatuteNotesProvider>
  );
}
