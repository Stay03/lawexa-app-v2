import type { ChatRatingReason, ChatRatingTrigger } from '@/types/feedback';

/**
 * "How is Lawexa doing?" — the chat rating banner (Arthur, 19 October 2026;
 * built on his go at 09:59 UTC).
 *
 * A small banner above a chat's message box asks Poor · Fine · Great after a
 * moment that says something about the answer: the reader copied it, opened a
 * case it cited, or asked again. Poor asks what went wrong. The server decides
 * whether this reader may be asked at all (at most once every 14 days, never a
 * new user: GET /feedback/chat-prompt); this file decides WHEN, in the app:
 *
 *  - only an account (never a guest or a bot);
 *  - never while an answer is being written, and never mid-quiz;
 *  - at most once a session (a page load);
 *  - only after a moment, and after the answer it is about has finished.
 *
 * Shown and closed are both reported (POST /feedback/chat-prompt/seen), so a
 * banner the reader ignores still counts as asked (Arthur, choice 2).
 * Rephrasing is not a trigger (Arthur, choice 4: "Leave out").
 */

export const CHAT_RATING_QUESTION = 'How is Lawexa doing?';

/** Poor's one-tap answers, in Arthur's order. */
export const POOR_REASONS: readonly { key: ChatRatingReason; label: string }[] = [
  { key: 'wrong_citation', label: 'Wrong citation' },
  { key: 'missed_case_or_statute', label: 'Missed a case or statute' },
  { key: 'outdated_law', label: 'Outdated law' },
  { key: 'didnt_answer', label: 'Didn’t answer' },
  { key: 'too_slow', label: 'Too slow' },
  { key: 'something_else', label: 'Something else' },
];

/** The longest "Something else" text, the same cap as a feedback report. */
export const CHAT_RATING_TEXT_MAX = 4500;

/** A moment that may bring the banner up. */
export interface ChatMoment {
  trigger: ChatRatingTrigger;
  /** The answer's saved id, or null while it has none. */
  messageId: number | null;
  /**
   * Ask again starts a new answer: the banner waits until that answer has
   * been written (`streamed` turns true once it starts), not the one before.
   */
  awaitsNewAnswer: boolean;
  streamed: boolean;
  /** Its place in the page's sequence of moments (`noteChatMoment`). */
  seq: number;
}

/** Everything the banner's appearance depends on, read at one moment. */
export interface OfferInputs {
  isAccount: boolean;
  /** The server's answer: true, false, or null while it is not known. */
  eligible: boolean | null;
  askedThisSession: boolean;
  isStreaming: boolean;
  quizInProgress: boolean;
  moment: ChatMoment | null;
  /**
   * The last moment before this chat's message box appeared. Only a later
   * one counts: a moment in a case page's side chat, or in another chat, is
   * not about this one.
   */
  seqAtMount: number;
}

/** Whether the banner appears now. */
export function mayOffer(inputs: OfferInputs): boolean {
  const { isAccount, eligible, askedThisSession, isStreaming, quizInProgress, moment } = inputs;
  if (!isAccount || eligible !== true || askedThisSession) return false;
  if (isStreaming || quizInProgress || moment === null) return false;
  if (moment.seq <= inputs.seqAtMount) return false;
  // Ask again: only once the new answer has started and finished.
  if (moment.awaitsNewAnswer && !moment.streamed) return false;
  return true;
}

/** "Something else" needs words; every other reason is one tap. */
export function reasonReady(reason: ChatRatingReason | null, text: string): boolean {
  if (reason === null) return false;
  if (reason !== 'something_else') return true;
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed.length <= CHAT_RATING_TEXT_MAX;
}
