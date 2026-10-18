import { queryOptions } from '@tanstack/react-query';

import { chatApi } from '@/lib/api/chat';
import { GC_TIMES, STALE_TIMES } from '@/v2/runtime/query';
import { statutesQueries } from '@/v2/features/statutes/queries';
import { casesQueries } from '../queries';

/**
 * chat-subject — WHAT a document chat is about: a case or a statute (Stay,
 * 18 October 2026, 01:31 UTC: "Ask about this statute", the case chat on the
 * statute page; one box, the whole statute, no section menu).
 *
 * The case chat (`CaseChatCore`, `CaseAsk`, `CaseChatPanel`) is the one chat
 * both pages mount. Everything in it that names its document comes from here,
 * so the two can never drift: the reference a new chat starts with, the
 * reader's earlier chats about it, its starter prompts, its words, and the key
 * its unsent draft is kept under.
 */

export type ChatSubjectKind = 'case' | 'statute';

export interface ChatSubject {
  kind: ChatSubjectKind;
  /** The document's slug: the chat's reference id, the draft's key. */
  slug: string;
}

/** The document's word in the chat's labels ("Ask about this case"). */
export const CHAT_SUBJECT_NOUN: Readonly<Record<ChatSubjectKind, string>> = {
  case: 'case',
  statute: 'statute',
};

/** The "Start with" chips, per kind. Each stages its text into the composer. */
export const CHAT_SUBJECT_PROMPTS: Readonly<Record<ChatSubjectKind, readonly string[]>> = {
  case: [
    'Explain this case in plain language',
    'What is the ratio decidendi?',
    'How has this case been treated since?',
  ],
  // Section questions go in the same box ("What does section 2 require?"):
  // the model reads the statute it was started with (Arthur, 18 October 2026).
  statute: [
    'Explain this statute in plain language',
    'What are its key sections?',
    'Which cases have applied it?',
  ],
};

/**
 * The key the one composer keeps this document's unsent draft under. The
 * case's is the key it always had (`case:{slug}`), so a draft written before
 * the statute chat existed is still there.
 */
export function chatDraftScope(subject: ChatSubject): string {
  return `${subject.kind}:${subject.slug}`;
}

/** Each kind's query namespace: a document's chats live under its feature. */
const NAMESPACE: Readonly<Record<ChatSubjectKind, readonly string[]>> = {
  case: casesQueries.all,
  statute: statutesQueries.all,
};

/** What a new chat about this document dirties: its earlier-chats list. */
export function subjectConversationsKey(subject: ChatSubject): readonly unknown[] {
  return [...NAMESPACE[subject.kind], 'conversations', subject.slug];
}

/**
 * The reader's OWN chats about this document (`GET /cases/{slug}/conversations`
 * or `GET /statutes/{slug}/conversations`, owner-scoped), newest message first:
 * the chat's "Pick up where you left off", so a follow-up a week later resumes
 * a thread rather than starting a fresh one. A case's key is the one it always
 * had (`['cases', 'conversations', slug, { viewerId }]`).
 *
 * `standard` tier and NOT keyed under a feature's `lists()`: this is
 * conversation data that happens to be indexed by a document, and a list
 * invalidation has no business dropping it. Asking a new question about the
 * document invalidates it explicitly (`subjectConversationsKey`).
 */
export function subjectConversationsQuery(subject: ChatSubject, viewerId: number | null) {
  return queryOptions({
    queryKey: [...subjectConversationsKey(subject), { viewerId }],
    queryFn: () =>
      chatApi.listContentConversations(subject.kind, subject.slug, {
        per_page: 5,
        // Newest message first, as every chat list (backend 6f776f0).
        sort_by: 'last_message_at',
        sort_order: 'desc',
      }),
    staleTime: STALE_TIMES.standard,
    gcTime: GC_TIMES.list,
  });
}
