/**
 * Notification type definitions for the notification system API
 */

import type { PaginationMeta, PaginationLinks } from './case';
import type { AnalyticsPeriod, AnalyticsPeriodInfo, AnalyticsStatCard } from './admin';

// Single notification resource
export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  action_url: string | null;
  icon: string | null;
  read_at: string | null;
  created_at: string;
}

// GET /api/notifications/{id} response
export interface ShowNotificationResponse {
  data: Notification;
  message: string;
}

// GET /api/notifications response
export interface NotificationListResponse {
  success: boolean;
  message: string;
  data: Notification[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

// GET /api/notifications/unread-count response
export interface UnreadCountResponse {
  success: boolean;
  message: string;
  data: { unread_count: number };
}

// POST /api/notifications/{id}/read response
export interface MarkReadResponse {
  success: boolean;
  message: string;
  data: null;
}

// POST /api/notifications/read-all response
export interface MarkAllReadResponse {
  success: boolean;
  message: string;
  data: { marked_count: number };
}

// DELETE /api/notifications/{id} response
export interface DeleteNotificationResponse {
  success: boolean;
  message: string;
}

// Query params for GET /api/notifications
export interface NotificationListParams {
  read?: 'read' | 'unread';
  sort?: 'created_at' | 'read_at';
  direction?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

// Admin broadcast targeting
export type BroadcastRole = 'user' | 'researcher' | 'admin' | 'superadmin';

// POST /api/admin/notifications/broadcast request payload
export interface BroadcastNotificationData {
  title: string;
  message: string;
  action_url?: string;
  icon?: string;
  user_id?: number;
  user_ids?: number[];
  role?: BroadcastRole;
  broadcast_to_all?: boolean;
}

// POST /api/admin/notifications/broadcast response
export interface BroadcastResponse {
  success: boolean;
  message: string;
  data: { recipients_count: number };
}

// ============================================
// Admin Broadcast Management Types
// ============================================

// Broadcast target type
export type BroadcastTargetType = 'user' | 'users' | 'role' | 'all';

// Broadcast resource (admin list/detail)
export interface Broadcast {
  id: string;
  title: string;
  message: string;
  action_url: string | null;
  icon: string | null;
  target_type: BroadcastTargetType;
  target_criteria: Record<string, unknown> | null;
  recipients_count: number;
  read_count: number;
  unread_count: number;
  admin: { uuid: string; name: string };
  created_at: string;
}

// Broadcast recipient resource
export interface BroadcastRecipient {
  notification_id: string;
  user: { uuid: string; name: string; email: string; role: string };
  read_at: string | null;
  created_at: string;
}

// GET /api/admin/notifications query params
export interface BroadcastListParams {
  sort?: 'created_at' | 'recipients_count' | 'title';
  direction?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

// GET /api/admin/notifications response
export interface BroadcastListResponse {
  success: boolean;
  message: string;
  data: Broadcast[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

// GET /api/admin/notifications/{uuid} response
export interface BroadcastDetailResponse {
  success: boolean;
  message: string;
  data: Broadcast;
}

// GET /api/admin/notifications/{uuid}/recipients query params
export interface BroadcastRecipientsParams {
  per_page?: number;
  page?: number;
}

// GET /api/admin/notifications/{uuid}/recipients response
export interface BroadcastRecipientsResponse {
  success: boolean;
  message: string;
  data: BroadcastRecipient[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

// ============================================
// Notification Analytics Types
// ============================================

// GET /api/admin/notifications/analytics query params
export interface NotificationAnalyticsParams {
  period?: AnalyticsPeriod;
  start_date?: string;
  end_date?: string;
}

// Stat cards
export interface NotificationAnalyticsStatCards {
  total_broadcasts: AnalyticsStatCard;
  total_notifications_sent: AnalyticsStatCard;
  read_rate: AnalyticsStatCard;
  avg_recipients_per_broadcast: AnalyticsStatCard;
}

// Chart data points
export interface BroadcastsOverTimePoint {
  date: string;
  broadcasts: number;
  notifications_sent: number;
}

export interface ReadVsUnreadPoint {
  date: string;
  read: number;
  unread: number;
}

export interface TargetTypeDistributionPoint {
  target_type: string;
  count: number;
  percentage: number;
}

// Charts
export interface NotificationAnalyticsCharts {
  broadcasts_over_time: BroadcastsOverTimePoint[];
  read_vs_unread: ReadVsUnreadPoint[];
  target_type_distribution: TargetTypeDistributionPoint[];
}

// Table rows
export interface RecentBroadcastRow {
  uuid: string;
  title: string;
  target_type: string;
  admin_name: string;
  recipients_count: number;
  read_count: number;
  unread_count: number;
  created_at: string;
}

export interface TopAdminRow {
  uuid: string;
  name: string;
  broadcasts_count: number;
}

// Tables
export interface NotificationAnalyticsTables {
  recent_broadcasts: RecentBroadcastRow[];
  top_admins_by_broadcasts: TopAdminRow[];
}

// Full analytics data
export interface NotificationAnalyticsData {
  period: AnalyticsPeriodInfo;
  stat_cards: NotificationAnalyticsStatCards;
  charts: NotificationAnalyticsCharts;
  tables: NotificationAnalyticsTables;
}

// GET /api/admin/notifications/analytics response
export interface NotificationAnalyticsResponse {
  success: boolean;
  message: string;
  data: NotificationAnalyticsData;
}
