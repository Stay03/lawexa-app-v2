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
import type { DraftVersion, KeyedDraft } from '../draft/draft-versions';

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

/** A draft group's newest title (draft-versions.ts), so an edit's card can name the draft it changes. */
export type DraftTitleLookup = (key: string) => string | null;

const NO_TITLES: DraftTitleLookup = () => null;

/** One answer's draft groups in the chat's order (draft-versions.ts chatDraftKeys). */
export type DraftKeysLookup = (messageId: string | null, drafts: readonly KeyedDraft[]) => string[];


/** A kind of thing the panel can hold (`?side=` draft, file, note, machine, agent). */
export type SidePanelKind = SidePanelTarget['kind'];

export interface SidePanelApi extends SidePanelUrlState {
  /**
   * Whether this page's panel shows `kind`: every kind on a chat's page; the
   * admin view's read-only panel shows only what staff may read (drafts,
   * files, agents; never the owner's live machine). A button that opens the
   * panel asks first, so nothing opens a panel the page does not draw.
   */
  shows: (kind: SidePanelKind) => boolean;
  /** How many drafts come before an answer's own (0 for an answer not in the map). */
  draftOffset: (messageId: string) => number;
  /** Draft `ordinal`'s place among its versions; `null` where the chat keeps no versions (a Radar report). */
  draftVersion: DraftVersionLookup;
  /** A draft group's newest title; `null` where the chat keeps no versions. */
  draftTitle: DraftTitleLookup;
  /** One answer's draft groups, judged in the chat's order; `null` where the chat keeps no versions (each draft is then its own key). */
  draftKeys: DraftKeysLookup | null;
  /** The chat's Space, where a draft's Save to folder files it; `null` outside one. */
  space: ConversationSpaceRef | null;
  frame: SidePanelFrame;
}

const SidePanelContext = createContext<SidePanelApi | null>(null);

/** The chat's side panel, or `null` outside a chat (a card drawn elsewhere opens nothing). */
export function useSidePanel(): SidePanelApi | null {
  return useContext(SidePanelContext);
}

/**
 * The `?side=` param as panel state. Call it once per page, in the param's owner.
 *
 * `ssrValue` is the page's own `?side=` (its `searchParams`), read on the server.
 * Without it the server drew no panel while the browser's first render read the
 * URL and drew one, so every `?side=` link opened by reload or a shared link threw
 * away the server's HTML (React's hydration error; 24 November 2026).
 */
export function useSidePanelUrl(ssrValue: string | null = null): SidePanelUrlState {
  const overlay = useUrlOverlay(SIDE_PANEL_PARAM, { ssrValue });
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
  titles,
  keys,
  space,
  initialSide = null,
  children,
}: {
  offsets: ReadonlyMap<string, number>;
  versions?: DraftVersionLookup;
  titles?: DraftTitleLookup;
  keys?: DraftKeysLookup;
  space: ConversationSpaceRef | null;
  /** The page's `?side=`, so the server draws the same panel the browser does (`useSidePanelUrl`). */
  initialSide?: string | null;
  children: ReactNode;
}) {
  const url = useSidePanelUrl(initialSide);
  return (
    <SidePanelValueProvider url={url} offsets={offsets} versions={versions} titles={titles} keys={keys} space={space} frame="beside">
      {children}
    </SidePanelValueProvider>
  );
}

/** The panel over state someone already owns: `SidePanelProvider`'s, or a host page's. */
export function SidePanelValueProvider({
  url,
  offsets,
  versions,
  titles,
  keys,
  space,
  frame,
  kinds,
  children,
}: {
  url: SidePanelUrlState;
  offsets: ReadonlyMap<string, number>;
  /** The chat's drafts by group; absent where drafts have no versions. */
  versions?: DraftVersionLookup;
  /** The chat's draft groups' titles; absent where drafts have no versions. */
  titles?: DraftTitleLookup;
  /** The chat's draft groups by answer; absent where drafts have no versions. */
  keys?: DraftKeysLookup;
  space: ConversationSpaceRef | null;
  frame: SidePanelFrame;
  /** The kinds this page's panel shows; every kind when absent. */
  kinds?: ReadonlySet<SidePanelKind>;
  children: ReactNode;
}) {
  const shows = useCallback((kind: SidePanelKind) => (kinds ? kinds.has(kind) : true), [kinds]);
  const draftOffset = useCallback((messageId: string) => offsets.get(messageId) ?? 0, [offsets]);
  const api = useMemo<SidePanelApi>(
    () => ({ ...url, shows, draftOffset, draftVersion: versions ?? NO_VERSIONS, draftTitle: titles ?? NO_TITLES, draftKeys: keys ?? null, space, frame }),
    [url, shows, draftOffset, versions, titles, keys, space, frame],
  );
  return <SidePanelContext.Provider value={api}>{children}</SidePanelContext.Provider>;
}
