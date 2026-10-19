'use client';

import { createContext, useCallback, useContext, type ReactNode } from 'react';

import type { ChatRatingTrigger } from '@/types/feedback';
import { noteChatMoment } from './store';

/**
 * Which answer a moment is about. An answer row wraps its text and actions in
 * this scope, so a cited case opened from inside the answer reports that
 * answer's saved id with the moment (the server takes the id of an answer,
 * never of a question). Outside any answer (a note's case link, which uses
 * the same link component) nothing is reported: `undefined` is "no answer".
 */
const AnswerScopeContext = createContext<number | null | undefined>(undefined);

export function AnswerScope({ messageId, children }: { messageId: number | null; children: ReactNode }) {
  return <AnswerScopeContext.Provider value={messageId}>{children}</AnswerScopeContext.Provider>;
}

/** Reports a moment about the answer this is inside; outside an answer, nothing. */
export function useNoteAnswerMoment(): (trigger: ChatRatingTrigger) => void {
  const messageId = useContext(AnswerScopeContext);
  return useCallback(
    (trigger: ChatRatingTrigger) => {
      if (messageId !== undefined) noteChatMoment(trigger, messageId);
    },
    [messageId],
  );
}
