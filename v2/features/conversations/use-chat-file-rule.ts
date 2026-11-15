'use client';

import { useMemo } from 'react';
import { queryOptions, useQuery } from '@tanstack/react-query';

import { chatAttachmentRulesApi } from '@/lib/api/chat-attachment-rules';
import { useV2Session } from '@/v2/runtime/session-context';
import { fileRuleFor, readAttachmentRules, type ChatMode, type FileRule } from './attachment-rules';

/** Every mode's file rule from the server, per signed-in person (the document limit is theirs). */
export const chatAttachmentRulesQuery = (userId: number | null) =>
  queryOptions({
    queryKey: ['chat-attachment-rules', userId] as const,
    queryFn: chatAttachmentRulesApi.get,
    staleTime: 10 * 60_000,
  });

/**
 * The file rule a chat box checks against, for its mode: the server's
 * (`GET /chat/attachment-rules`), asked once per person and shared by both
 * boxes. A private chat takes no file until it answers (`fileRuleFor`).
 */
export function useChatFileRule(mode: ChatMode): FileRule {
  const { userId } = useV2Session();
  const rules = useQuery({ ...chatAttachmentRulesQuery(userId), enabled: userId !== null });
  const byMode = useMemo(() => (rules.data ? readAttachmentRules(rules.data.data) : null), [rules.data]);
  return useMemo(() => fileRuleFor(mode, byMode?.[mode] ?? null), [mode, byMode]);
}
