'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import type {
  AdminConversationsParams,
  AdminUserConversationsParams,
  AdminUserTokenUsageParams,
  ConversationAnalyticsParams,
  UserAnalyticsParams,
  ViewAnalyticsParams,
} from '@/types/admin';

// Query key factory for organized caching
export const adminKeys = {
  all: ['admin'] as const,
  conversations: () => [...adminKeys.all, 'conversations'] as const,
  conversationsList: (params: AdminConversationsParams) =>
    [...adminKeys.conversations(), 'list', params] as const,
  conversationDetail: (uuid: string) =>
    [...adminKeys.conversations(), 'detail', uuid] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  userDetail: (uuid: string) => [...adminKeys.users(), 'detail', uuid] as const,
  userConversations: (uuid: string, params: AdminUserConversationsParams) =>
    [...adminKeys.users(), uuid, 'conversations', params] as const,
  userTokenUsage: (uuid: string, params: AdminUserTokenUsageParams) =>
    [...adminKeys.users(), uuid, 'token-usage', params] as const,
  conversationAnalytics: (params: ConversationAnalyticsParams) =>
    [...adminKeys.conversations(), 'analytics', params] as const,
  userAnalytics: (params: UserAnalyticsParams) =>
    [...adminKeys.users(), 'analytics', params] as const,
  viewAnalytics: (params: ViewAnalyticsParams) =>
    [...adminKeys.all, 'views', 'analytics', params] as const,
};

/**
 * Hook for fetching admin conversations list with pagination, filtering, sorting
 */
export function useAdminConversations(params: AdminConversationsParams = {}) {
  return useQuery({
    queryKey: adminKeys.conversationsList(params),
    queryFn: () => adminApi.getConversations(params),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook for fetching a single conversation with all messages
 */
export function useAdminConversation(uuid: string) {
  return useQuery({
    queryKey: adminKeys.conversationDetail(uuid),
    queryFn: () => adminApi.getConversation(uuid),
    enabled: !!uuid,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook for fetching user details
 */
export function useAdminUser(uuid: string) {
  return useQuery({
    queryKey: adminKeys.userDetail(uuid),
    queryFn: () => adminApi.getUser(uuid),
    enabled: !!uuid,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook for fetching a user's conversations
 */
export function useAdminUserConversations(
  uuid: string,
  params: AdminUserConversationsParams = {}
) {
  return useQuery({
    queryKey: adminKeys.userConversations(uuid, params),
    queryFn: () => adminApi.getUserConversations(uuid, params),
    enabled: !!uuid,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook for fetching user token usage statistics
 */
export function useAdminUserTokenUsage(
  uuid: string,
  params: AdminUserTokenUsageParams = {}
) {
  return useQuery({
    queryKey: adminKeys.userTokenUsage(uuid, params),
    queryFn: () => adminApi.getUserTokenUsage(uuid, params),
    enabled: !!uuid,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook for fetching conversation analytics data
 */
export function useConversationAnalytics(
  params: ConversationAnalyticsParams = {}
) {
  return useQuery({
    queryKey: adminKeys.conversationAnalytics(params),
    queryFn: () => adminApi.getConversationAnalytics(params),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook for fetching user analytics data
 */
export function useUserAnalytics(params: UserAnalyticsParams = {}) {
  return useQuery({
    queryKey: adminKeys.userAnalytics(params),
    queryFn: () => adminApi.getUserAnalytics(params),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook for fetching view analytics data
 */
export function useViewAnalytics(params: ViewAnalyticsParams = {}) {
  return useQuery({
    queryKey: adminKeys.viewAnalytics(params),
    queryFn: () => adminApi.getViewAnalytics(params),
    staleTime: 30 * 1000, // 30 seconds
  });
}
