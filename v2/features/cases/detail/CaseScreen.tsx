'use client';

import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { extractViewLimitError, isNotFoundError } from '@/lib/utils/api-error';
import { useV2Session } from '@/v2/runtime/session-context';
import { useCasePeek } from '../case-peek';
import { countOpen } from '../case-view';
import { casesQueries, searchTermOf } from '../queries';
import { CaseAskDock } from './CaseAsk';
import type { ChatSubject } from './chat-subject';
import { CaseChatDocked } from './CaseChatPanel';
import { CaseFallback } from './CaseFallback';
import { buildCaseOutline, CaseDocument } from './CaseDocument';
import { CaseOutline } from './CaseOutline';
import { ReadingProgress } from './ReadingProgress';
import { useDocumentChat } from './use-document-chat';
import {
  CASE_COLUMN,
  CaseErrorState,
  CaseHardLimitState,
  CaseNotFoundState,
} from './states';
import { isAccountRole } from '@/v2/runtime/account';
import {
  useSidePanelUrl,
  type SidePanelUrlState,
} from '@/v2/features/conversations/conversation/side-panel/SidePanelContext';
import type { SidePanelTarget } from '@/v2/features/conversations/conversation/side-panel/side-panel-value';
import {
  SidePanelHostProvider,
  type SidePanelHost,
} from '@/v2/features/conversations/conversation/side-panel/side-panel-host';
import { measureFloatingChat, playMoveToDock, type FloatingChatPlace } from './case-draft-move';

