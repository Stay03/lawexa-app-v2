'use client';

import { createContext, useContext } from 'react';

import type { SidePanelUrlState } from './SidePanelContext';

/**
 * side-panel-host — a page that hosts an embedded chat and shows that chat's
 * side panel itself (the case page's draft editor, Stay 24 October 2026:
 * "Move to the right").
 *
 * An embedded chat has no room of its own for a panel: it is a 26rem card. The
 * host gives it two things. `url` is the `?side=` state, which the host owns
 * because it lays the page out round the open panel (it docks the chat, makes
 * the reading inert). `element` is where the panel is drawn: the box the host
 * keeps for it on a computer, or the document's body below xl, where the panel
 * is the sheet over everything. The chat draws its panel there through a
 * portal, so the panel keeps the chat's own context (its id, for Save as note).
 *
 * Without a host (the statute page), an embedded chat has no panel and a draft
 * shows its text in place (DraftCard).
 *
 * This file is on the case page's own route, so it holds the context alone:
 * the panel's code comes with the transcript, never before it.
 */
export interface SidePanelHost {
  url: SidePanelUrlState;
  /** Where the panel is drawn; `null` while the host has no box for it. */
  element: HTMLElement | null;
}

const SidePanelHostContext = createContext<SidePanelHost | null>(null);

export const SidePanelHostProvider = SidePanelHostContext.Provider;

/** The page hosting this embedded chat's side panel, or `null`. */
export function useSidePanelHost(): SidePanelHost | null {
  return useContext(SidePanelHostContext);
}
