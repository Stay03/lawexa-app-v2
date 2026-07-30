'use client';

import { Suspense, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { extractViewLimitError } from '@/lib/utils/api-error';
import { useV2Session } from '@/v2/runtime/session-context';
import { pushUrlParams, replaceUrlParams } from '@/v2/runtime/url-params';
import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import { casesQueries } from '../queries';
import { formatCaseName } from '../case-name';
import { CaseAskDock } from './CaseAsk';
import { CaseChatSurface } from './CaseChatPanel';
import { buildCaseOutline, CaseDocument } from './CaseDocument';
import { CaseOutline } from './CaseOutline';
import { ReadingProgress } from './ReadingProgress';
import {
  CASE_COLUMN,
  CaseDocumentSkeleton,
  CaseErrorState,
  CaseHardLimitState,
  CaseNotFoundState,
} from './states';

/**
 * CaseScreen — the `/cases/[slug]` client root.
 *
 * The server shell above it owns `generateMetadata` (title, canonical, the OG
 * card) so a pasted link unfurls correctly; this owns everything a reader sees.
 * They read the SAME case from two different places on purpose: the metadata
 * fetch is unauthenticated and shared-cached because a crawler is not signed in,
 * while this one carries the reader's session and therefore their bookmark state
 * and their plan's view allowance. Merging them would mean either caching a
 * per-user response across users or emitting metadata only signed-in readers can
 * see — both wrong.
 *
 * LAYOUT: a min-h-full flex column. The document and the reader's prior chats
 * are the flow; `CaseAskDock` is `sticky bottom-0` at the end of it, so the
 * composer floats over the judgment for the whole read (owner, July 29 — the
 * same mechanic as the home tabs' dock, and the same reachable-composer feel as
 * the conversation screen).
 */
export function CaseScreen({ slug }: { slug: string }) {
  return (
    // `useSearchParams` (the `?q=` read-attribution parameter) requires a
    // boundary; the fallback is the document skeleton at the real geometry.
    <Suspense fallback={<CaseFallback />}>
      <CaseBody slug={slug} />
    </Suspense>
  );
}

function CaseBody({ slug }: { slug: string }) {
  const { signedIn, userId } = useV2Session();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q')?.trim() || undefined;

  // ── The side chat's URL state: `?chat={id}`. ──
  // OPEN is a PUSH (a new history entry), so the back button closes the panel
  // and returns to the reading — the navigation the owner asked for. CLOSE
  // prefers `history.back()` when this session pushed the entry (keeping
  // history clean); a direct load of a `?chat=` link has no entry of ours to
  // pop, so the X strips the param in place instead of leaving the page.
  const chatId = searchParams.get('chat');
  const chatPushedRef = useRef(false);
  const openChat = useCallback((id: string) => {
    if (pushUrlParams({ chat: id })) chatPushedRef.current = true;
  }, []);
  const closeChat = useCallback(() => {
    if (chatPushedRef.current) {
      chatPushedRef.current = false;
      window.history.back();
    } else {
      replaceUrlParams({ chat: null });
    }
  }, []);

  const query = useQuery(casesQueries.detail(slug, searchQuery));
  const detail = query.data?.data ?? null;
  // The header centre gets the SHORT title (the July contract ships one —
  // "Skye Bank Plc v Iwu") so a long multi-party name never truncates the bar.
  const headerName = detail
    ? formatCaseName(detail.short_title || detail.display_title || detail.title)
    : null;

  // Publish the header title once it resolves, and clear it on the way out so
  // the next route never inherits this case's name. An external-store write, not
  // React state — which is what makes it legal in an effect under the React
  // Compiler lint.
  useEffect(() => {
    if (!headerName) return;
    setHeaderContext({ title: headerName, confidential: false });
  }, [headerName]);
  useEffect(() => () => clearHeaderContext(), []);

  if (query.isPending) {
    return (
      <div className={CASE_COLUMN}>
        <CaseDocumentSkeleton />
      </div>
    );
  }

  if (query.isError) {
    // A 429 is not a failure to load — it is the plan's monthly allowance, and it
    // deserves its own screen with the numbers and the reset date on it.
    const limit = extractViewLimitError(query.error);
    return (
      <div className={CASE_COLUMN}>
        {limit ? (
          <CaseHardLimitState limit={limit} />
        ) : (
          <CaseErrorState onRetry={() => void query.refetch()} />
        )}
      </div>
    );
  }

  if (!detail) {
    return (
      <div className={CASE_COLUMN}>
        <CaseNotFoundState />
      </div>
    );
  }

  const outline = buildCaseOutline(detail);

  return (
    // With the side chat open (≥lg) this is a row: the reading column centres
    // itself in the remaining space (auto margins in flex), the panel takes a
    // fixed 26rem on the right. Closed, it is exactly the old layout.
    <div className="flex min-h-full w-full">
      {/* The tall column the sticky dock needs: the document is the flow; the
          pill dock is pinned to the bottom edge and floats over the reading.
          `.v2-case-doc` scopes the reading typography (case-document.css).
          `relative` anchors the outline rail beside the column. */}
      <div className="v2-case-doc relative mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pt-5 sm:pt-8">
        <ReadingProgress />
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
          <CaseDocument detail={detail} />
        </div>
        {/* The map, only when the document is long enough to need one (four or
            more parts), only where the shell has true dead margin beside the
            column (≥80rem: the shell is a single full-width scroll region, so
            a 1280px viewport leaves 256px clear per side — the rail needs
            216px), and only while the chat is CLOSED — open, that margin is
            the panel's. */}
        {outline.length >= 4 && !chatId ? (
          <aside className="absolute inset-y-0 left-full ml-10 hidden w-44 min-[80rem]:block">
            <div className="sticky top-8 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
              <CaseOutline sections={outline} />
            </div>
          </aside>
        ) : null}
        {/* The ask pill yields while the chat is open — the panel carries the
            composer, and two competing inputs is one too many. */}
        {!chatId ? (
          <CaseAskDock
            slug={slug}
            signedIn={signedIn}
            viewerId={userId}
            onOpenChat={openChat}
          />
        ) : null}
      </div>

      <CaseChatSurface chatId={chatId} onClose={closeChat} />
    </div>
  );
}

/** The Suspense fallback — identical to `app/v2/cases/[slug]/loading.tsx`. */
export function CaseFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading case
      </span>
      <div aria-hidden inert className={CASE_COLUMN}>
        <CaseDocumentSkeleton still />
      </div>
    </>
  );
}
