'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { quietPushUrlParams, quietReplaceUrlParams } from '@/v2/runtime/url-params';
import type { JurisdictionChoice } from '@/types/jurisdiction';
import { useStartCaseChat, type CaseChatStart } from './CaseChatCore';
import type { ChatSubject } from './chat-subject';
import { usePanelBreakpoint } from './use-panel-breakpoint';

/** The reader's docked-vs-floating chat preference, remembered per device. */
const DOCK_PREF_KEY = 'v2-case-chat-docked';

/**
 * useDocumentChat — the chat a document page hosts (a case, a statute): which
 * chat is open, how it opens and closes, which presentation shows it, and the
 * one create state every presentation shares. The case page and the statute
 * page both call it (18 October 2026), so the two chats behave alike in every
 * detail below.
 *
 * ── LOCAL STATE IS THE SOURCE OF TRUTH; THE URL IS A MIRROR, WRITTEN QUIETLY ─
 * Two implementations died here; the autopsy is in `url-params.ts`. Short
 * version: on a soft-navigated document page (served through the v2 rewrite
 * proxy), ANY history write the App Router notices dispatches its Next-16
 * restore machinery, whose segment walk trips over the rewritten `[slug]`
 * param and spirals into an endless refetch loop, and those background commits
 * kept resurrecting the closing panel ("closes, pops open, closes again"). The
 * QUIET writes below change the URL without waking the router at all.
 *
 *  - `chat` changes ONLY on user action (open / close / switch / Back);
 *  - state initialises from the URL once, on mount (direct `?chat=` links);
 *  - open quiet-PUSHES the param (Back closes the panel);
 *  - close and in-panel hops quiet-REPLACE it (the panel stays ONE history
 *    entry, so Back closes in one step and never walks internal hops);
 *  - one popstate listener adopts the real URL on Back/Forward.
 *
 * ── PRESENCE HOLDOVER ───────────────────────────────────────────────────────
 * Every chat presentation animates OUT before its unmount (`renderedChat`
 * holds the closing id a shade past the 200ms exit). The render-phase adopt
 * of a new id is the sanctioned adjust-during-render reset.
 *
 * ── ONE PRESENTATION AT A TIME ──────────────────────────────────────────────
 * The dock's full-screen card below xl; the floating card (default) or the
 * docked column (the reader's persisted choice) at xl. A JS decision, not a
 * CSS one: exactly ONE container may mount, or one conversation would run two
 * live controllers.
 *
 * ── THE CREATE STATE, LIFTED ────────────────────────────────────────────────
 * Every presentation shares one submission (a double submit is impossible
 * across surfaces) and the list state's jurisdiction survives presentation
 * swaps. The DRAFT is not here: the one composer owns it, persisted per
 * document (`chatDraftScope`), which is what lets the composer be the same
 * element in every state.
 */
export function useDocumentChat(
  subject: ChatSubject,
  signedIn: boolean,
  {
    holdDocked = false,
  }: {
    /**
     * At xl, show the chat docked whatever the reader's choice: the case
     * page's draft editor opens left of the docked chat, so the chat is docked
     * for as long as the editor is open (CaseScreen).
     */
    holdDocked?: boolean;
  } = {},
) {
  const searchParams = useSearchParams();

  const [chat, setChat] = useState<string | null>(() => searchParams.get('chat'));
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

  const [renderedChat, setRenderedChat] = useState(chat);
  if (chat !== null && chat !== renderedChat) setRenderedChat(chat);
  const chatClosing = chat === null && renderedChat !== null;
  useEffect(() => {
    if (!chatClosing) return;
    // A shade past the 200ms exit animation, whose last frame is held by
    // `fill-mode-forwards` (see the exit-animation note in CaseChatPanel): the
    // unmount happens strictly AFTER the animation lands.
    const timer = window.setTimeout(() => setRenderedChat(null), 240);
    return () => window.clearTimeout(timer);
  }, [chatClosing]);

  const isDesktopPanel = usePanelBreakpoint();
  const [dockedPref, setDocked] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem(DOCK_PREF_KEY) === '1',
  );
  const setDockedPref = useCallback((next: boolean) => {
    setDocked(next);
    try {
      window.localStorage.setItem(DOCK_PREF_KEY, next ? '1' : '0');
    } catch {
      // Preference only: losing it costs a click, never the chat.
    }
  }, []);

  const docked = dockedPref || holdDocked;

  const [jurisdiction, setJurisdiction] = useState<JurisdictionChoice>({ mode: 'auto' });
  const startState = useStartCaseChat(subject, signedIn, switchChat, jurisdiction);
  const start: CaseChatStart = {
    ...startState,
    jurisdiction,
    onJurisdictionChange: setJurisdiction,
  };

  // The DOCK is the whole chat on a phone and at xl-floating: closed pill,
  // new-chat panel and the embedded conversation are three states of ONE card
  // (full screen below xl). Only the docked column, by choice at xl, is a
  // separate presentation.
  const phone = isDesktopPanel === false;
  const desktop = isDesktopPanel === true;
  const dockOwnsChat = phone || (isDesktopPanel === true && !docked);
  const showDocked = renderedChat !== null && isDesktopPanel === true && docked;
  // The dock stays mounted through every state it owns, so the composer
  // element is never remounted across closed ⇄ open: focus survives, and on a
  // phone the tap's own focus is what raises the keyboard.
  const showDock = dockOwnsChat || renderedChat === null;
  // While the phone chat covers the screen the page under it leaves the tab
  // order and the accessibility tree (the shell's bars: see CaseAskDock).
  const pageUnderChat = phone && renderedChat !== null;

  return {
    chat,
    renderedChat,
    chatClosing,
    openChat,
    closeChat,
    switchChat,
    start,
    phone,
    desktop,
    dockOwnsChat,
    showDock,
    showDocked,
    pageUnderChat,
    setDockedPref,
  };
}
