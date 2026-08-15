'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { extractViewLimitError } from '@/lib/utils/api-error';
import { useV2Session } from '@/v2/runtime/session-context';
import {
  quietPushUrlParams,
  quietReplaceUrlParams,
} from '@/v2/runtime/url-params';
import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import type { JurisdictionChoice } from '@/types/jurisdiction';
import { casesQueries } from '../queries';
import { formatCaseName } from '../case-name';
import { CaseAskDock } from './CaseAsk';
import { useStartCaseChat, type CaseChatStart } from './CaseChatCore';
import { CaseChatDocked, CaseChatSheet } from './CaseChatPanel';
import { buildCaseOutline, CaseDocument } from './CaseDocument';
import { CaseOutline } from './CaseOutline';
import { ReadingProgress } from './ReadingProgress';
import { usePanelBreakpoint } from './use-panel-breakpoint';

/** The reader's docked-vs-floating chat preference, remembered per device. */
const DOCK_PREF_KEY = 'v2-case-chat-docked';
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

  // ── The side chat: LOCAL STATE is the source of truth; the URL is a
  // mirror and an entry point, written QUIETLY. ──
  //
  // Two implementations died here; the autopsy is in `url-params.ts`. Short
  // version: on a soft-navigated case page (served through the v2 rewrite
  // proxy), ANY history write the App Router notices dispatches its Next-16
  // restore machinery, whose segment walk trips over the rewritten `[slug]`
  // param and spirals into an endless `/cases/undefined` refetch loop — and
  // those background commits kept resurrecting the closing panel ("closes,
  // pops open, closes again"). Deriving the panel from `useSearchParams()`
  // (impl 1) made every loop commit re-toggle it; plain local state (impl 2)
  // still re-initialised on the loop's remounts. The cure is upstream of
  // both: the QUIET writes below change the URL without waking the router at
  // all, so the loop never starts and nothing ever re-renders the panel but
  // the reader.
  //
  //  - `chat` changes ONLY on user action (open / close / switch / Back);
  //  - state initialises from the URL once, on mount (direct `?chat=` links);
  //  - open quiet-PUSHES the param (Back closes the panel);
  //  - close and in-panel hops quiet-REPLACE it (the panel stays ONE history
  //    entry, so Back closes in one step and never walks internal hops);
  //  - one popstate listener adopts the real URL on Back/Forward.
  const [chat, setChat] = useState<string | null>(
    () => searchParams.get('chat'),
  );
  const openChat = useCallback((id: string) => {
    setChat(id);
    quietPushUrlParams({ chat: id });
  }, []);
  const closeChat = useCallback(() => {
    setChat(null);
    quietReplaceUrlParams({ chat: null });
  }, []);
  const switchChat = useCallback((id: string) => {
    setChat(id);
    quietReplaceUrlParams({ chat: id });
  }, []);
  useEffect(() => {
    const onPopState = () => {
      setChat(new URLSearchParams(window.location.search).get('chat'));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // ── Presence holdover: every chat presentation animates OUT before its
  // unmount. The render-phase adopt of a new id is the sanctioned
  // adjust-during-render reset. ──
  const [renderedChat, setRenderedChat] = useState(chat);
  if (chat !== null && chat !== renderedChat) setRenderedChat(chat);
  const chatClosing = chat === null && renderedChat !== null;
  useEffect(() => {
    if (!chatClosing) return;
    // A shade past the 200ms exit animation, whose last frame is held by
    // `fill-mode-forwards` (the tw-animate-css VARIABLE mechanism — see the
    // exit-animation note in CaseChatPanel; the arbitrary-property spelling
    // silently never applied) — the unmount happens strictly AFTER the
    // animation lands, and the held fill covers the gap between them.
    const timer = window.setTimeout(() => setRenderedChat(null), 240);
    return () => window.clearTimeout(timer);
  }, [chatClosing]);

  // Which presentation: sheet below xl; floating card (default) or the docked
  // column (the reader's persisted choice) at xl. A JS decision, not a CSS
  // one — exactly ONE container may mount, or one conversation would run two
  // live controllers.
  const isDesktopPanel = usePanelBreakpoint();
  const [docked, setDocked] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.localStorage.getItem(DOCK_PREF_KEY) === '1',
  );
  const setDockedPref = useCallback((next: boolean) => {
    setDocked(next);
    try {
      window.localStorage.setItem(DOCK_PREF_KEY, next ? '1' : '0');
    } catch {
      // Preference only — losing it costs a click, never the chat.
    }
  }, []);

  // ── The CREATE state, lifted here so every presentation shares one
  // submission (a double submit is impossible across surfaces) and the list
  // state's jurisdiction survives presentation swaps. The DRAFT is not here:
  // the one composer owns it, persisted per case (`case:{slug}`), which is
  // what lets the composer be the same element in every state. ──
  const [jurisdiction, setJurisdiction] = useState<JurisdictionChoice>({
    mode: 'auto',
  });
  const startState = useStartCaseChat(slug, signedIn, switchChat, jurisdiction);
  const start: CaseChatStart = {
    ...startState,
    jurisdiction,
    onJurisdictionChange: setJurisdiction,
  };

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

  // At xl-floating, the DOCK is the whole chat: closed pill, new-chat panel,
  // and the embedded conversation are three states of ONE card. The separate
  // presentations remain only where geometry demands them (sheet below xl,
  // the docked column by choice).
  const floatingContext = isDesktopPanel === true && !docked;
  const showDocked = renderedChat !== null && isDesktopPanel === true && docked;
  const showSheet = renderedChat !== null && isDesktopPanel === false;
  // The dock stays mounted through every floating state so the composer
  // element is never remounted across closed ⇄ open (focus survives).
  const showDock = floatingContext || renderedChat === null;

  return (
    // With the side chat open (≥xl) this is a row: the reading column centres
    // itself in the remaining space (auto margins in flex), the panel takes a
    // fixed 26rem on the right. Closed, it is exactly the old layout.
    // `overflow-x-clip` so the panel's width reveal can never mint a
    // horizontal scrollbar (clip, not hidden — no scroll container, so the
    // panel's sticky inner box still tracks the shell scroller).
    <div className="flex min-h-full w-full overflow-x-clip">
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
            216px), and not while the DOCKED chat holds that margin — the
            floating card leaves the page's geometry alone, so the rail
            stays. */}
        {outline.length >= 4 && !showDocked ? (
          <aside className="absolute inset-y-0 left-full ml-10 hidden w-44 min-[80rem]:block">
            <div className="sticky top-8 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
              <CaseOutline sections={outline} />
            </div>
          </aside>
        ) : null}
        {/* THE composer's dock — at xl-floating it is the entire chat (one
            card, three states). It hides only while another surface owns the
            composer (the sheet below xl, the docked column by choice). */}
        {showDock ? (
          <CaseAskDock
            slug={slug}
            signedIn={signedIn}
            viewerId={userId}
            start={start}
            view={floatingContext ? renderedChat : null}
            panelOpen={chat !== null && floatingContext}
            onEngage={() => {
              if (chat === null) openChat('new');
            }}
            onClose={closeChat}
            onDock={() => setDockedPref(true)}
            onOpenChat={switchChat}
          />
        ) : null}
      </div>

      {showDocked && renderedChat !== null ? (
        <CaseChatDocked
          chatId={renderedChat}
          closing={chatClosing}
          slug={slug}
          signedIn={signedIn}
          viewerId={userId}
          start={start}
          onClose={closeChat}
          onSwitchChat={switchChat}
          onFloat={() => setDockedPref(false)}
        />
      ) : null}
      {showSheet && renderedChat !== null ? (
        <CaseChatSheet
          chatId={renderedChat}
          closing={chatClosing}
          slug={slug}
          signedIn={signedIn}
          viewerId={userId}
          start={start}
          onClose={closeChat}
          onSwitchChat={switchChat}
        />
      ) : null}
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
        <CaseDocumentSkeleton />
      </div>
    </>
  );
}