// TEMPORARY, with its file: live viewport numbers for an iPhone recording,
// loaded only with `?kbdebug=1` on the address (see KeyboardDebugReadout).
const KeyboardDebugReadout = dynamic(
  () => import('./KeyboardDebugReadout').then((module) => module.KeyboardDebugReadout),
  { ssr: false },
);

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
  const { signedIn: sessionSignedIn, userId, role } = useV2Session();
  // The chat belongs to an account; a guest pass reads the case and meets the
  // chat as a visitor (v2/runtime/account.ts).
  const signedIn = sessionSignedIn && isAccountRole(role);
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q')?.trim() || undefined;
  const keyboardDebug = searchParams.get('kbdebug') === '1';

  // THE DRAFT EDITOR (Stay, 24 October 2026, option 1: "Move to the right").
  // A draft Lawexa writes in this page's chat opens in the chat's side panel,
  // `?side=draft:N`, the main chat's own address, so Back closes it. This page
  // owns the param (side-panel-host.tsx): on a computer the chat is docked
  // while it is open, and the editor covers the reading left of the chat.
  const draftUrl = useSidePanelUrl();
  const draftOpen = draftUrl.target?.kind === 'draft';

  // The chat this page hosts: open/close/switch, the presentation, and the
  // one create state (`useDocumentChat`, shared with the statute page).
  const subject = useMemo<ChatSubject>(() => ({ kind: 'case', slug }), [slug]);
  const {
    chat,
    renderedChat,
    chatClosing,
    openChat,
    closeChat: closeChatOnly,
    switchChat,
    start,
    phone,
    desktop,
    dockOwnsChat,
    showDock,
    showDocked,
    pageUnderChat,
    setDockedPref,
  } = useDocumentChat(subject, signedIn, { holdDocked: draftOpen });

  // Opening a draft on a computer DOCKS a floating chat first, and keeps it
  // docked after the editor closes: the reader's choice is set, not only
  // held. The card and the column are measured where they stand, so the
  // move can be played from there once the docked layout is in
  // (case-draft-move.ts).
  const columnRef = useRef<HTMLDivElement | null>(null);
  const moveFrom = useRef<FloatingChatPlace | null>(null);
  const { open: showDraft, closeInPlace: dropDraft } = draftUrl;
  const openDraft = useCallback(
    (target: SidePanelTarget) => {
      if (desktop && !showDocked && target.kind === 'draft') {
        moveFrom.current = measureFloatingChat(columnRef.current);
        setDockedPref(true);
      }
      showDraft(target);
    },
    [desktop, showDocked, setDockedPref, showDraft],
  );
  useLayoutEffect(() => {
    const from = moveFrom.current;
    if (!showDocked || !from) return;
    moveFrom.current = null;
    playMoveToDock(from, columnRef.current);
  }, [showDocked]);

  // Closing the chat takes its draft with it: the panel's param would
  // otherwise outlive the chat it belongs to.
  const closeChat = useCallback(() => {
    dropDraft();
    closeChatOnly();
  }, [dropDraft, closeChatOnly]);
  // Another chat, or the chat list, has no such draft: the editor goes too.
  const switchChatAway = useCallback(
    (id: string) => {
      dropDraft();
      switchChat(id);
    },
    [dropDraft, switchChat],
  );
  // Floating the chat while a draft is open closes the editor first (its
  // exit plays, as on its own ×); the chat floats once it has gone, as
  // `holdDocked` ends. With reduced motion there is no exit to wait for.
  const { close: closeDraft, finishClose: finishDraft } = draftUrl;
  const floatChat = useCallback(() => {
    if (draftOpen) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) finishDraft();
      else closeDraft();
    }
    setDockedPref(false);
  }, [draftOpen, closeDraft, finishDraft, setDockedPref]);

  // Where the embedded chat draws its panel: the editor's box on a computer
  // (below), the body on a phone, where the panel is the sheet over the
  // screen and over the phone chat (z-50 at the root, above the chat's z-40).
  const [draftBox, setDraftBox] = useState<HTMLDivElement | null>(null);
  const editorShown = signedIn && desktop && draftOpen && showDocked && renderedChat !== 'new';
  const draftHostUrl = useMemo<SidePanelUrlState>(() => ({ ...draftUrl, open: openDraft }), [draftUrl, openDraft]);
  const draftHost = useMemo<SidePanelHost>(
    () => ({ url: draftHostUrl, element: desktop ? draftBox : phone ? document.body : null }),
    [draftHostUrl, desktop, draftBox, phone],
  );
  const pageUnder = pageUnderChat || editorShown;

  const query = useQuery(casesQueries.detail(slug, searchQuery));
  const detail = query.data?.data ?? null;
  // ONE VIEW PER OPEN. Drawn from a read made ahead of the open (a hover),
  // which counted none, the open sends its one view; drawn from an ordinary
  // read, it sends nothing (`case-view.ts`).
  const drawn = detail !== null;
  useEffect(() => {
    if (drawn) countOpen(slug, searchTermOf(searchQuery));
  }, [drawn, slug, searchQuery]);
  // Fade the document in only when it arrives AFTER this screen mounted (the
  // skeleton gives way to it). A screen that mounts with the case already in
  // hand draws it at once: the loading boundary drawing a prefetched case,
  // and the page that replaces that boundary a moment later, which would
  // otherwise replay the fade and blink the whole case once (measured on the
  // option 2 prototype, 7 October 2026).
  //
  // A tapped row's heading block already on screen (`case-peek.ts`, drawn by
  // the same `CaseHeader`) stays still, and so does the ask box the frame drew:
  // only the body fades in (`v2-case-arrive-peeked` in case-document.css; Stay,
  // 20 October 2026: "The loading is jumpy").
  const peeked = useCasePeek(slug) !== null;
  const [arrival] = useState(() => (query.isPending ? (peeked ? 'peeked' : 'fade') : 'none'));
  const arrive =
    arrival === 'fade'
      ? 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300'
      : arrival === 'peeked'
        ? 'v2-case-arrive-peeked'
        : '';

  /**
   * NOTHING IS PUBLISHED TO THE HEADER FROM HERE ANY MORE (phase 7).
   *
   * This screen used to put the SHORT title in the bar ("SPDC v Ereba") while
   * the document below it was headed with the full one ("Spdc (nig.) Ltd v
   * Ereba & Anor"): two names for one case, 69px apart, and the reader had no
   * way to know they were the same. The document's masthead is the case's
   * title — it carries the citation, the court, the date and the judges with it
   * — so the bar carries none, and a pushed screen's bar is the back arrow and
   * nothing else. See `PushedTitle` in `v2/shell/pushed-route.ts`.
   */

  // The same shape as the route's loading screen, a tapped row's name
  // included, so the hand-off from the boundary to this wait moves nothing.
  if (query.isPending) return <CaseFallback />;

  if (query.isError) {
    // A 429 is not a failure to load — it is the plan's monthly allowance, and it
    // deserves its own screen with the numbers and the reset date on it.
    const limit = extractViewLimitError(query.error);
    // A case that is not there is not a failed request. Same screen for both
    // told readers to retry something that will never succeed.
    const missing = isNotFoundError(query.error);
    return (
      <div className={CASE_COLUMN}>
        {limit ? (
          <CaseHardLimitState limit={limit} />
        ) : missing ? (
          <CaseNotFoundState />
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

  const outline = buildCaseOutline(detail, role);


  return (
    // With the side chat open (≥xl) this is a row: the reading column centres
    // itself in the remaining space (auto margins in flex), the panel takes a
    // fixed 26rem on the right. Closed, it is exactly the old layout.
    // `overflow-x-clip` so the panel's width reveal can never mint a
    // horizontal scrollbar (clip, not hidden — no scroll container, so the
    // panel's sticky inner box still tracks the shell scroller). `relative`
    // anchors the draft editor's box over the reading.
    <SidePanelHostProvider value={draftHost}>
      <div className="relative flex min-h-full w-full overflow-x-clip">
        {/* The tall column the sticky dock needs: the document is the flow; the
            pill dock is pinned to the bottom edge and floats over the reading.
            `.v2-case-doc` scopes the reading typography (case-document.css).
            `relative` anchors the outline rail beside the column. */}
        {/* A visitor without an account has no chat box at all (Stay, 19 October
            2026, 14:07 UTC: "Remove the chat text area"), so the column keeps
            the reading column's own bottom room that the dock gave it. */}
        <div
          ref={columnRef}
          className={cn(
            'v2-case-doc relative mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pt-5 sm:pt-8',
            !signedIn && 'pb-24',
          )}
        >
          <ReadingProgress />
          <div className={arrive} inert={pageUnder}>
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
            <aside
              inert={pageUnder}
              className="absolute inset-y-0 left-full ml-10 hidden w-44 min-[80rem]:block"
            >
              <div className={cn('sticky top-8', arrive)}>
                <CaseOutline sections={outline} />
              </div>
            </aside>
          ) : null}
          {/* THE composer's dock — on a phone and at xl-floating it is the
              entire chat (one card, three states). It hides only while the
              docked column, chosen at xl, owns the composer. */}
          {signedIn && showDock ? (
            <CaseAskDock
              subject={subject}
              signedIn={signedIn}
              viewerId={userId}
              start={start}
              view={dockOwnsChat ? renderedChat : null}
              panelOpen={chat !== null && dockOwnsChat}
              screen={phone}
              onEngage={() => {
                if (chat === null) openChat('new');
              }}
              onClose={closeChat}
              onDock={() => setDockedPref(true)}
              onOpenChat={switchChatAway}
              arrive={arrival === 'fade'}
            />
          ) : null}
        </div>

        {signedIn && showDocked && renderedChat !== null ? (
          <CaseChatDocked
            chatId={renderedChat}
            closing={chatClosing}
            subject={subject}
            signedIn={signedIn}
            viewerId={userId}
            start={start}
            onClose={closeChat}
            onSwitchChat={switchChatAway}
            onFloat={floatChat}
          />
        ) : null}

        {/* THE DRAFT EDITOR'S BOX, on a computer while a draft is open: the
            reading area from the sidebar's edge to the docked chat's, 0.75rem
            clear of both, of the top bar and of the foot, the chat card's own
            gaps. The rail is 26.75rem (the card and its right gap), so the box
            ends 0.75rem short of it. Sticky like the card, so it stays on the
            screen while the page under it keeps its place. The embedded chat
            draws the editor into it (side-panel-host.tsx). */}
        {editorShown ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 right-[27.5rem] z-20 pl-3">
            <div ref={setDraftBox} className="pointer-events-auto sticky top-3 flex h-[calc(100dvh-5rem)]" />
          </div>
        ) : null}

        {keyboardDebug ? <KeyboardDebugReadout /> : null}
      </div>
    </SidePanelHostProvider>
  );
}
