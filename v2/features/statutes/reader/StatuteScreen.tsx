'use client';

import { useQuery } from '@tanstack/react-query';

import { useV2Session } from '@/v2/runtime/session-context';
import { statutesQueries } from '../queries';
import { StatuteDocument } from './StatuteDocument';
import { StatuteHeader } from './StatuteHeader';
import {
  STATUTE_COLUMN,
  StatuteDocumentSkeleton,
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

  if (query.isPending) {
    return (
      <div className={STATUTE_COLUMN}>
        <StatuteDocumentSkeleton />
      </div>
    );
  }

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
    // the reading typography.
    <div className="v2-statute-doc relative mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pb-24 pt-5 sm:pt-8">
      <article
        aria-label={detail.title}
        className="flex flex-col gap-8 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
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
  );
}

/** The Suspense/route fallback — identical to `app/v2/statutes/[slug]/loading.tsx`. */
export function StatuteFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading statute
      </span>
      <div aria-hidden inert className={STATUTE_COLUMN}>
        <StatuteDocumentSkeleton />
      </div>
    </>
  );
}
