/**
 * Type definitions for admin device intelligence & abuse analysis
 */

import type { PaginationMeta, PaginationLinks } from './case';

// ============================================
// Shared / Reusable
// ============================================

export type DeviceSortBy = 'last_active_at' | 'created_at';

export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot';

export type SharedDeviceGroupBy = 'fingerprint' | 'device_id';

export type DeviceTab = 'devices' | 'shared' | 'ip-clusters';

/** User object returned inside device list items */
export interface DeviceUserBasic {
  uuid: string;
  name: string;
  email: string;
  role: string;
}

/** User object returned inside shared device groups and IP clusters */
export interface DeviceUserInGroup {
  uuid: string;
  name: string;
  email: string | null;
  role: string;
  university: string | null;
  law_school: string | null;
  profession: string | null;
}

// ============================================
// List Devices
// ============================================

export interface DeviceListParams {
  page?: number;
  per_page?: number;
  search?: string;
  country?: string;
  device_type?: DeviceType;
  browser?: string;
  platform?: string;
  'role[]'?: string[];
  date_from?: string;
  date_to?: string;
  sort_by?: DeviceSortBy;
  sort_order?: 'asc' | 'desc';
}

export interface DeviceListItem {
  id: number;
  device_name: string;
  display_name: string;
  device_type: string;
  browser: string | null;
  browser_version: string | null;
  platform: string | null;
  platform_version: string | null;
  ip_address: string | null;
  location: string | null;
  ip_country: string | null;
  ip_country_code: string | null;
  ip_region: string | null;
  ip_city: string | null;
  ip_timezone: string | null;
  fingerprint: string | null;
  device_id: string | null;
  user: DeviceUserBasic | null;
  last_active_at: string | null;
  created_at: string | null;
}

export interface DeviceListResponse {
  success: boolean;
  message: string;
  data: DeviceListItem[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

// ============================================
// Shared Devices
// ============================================

export interface SharedDeviceParams {
  group_by: SharedDeviceGroupBy;
  per_page?: number;
  page?: number;
}

export interface SharedDeviceGroup {
  identifier: string;
  group_by: SharedDeviceGroupBy;
  user_count: number;
  users: DeviceUserInGroup[];
  ip_addresses: string[];
  cross_identifiers: string[];
}

export interface SharedDeviceResponse {
  success: boolean;
  message: string;
  data: SharedDeviceGroup[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

// ============================================
// IP Clusters
// ============================================

export interface IpClusterParams {
  per_page?: number;
  page?: number;
}

export interface IpCluster {
  ip_address: string;
  ip_city: string | null;
  ip_region: string | null;
  ip_country: string | null;
  ip_country_code: string | null;
  user_count: number;
  users: DeviceUserInGroup[];
}

export interface IpClusterResponse {
  success: boolean;
  message: string;
  data: IpCluster[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

// ============================================
// User Device History
// ============================================

export interface UserDeviceHistoryParams {
  per_page?: number;
  page?: number;
}

export interface UserDeviceHistoryItem {
  id: number;
  device_name: string;
  display_name: string;
  device_type: string;
  browser: string | null;
  browser_version: string | null;
  platform: string | null;
  platform_version: string | null;
  ip_address: string | null;
  location: string | null;
  ip_country: string | null;
  ip_country_code: string | null;
  fingerprint: string | null;
  device_id: string | null;
  active_sessions: number;
  last_active_at: string | null;
  created_at: string | null;
}

export interface UserDeviceHistoryResponse {
  success: boolean;
  message: string;
  data: UserDeviceHistoryItem[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}
