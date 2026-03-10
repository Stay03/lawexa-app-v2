'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import type {
  AdminConversationsParams,
  IAdminUserListParams,
  AdminUserConversationsParams,
  AdminUserTokenUsageParams,
  ConversationAnalyticsParams,
  UserAnalyticsParams,
  ViewAnalyticsParams,
  SubscriptionAnalyticsParams,
  AdminSubscriptionsParams,
  AdminSubscribersParams,
  AdminMessagePacksParams,
  MessagePackAnalyticsParams,
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
  usersList: (params: IAdminUserListParams) =>
    [...adminKeys.users(), 'list', params] as const,
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
  subscriptionAnalytics: (params: SubscriptionAnalyticsParams) =>
    [...adminKeys.all, 'subscriptions', 'analytics', params] as const,
  subscriptions: () => [...adminKeys.all, 'subscriptions'] as const,
  subscriptionsList: (params: AdminSubscriptionsParams) =>
    [...adminKeys.subscriptions(), 'list', params] as const,
  subscriptionDetail: (id: number) =>
    [...adminKeys.subscriptions(), 'detail', id] as const,
  subscribers: () => [...adminKeys.all, 'subscribers'] as const,
  subscribersList: (params: AdminSubscribersParams) =>
    [...adminKeys.subscribers(), 'list', params] as const,
  messagePacks: () => [...adminKeys.all, 'message-packs'] as const,
  messagePacksList: (params: AdminMessagePacksParams) =>
    [...adminKeys.messagePacks(), 'list', params] as const,
  messagePackDetail: (id: number) =>
    [...adminKeys.messagePacks(), 'detail', id] as const,
  messagePackAnalytics: (params: MessagePackAnalyticsParams) =>
    [...adminKeys.messagePacks(), 'analytics', params] as const,
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
 * Hook for fetching admin users list with pagination, filtering, sorting
 */
export function useAdminUsers(params: IAdminUserListParams = {}) {
  return useQuery({
    queryKey: adminKeys.usersList(params),
    queryFn: () => adminApi.getUsers(params),
    staleTime: 30 * 1000,
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

/**
 * Hook for fetching subscription analytics data
 */
export function useSubscriptionAnalytics(
  params: SubscriptionAnalyticsParams = {}
) {
  return useQuery({
    queryKey: adminKeys.subscriptionAnalytics(params),
    queryFn: () => adminApi.getSubscriptionAnalytics(params),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook for fetching admin subscriptions list with pagination, filtering, sorting
 */
export function useAdminSubscriptions(params: AdminSubscriptionsParams = {}) {
  return useQuery({
    queryKey: adminKeys.subscriptionsList(params),
    queryFn: () => adminApi.getAdminSubscriptions(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for fetching a single subscription with detail and invoices
 */
export function useAdminSubscription(id: number) {
  return useQuery({
    queryKey: adminKeys.subscriptionDetail(id),
    queryFn: () => adminApi.getAdminSubscription(id),
    enabled: id > 0,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for fetching admin subscribers list with pagination, filtering, sorting
 */
export function useAdminSubscribers(params: AdminSubscribersParams = {}) {
  return useQuery({
    queryKey: adminKeys.subscribersList(params),
    queryFn: () => adminApi.getAdminSubscribers(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for fetching admin message packs list with pagination, filtering, sorting
 */
export function useAdminMessagePacks(params: AdminMessagePacksParams = {}) {
  return useQuery({
    queryKey: adminKeys.messagePacksList(params),
    queryFn: () => adminApi.getAdminMessagePacks(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for fetching a single message pack with full details
 */
export function useAdminMessagePack(id: number) {
  return useQuery({
    queryKey: adminKeys.messagePackDetail(id),
    queryFn: () => adminApi.getAdminMessagePack(id),
    enabled: id > 0,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for fetching message pack analytics data
 */
export function useMessagePackAnalytics(params: MessagePackAnalyticsParams = {}) {
  return useQuery({
    queryKey: adminKeys.messagePackAnalytics(params),
    queryFn: () => adminApi.getMessagePackAnalytics(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for cancelling an admin subscription
 * Invalidates subscription and subscriber caches on success
 */
export function useCancelAdminSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApi.cancelAdminSubscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.subscriptions() });
      queryClient.invalidateQueries({ queryKey: adminKeys.subscribers() });
    },
  });
}

/**
 * Hook for reactivating a cancelled admin subscription
 * Invalidates subscription and subscriber caches on success
 */
export function useReactivateAdminSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApi.reactivateAdminSubscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.subscriptions() });
      queryClient.invalidateQueries({ queryKey: adminKeys.subscribers() });
    },
  });
}
