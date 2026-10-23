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

/**
 * SidePanelContext — the chat's one side panel, shared by everything that
 * opens something beside the transcript: a draft Lawexa wrote (the draft
 * editor, Stay 23 October 2026), and the files it lists (the file list in
 * chat, same day). One `?side=` param (side-panel-value.ts), so Back closes
 * it on a phone and moving between targets costs one history entry.
 *
 * It also carries each answer's draft OFFSET (draft-ordinals.ts), so a card
 * inside an answer knows its draft's place without the answer knowing the
 * transcript.
 *
 * CLOSING PLAYS ITS EXIT (the house motion rule: nothing disappears abruptly).
 * `close()` marks the panel closing, and the frame calls `finishClose()` when
 * its exit animation ends, which is when the URL entry is walked back. Back
 * itself closes at once: the browser has already moved.
 */

export interface SidePanelApi {
  target: SidePanelTarget | null;
  closing: boolean;
  open: (target: SidePanelTarget) => void;
  close: () => void;
  finishClose: () => void;
  /** How many drafts come before an answer's own (0 for an answer not in the map). */
  draftOffset: (messageId: string) => number;
  /** The chat's Space, where a draft's Save to folder files it; `null` outside one. */
  space: ConversationSpaceRef | null;
}

const SidePanelContext = createContext<SidePanelApi | null>(null);

/** The chat's side panel, or `null` outside a chat (a card drawn elsewhere opens nothing). */
export function useSidePanel(): SidePanelApi | null {
  return useContext(SidePanelContext);
}

export function SidePanelProvider({
  offsets,
  space,
  children,
}: {
  offsets: ReadonlyMap<string, number>;
  space: ConversationSpaceRef | null;
  children: ReactNode;
}) {
  const overlay = useUrlOverlay(SIDE_PANEL_PARAM);
  const target = useMemo(() => parseSidePanelValue(overlay.value), [overlay.value]);
  // The value that started closing, so a new open in the meantime is not closed by it.
  const [closingValue, setClosingValue] = useState<string | null>(null);
  const closing = closingValue !== null && closingValue === overlay.value;

  const { show, close: closeOverlay } = overlay;
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
  const draftOffset = useCallback((messageId: string) => offsets.get(messageId) ?? 0, [offsets]);

  const api = useMemo<SidePanelApi>(
    () => ({ target, closing, open, close, finishClose, draftOffset, space }),
    [target, closing, open, close, finishClose, draftOffset, space],
  );

  return <SidePanelContext.Provider value={api}>{children}</SidePanelContext.Provider>;
}
