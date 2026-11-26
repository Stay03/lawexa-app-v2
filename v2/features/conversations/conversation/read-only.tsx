'use client';

import { createContext, useContext, type ReactNode } from 'react';

import { useV2ChatContext } from './chat-context';

/**
 * A transcript drawn for someone who is not its reader: the admin
 * conversation view (thread 085a980c), where staff read another person's chat
 * as that person saw it. Every row that can act (save or dismiss a skill
 * draft, free the machine, answer a prompt card, connect with a lawyer, try a
 * failed turn again) shows what it showed the person but offers nothing to
 * press: pressed here it would act as the staff member, or on the person's
 * data. The chat page never sets it, so its rows are unchanged.
 */
const ReadOnlyTranscriptContext = createContext(false);

export function ReadOnlyTranscript({ children }: { children: ReactNode }) {
  return <ReadOnlyTranscriptContext.Provider value>{children}</ReadOnlyTranscriptContext.Provider>;
}

/**
 * May the reader press a control in the transcript that writes (save, send,
 * stop, cancel, free, connect, ask again)? One rule for every row and card
 * (card e4b12be8, thread 085a980c, 26 November 2026):
 *
 * - false in a transcript drawn for someone who is not its reader (the admin
 *   view, `ReadOnlyTranscript`);
 * - false outside a chat screen (no chat context: nothing to act for);
 * - false for a reader who may not send in this chat (a Space's Viewer, a
 *   shared link: the controller's `canSend`);
 * - true otherwise.
 *
 * A row shows what it shows either way and only withholds the press. The
 * source test (can-act.test.ts) fails a row that writes without asking.
 */
export function useCanAct(): boolean {
  const readOnly = useContext(ReadOnlyTranscriptContext);
  const chat = useV2ChatContext();
  return !readOnly && chat !== null && chat.canSend;
}

/**
 * The narrower question for a control that writes to the reader's OWN
 * account, not to the chat ("Save as my template" on a sent document): a
 * Space's Viewer or a shared-link reader keeps it. False only in a transcript
 * drawn for someone who is not its reader (the admin view), where it would
 * write to the staff member's account (Techlead, 26 November 2026).
 */
export function useCanActForSelf(): boolean {
  return !useContext(ReadOnlyTranscriptContext);
}
