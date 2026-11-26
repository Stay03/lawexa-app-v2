'use client';

import { createContext, useContext } from 'react';

import { apiClient } from '@/lib/api/client';
import { recordingsApi } from '@/lib/api/recordings';
import { skillDraftsApi } from '@/lib/api/skill-drafts';

/**
 * Where a card reads an item the chat holds that belongs to its owner: a quiz
 * a tool is making, a recording made in the chat, a skill draft the chat
 * proposed. The owner's chat page reads the owner's routes. The admin
 * conversation view (Stay, thread 085a980c, 26 November 2026: "make sure
 * other stuff are like for like") reads the same shapes through admin routes
 * that answer only for an item that chat holds and record nothing (Backend
 * cd4eaeef): the owner's routes answer staff 404.
 */
export interface HeldItemsSource {
  /** `GET /quiz-jobs/{uuid}`'s job, or `null`. */
  quizJob: (uuid: string) => Promise<unknown>;
  recording: typeof recordingsApi.get;
  skillDraft: typeof skillDraftsApi.get;
}

/** A quiz job's answer: `{ data: { job } }`, the job or `null`. */
export const jobOf = (body: { data?: { job?: unknown } } | undefined): unknown => body?.data?.job ?? null;

export const OWNER_HELD_ITEMS: HeldItemsSource = {
  quizJob: async (uuid) =>
    jobOf((await apiClient.get<{ data?: { job?: unknown } }>(`/quiz-jobs/${encodeURIComponent(uuid)}`)).data),
  recording: recordingsApi.get,
  skillDraft: skillDraftsApi.get,
};

const HeldItemsSourceContext = createContext<HeldItemsSource>(OWNER_HELD_ITEMS);

export const HeldItemsSourceProvider = HeldItemsSourceContext.Provider;

export function useHeldItemsSource(): HeldItemsSource {
  return useContext(HeldItemsSourceContext);
}
