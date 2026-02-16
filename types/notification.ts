/**
 * Notification type definitions for the notification system API
 */

import type { PaginationMeta, PaginationLinks } from './case';

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
