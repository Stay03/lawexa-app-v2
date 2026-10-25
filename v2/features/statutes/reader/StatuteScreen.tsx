'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type FocusEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { useV2Session } from '@/v2/runtime/session-context';
import { CaseAskDock } from '@/v2/features/cases/detail/CaseAsk';
import { useIdlePreloadCaseChat } from '@/v2/features/cases/detail/CaseChatCore';
import { CaseChatDocked } from '@/v2/features/cases/detail/CaseChatPanel';
import { CaseChatHost } from '@/v2/features/cases/detail/case-chat-host';
import type { ChatSubject } from '@/v2/features/cases/detail/chat-subject';
import { useDocumentChat } from '@/v2/features/cases/detail/use-document-chat';
import {
  DocumentLinkContext,
  type DocumentLinkHost,
} from '@/v2/features/conversations/conversation/markdown/document-link-context';
import { statutesQueries } from '../queries';
import { useStatutePeek } from '../statute-peek';
import { StatuteFallback } from './StatuteFallback';
import { StatuteDocument, type StatuteLinkHandlers, type StatuteLinkPart } from './StatuteDocument';
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
import { useGuestPassFailed } from '@/v2/runtime/guest-pass';
import { isAccountRole } from '@/v2/runtime/account';

/** Focus that lands in the text under the phone chat goes back to the chat. */
function returnFocusToChat(event: FocusEvent<HTMLElement>) {
  event.currentTarget.parentElement
    ?.querySelector<HTMLElement>('[aria-modal="true"]')
    ?.focus({ preventScroll: true });
}

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
 *
 * ASK ABOUT THIS STATUTE (Stay, 18 October 2026, 01:31 UTC). The case page's
 * chat, the same in every part (`useDocumentChat`, `CaseAskDock`,
 * `CaseChatDocked`), about the statute: one box for the whole Act, and a
 * section question goes in the same box ("What does section 2 require?"; the
 * model reads the statute it was started with, Arthur, 07:20 UTC). Statutes
 * are free, so the box is there for every signed-in reader. The box rests at
 * the column's end, sticky over the reading. Contents is a button in the bar
 * (`StatuteDocument`), so nothing else floats over the text.
 */
export function StatuteScreen(props: { slug: string; provision: string | null }) {
  return (
    // The chat reads `?chat=` (`useSearchParams`), which needs a boundary; the
    // fallback is the route's own loading shape.
    <Suspense fallback={<StatuteFallback />}>
      <StatuteBody {...props} />
    </Suspense>
  );
}

