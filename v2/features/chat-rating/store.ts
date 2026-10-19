import { useSyncExternalStore } from 'react';

import type { ChatRatingTrigger } from '@/types/feedback';
import type { ChatMoment } from './model';

/**
 * The chat rating's page-wide facts, outside React: the latest moment, whether
 * a quiz is under way, and whether this session has asked already. The rows
 * that see a moment (an answer's Copy, a cited case, Ask again) and the quiz
 * card write here; the chat's message box reads it. A page load is a session,
 * so none of this outlives one.
 */

/** The offer on screen: the moment it is about, in the chat it appeared in. */
export interface ActiveOffer extends ChatMoment {
  conversationId: string;
}

let moment: ChatMoment | null = null;
let askedThisSession = false;
let active: ActiveOffer | null = null;
let seq = 0;
const quizzesUnderWay = new Set<string>();
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** A moment happened: the reader copied an answer, opened a cited case, or asked again. */
export function noteChatMoment(trigger: ChatRatingTrigger, messageId: number | null): void {
  if (askedThisSession) return;
  seq += 1;
  moment = { trigger, messageId, awaitsNewAnswer: trigger === 'regenerate', streamed: false, seq };
  emit();
}

/** The latest moment's number; a message box keeps the value it mounted with. */
export function currentMomentSeq(): number {
  return seq;
}

/** The message box saw an answer being written: an Ask again moment may now complete. */
export function noteAnswerStreaming(): void {
  if (moment && moment.awaitsNewAnswer && !moment.streamed) {
    moment = { ...moment, streamed: true };
    emit();
  }
}

/**
 * The banner appears in this chat: it is the session's one ask, and it stays
 * until the reader rates or closes it (`endOffer`). False when the session
 * has asked already or there is no moment to ask about.
 */
export function beginOffer(conversationId: string): boolean {
  if (askedThisSession || moment === null) return false;
  askedThisSession = true;
  active = { ...moment, conversationId };
  moment = null;
  emit();
  return true;
}

/** The reader rated or closed it, or it belongs to a chat no longer open. */
export function endOffer(): void {
  if (active === null) return;
  active = null;
  emit();
}

/** A quiz with an answer picked and not yet submitted is under way; `false` ends it. */
export function setQuizUnderWay(id: string, underWay: boolean): void {
  const had = quizzesUnderWay.has(id);
  if (underWay === had) return;
  if (underWay) quizzesUnderWay.add(id);
  else quizzesUnderWay.delete(id);
  emit();
}

export function useChatMoment(): ChatMoment | null {
  return useSyncExternalStore(subscribe, () => moment, () => null);
}

export function useActiveOffer(): ActiveOffer | null {
  return useSyncExternalStore(subscribe, () => active, () => null);
}

export function useAskedThisSession(): boolean {
  return useSyncExternalStore(subscribe, () => askedThisSession, () => false);
}

export function useQuizUnderWay(): boolean {
  return useSyncExternalStore(subscribe, () => quizzesUnderWay.size > 0, () => false);
}
