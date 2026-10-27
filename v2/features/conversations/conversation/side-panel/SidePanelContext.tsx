'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { ConversationSpaceRef } from '@/types/chat';
import { useUrlOverlay } from '@/v2/runtime/use-url-overlay';
import {
  SIDE_PANEL_PARAM,
  parseSidePanelValue,
  sidePanelValue,
  type SidePanelTarget,
} from './side-panel-value';
import type { DraftVersion } from '../draft/draft-versions';

/**
 * SidePanelContext — the chat's one side panel, shared by everything that
 * opens something beside the transcript: a draft Lawexa wrote (the draft
 * editor, Stay 23 October 2026), and the files it lists (the file list in
 * chat, same day). One `?side=` param (side-panel-value.ts), so Back closes
 * it on a phone and moving between targets costs one history entry.
 *
 * It also carries each answer's draft OFFSET (draft-ordinals.ts), so a card
 * inside an answer knows its draft's place without the answer knowing the
 * transcript. And the chat's drafts by group (draft-versions.ts), so a card
 * reads "Version 2" and the panel switches between a draft's versions. The
 * chat hands in that lookup itself: this module is on the case page before
 * its chat opens, and the draft code is not (case-draft-editor.test.ts).
 *
 * CLOSING PLAYS ITS EXIT (the house motion rule: nothing disappears abruptly).
 * `close()` marks the panel closing, and the frame calls `finishClose()` when
 * its exit animation ends, which is when the URL entry is walked back. Back
 * itself closes at once: the browser has already moved.
 *
 * ── WHO OWNS THE PARAM ─────────────────────────────────────────────────────
 * One component owns a URL param (use-url-overlay.ts). On a chat's own route
 * that is `SidePanelProvider`. A page that hosts a chat inside it (the case
 * page, side-panel-host.tsx) owns it itself, because the page lays itself out
 * round the open panel: it calls `useSidePanelUrl` and the embedded chat
 * provides that same state through `SidePanelValueProvider`.
 */

/** The panel's address and its closing state: the part a host page can own. */
export interface SidePanelUrlState {
  target: SidePanelTarget | null;
  closing: boolean;
  open: (target: SidePanelTarget) => void;
  close: () => void;
  finishClose: () => void;
  /** Close with no exit and no walk back: the page goes on to write the URL itself. */
  closeInPlace: () => void;
}

/**
 * Where the panel is drawn on a computer:
 *
 *   beside   in the chat's own row, beside the transcript (a chat's route)
 *   card     a rounded card that fills the box its host gives it (the case
 *            page: the reading area left of the docked chat)
 *
 * Below xl both are the same sheet from the bottom.
 */
export type SidePanelFrame = 'beside' | 'card';

/** Draft `ordinal`'s place among its versions (draft-versions.ts), from the chat that knows its drafts. */
export type DraftVersionLookup = (ordinal: number, key: string) => DraftVersion | null;

const NO_VERSIONS: DraftVersionLookup = () => null;

export interface SidePanelApi extends SidePanelUrlState {
  /** How many drafts come before an answer's own (0 for an answer not in the map). */
  draftOffset: (messageId: string) => number;
  /** Draft `ordinal`'s place among its versions; `null` where the chat keeps no versions (a Radar report). */
  draftVersion: DraftVersionLookup;
  /** The chat's Space, where a draft's Save to folder files it; `null` outside one. */
  space: ConversationSpaceRef | null;
  frame: SidePanelFrame;
}

const SidePanelContext = createContext<SidePanelApi | null>(null);

/** The chat's side panel, or `null` outside a chat (a card drawn elsewhere opens nothing). */
export function useSidePanel(): SidePanelApi | null {
  return useContext(SidePanelContext);
}

/** The `?side=` param as panel state. Call it once per page, in the param's owner. */
export function useSidePanelUrl(): SidePanelUrlState {
  const overlay = useUrlOverlay(SIDE_PANEL_PARAM);
  const target = useMemo(() => parseSidePanelValue(overlay.value), [overlay.value]);
  // The value that started closing, so a new open in the meantime is not closed by it.
  const [closingValue, setClosingValue] = useState<string | null>(null);
  const closing = closingValue !== null && closingValue === overlay.value;

  const { show, close: closeOverlay, closeInPlace: dropOverlay } = overlay;
  const open = useCallback(
    (next: SidePanelTarget) => {
      setClosingValue(null);
      show(sidePanelValue(next));
    },
    [show],
  );
  const close = useCallback(() => setClosingValue(overlay.value), [overlay.value]);
  const finishClose = useCallback(() => {
    setClosingValue(null);
    closeOverlay();
  }, [closeOverlay]);
  const closeInPlace = useCallback(() => {
    setClosingValue(null);
    dropOverlay();
  }, [dropOverlay]);

  return useMemo(
    () => ({ target, closing, open, close, finishClose, closeInPlace }),
    [target, closing, open, close, finishClose, closeInPlace],
  );
}

/** A chat's route: the panel owns its own param and opens beside the transcript. */
export function SidePanelProvider({
  offsets,
  versions,
  space,
  children,
}: {
  offsets: ReadonlyMap<string, number>;
  versions?: DraftVersionLookup;
  space: ConversationSpaceRef | null;
  children: ReactNode;
}) {
  const url = useSidePanelUrl();
  return (
    <SidePanelValueProvider url={url} offsets={offsets} versions={versions} space={space} frame="beside">
      {children}
    </SidePanelValueProvider>
  );
}

/** The panel over state someone already owns: `SidePanelProvider`'s, or a host page's. */
export function SidePanelValueProvider({
  url,
  offsets,
  versions,
  space,
  frame,
  children,
}: {
  url: SidePanelUrlState;
  offsets: ReadonlyMap<string, number>;
  /** The chat's drafts by group; absent where drafts have no versions. */
  versions?: DraftVersionLookup;
  space: ConversationSpaceRef | null;
  frame: SidePanelFrame;
  children: ReactNode;
}) {
  const draftOffset = useCallback((messageId: string) => offsets.get(messageId) ?? 0, [offsets]);
  const api = useMemo<SidePanelApi>(
    () => ({ ...url, draftOffset, draftVersion: versions ?? NO_VERSIONS, space, frame }),
    [url, draftOffset, versions, space, frame],
  );
  return <SidePanelContext.Provider value={api}>{children}</SidePanelContext.Provider>;
}
