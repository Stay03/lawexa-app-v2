'use client';

import { createContext, useContext, type ReactNode } from 'react';

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

/** True inside a transcript drawn for someone who is not its reader. */
export function useReadOnlyTranscript(): boolean {
  return useContext(ReadOnlyTranscriptContext);
}