function StatuteBody({
  slug,
  provision,
}: {
  slug: string;
  provision: string | null;
}) {
  const { signedIn, userId, role } = useV2Session();
  // The chat belongs to an account; a guest pass reads the statute and meets
  // the chat as a visitor (v2/runtime/account.ts).
  const hasAccount = signedIn && isAccountRole(role);
  // A visitor who is not signed in gets a guest pass in a moment
  // (guest-pass.tsx); until then this is a load, not a sign-in wall.
  const guestPassFailed = useGuestPassFailed();

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

  // The chat this page hosts, the case page's own (`useDocumentChat`).
  const subject = useMemo<ChatSubject>(() => ({ kind: 'statute', slug }), [slug]);
  const {
    chat,
    renderedChat,
    chatClosing,
    openChat,
    closeChat,
    switchChat,
    start,
    phone,
    dockOwnsChat,
    showDock,
    showDocked,
    pageUnderChat,
    setDockedPref,
  } = useDocumentChat(subject, hasAccount);
  // The chat's code arrives while the page is idle, so the tap does not wait for it.
  useIdlePreloadCaseChat(hasAccount);

  // THE CHAT'S LINKS TO THIS STATUTE LAND IN PLACE (Stay, 18 October 2026,
  // 14:32 UTC), and their badge previews the part (Arthur, 15:06 UTC). The
  // document registers its landing and its preview here and the chat's links
  // reach them through `DocumentLinkContext`; on a phone the full-screen chat
  // closes first so the part shows, at xl the chat stays beside the page.
  const linkHandlersRef = useRef<StatuteLinkHandlers | null>(null);
  const registerLinkHandlers = useCallback((handlers: StatuteLinkHandlers | null) => {
    linkHandlersRef.current = handlers;
  }, []);
  const statuteTitle = detail?.title ?? '';
  // ON A PHONE THE JUMP LANDS TWICE. The full-screen chat locks the page's
  // scroller while it is open and, as it unmounts (`CaseAsk`, the holdover a
  // shade past the close), puts the page back where the reader left it, which
  // undid the jump (the film, 18 October 2026: "Go to section 18" left the page
  // at its top). So the part is held here and landed again once the chat has
  // gone; this effect runs after the lock's cleanup in that same commit.
  const pendingJumpRef = useRef<StatuteLinkPart | null>(null);
  const chatShown = renderedChat !== null;
  useEffect(() => {
    if (chatShown) return;
    const pending = pendingJumpRef.current;
    pendingJumpRef.current = null;
    if (pending) linkHandlersRef.current?.jump(pending);
  }, [chatShown]);
  const linkHost = useMemo<DocumentLinkHost>(
    () => ({
      statuteSlug: slug,
      statuteTitle,
      jump: (target) => {
        const landed = linkHandlersRef.current?.jump(target) ?? false;
        if (landed && phone && chatShown) pendingJumpRef.current = target;
        return landed;
      },
      peek: (target) => linkHandlersRef.current?.peek(target) ?? null,
      beforeJump: phone ? closeChat : undefined,
    }),
    [slug, statuteTitle, phone, chatShown, closeChat],
  );

  if (!signedIn && !guestPassFailed) return <StatuteFallback />;
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
      <DocumentLinkContext.Provider value={linkHost}>
        {/* The chat's middle is rendered once here and shown by whichever frame
            is up, floating or docked (case-chat-host.tsx, the case page's). */}
        <CaseChatHost
          view={hasAccount ? renderedChat : null}
          subject={subject}
          signedIn={hasAccount}
          viewerId={userId}
          onOpenChat={switchChat}
          onClose={closeChat}
        >
            {/* With the docked chat open (≥xl) this is a row: the reading column
                centres in the remaining space, the panel takes 26rem on the right
                (the CaseScreen layout). `overflow-x-clip` so the panel's width reveal
                never mints a horizontal scrollbar. */}
            <div className="flex min-h-full w-full overflow-x-clip">
              <div className="v2-statute-doc relative mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pt-5 sm:pt-8">
                {/* UNDER THE PHONE CHAT THE TEXT LEAVES THE SCREEN READER AND
                    THE TAB ORDER, BUT STAYS PAINTED (18 October 2026). The open
                    chat sets the root's background (CaseAsk), and WebKit repaints
                    a long statute that is inert or hidden very slowly when that
                    colour changes: 45 to 50 s on the ACJL's 1194 parts, a frozen
                    iPhone, on the open with `inert` and on the close with
                    `visibility: hidden`. Painted, the same change costs 0.7 s.
                    `aria-hidden` takes the text out of the accessibility tree, and
                    focus that lands in it (Tab, Shift+Tab past the chat) goes back
                    to the chat, which is a modal dialog in the same column. The
                    case page, whose judgment is one block, keeps `inert`. */}
                <article
                  aria-label={detail.title}
                  aria-hidden={pageUnderChat || undefined}
                  onFocusCapture={pageUnderChat ? returnFocusToChat : undefined}
                  className={cn(
                    'flex flex-col gap-8 pb-8',
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
                  <StatuteDocument
                    key={slug}
                    slug={slug}
                    provision={provision}
                    chatDocked={showDocked}
                    pauseMount={pageUnderChat}
                    registerLinkHandlers={registerLinkHandlers}
                  />
                </article>
                {/* THE composer's dock: on a phone and at xl-floating it is the whole
                    chat (one card, three states); it steps aside only while the
                    docked column, chosen at xl, owns the composer. */}
                {showDock ? (
                  <CaseAskDock
                    subject={subject}
                    signedIn={hasAccount}
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
                    onOpenChat={switchChat}
                  />
                ) : null}
              </div>

              {showDocked && renderedChat !== null ? (
                <CaseChatDocked
                  chatId={renderedChat}
                  closing={chatClosing}
                  subject={subject}
                  signedIn={hasAccount}
                  viewerId={userId}
                  start={start}
                  onClose={closeChat}
                  onSwitchChat={switchChat}
                  onFloat={() => setDockedPref(false)}
                />
              ) : null}
            </div>
        </CaseChatHost>
      </DocumentLinkContext.Provider>
    </StatuteNotesProvider>
  );
}
