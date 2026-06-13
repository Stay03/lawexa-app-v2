import type { PaginationMeta, PaginationLinks } from './case';
import type { IBlockedReason } from './message-pack';

export type RadarStatus = 'active' | 'paused' | 'archived';
export type ScanStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped_no_balance';
export type ScanTrigger = 'schedule' | 'manual';
export type ScanWorkflowStatus = 'active' | 'complete' | 'archive';
export type RadarChannelType = 'in_app' | 'email';
export type RadarEntityType = 'case' | 'statute' | 'court' | 'judge' | 'note';
export type ReportSourceType =
  | 'web_page'
  | 'other'
  | 'case'
  | 'statute'
  | 'amendment'
  | 'note';

export interface RadarJurisdiction {
  id: number;
  name: string;
  code: string;
  slug: string;
}

export interface RadarSource {
  url: string;
  label: string | null;
}

export interface RadarEntity {
  entity_type: RadarEntityType;
  entity_id: number;
  label?: string | null;
}

export interface NotificationChannel {
  uuid: string;
  type: RadarChannelType;
  // null = the user's account email (the only option in v1).
  destination: string | null;
  active: boolean;
  created_at?: string;
}

export interface RadarListItem {
  uuid: string;
  name: string;
  description: string | null;
  instructions: string | null;
  schedule_cron: string;
  timezone: string;
  status: RadarStatus;
  last_scan_at: string | null;
  // Populated even while paused (the time the schedule would fire) — suppress in UI.
  next_scan_at: string | null;
  unread_reports_count: number;
  created_at: string;
  updated_at: string;
}

export interface Radar extends RadarListItem {
  jurisdictions: RadarJurisdiction[];
  topics: string[];
  keywords: string[];
  sources: RadarSource[];
  entities: RadarEntity[];
  channels: NotificationChannel[];
  conversation_uuid: string;
}

export interface RadarScan {
  uuid: string;
  status: ScanStatus;
  triggered_by: ScanTrigger;
  has_findings: boolean;
  title: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  error: string | null;
  workflow_status: ScanWorkflowStatus;
  read_at: string | null;
  priority: boolean;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportSource {
  id: number;
  url: string | null;
  domain: string | null;
  title: string | null;
  position: number;
  source_type: ReportSourceType;
  source_id: number | null;
}

export interface RadarScanDetail extends RadarScan {
  // Markdown; ends with a "## Sources" section mirroring the structured list.
  report: string | null;
  sources: ReportSource[];
}

export interface RadarSourceInput {
  url: string;
  label?: string;
}

export interface RadarEntityInput {
  entity_type: RadarEntityType;
  entity_id: number;
}

// Entity-picker option: a watchable record resolved from search, with display labels.
export interface RadarEntityOption extends RadarEntityInput {
  label: string;
  sublabel?: string;
}

export interface CreateRadarPayload {
  // Omitted when blank — the backend sets an instant fallback name and
  // upgrades it asynchronously via the name-generation job.
  name?: string;
  schedule_cron: string;
  timezone?: string;
  description?: string;
  instructions?: string;
  jurisdictions?: string[];
  topics?: string[];
  keywords?: string[];
  sources?: RadarSourceInput[];
  entities?: RadarEntityInput[];
  channels?: RadarChannelType[];
  first_scan?: boolean;
}

export type UpdateRadarPayload = Partial<CreateRadarPayload>;

export interface TriageScanPayload {
  read?: boolean;
  workflow_status?: ScanWorkflowStatus;
  priority?: boolean;
}

export interface RadarListParams {
  status?: RadarStatus;
  per_page?: number;
  page?: number;
}

export interface RadarScanListParams {
  status?: ScanStatus;
  workflow_status?: ScanWorkflowStatus;
  unread?: boolean;
  per_page?: number;
  page?: number;
}

export interface RadarListResponse {
  success: boolean;
  message: string;
  data: RadarListItem[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

export interface RadarDetailResponse {
  success: boolean;
  message: string;
  data: Radar;
}

export interface FirstScanResult {
  dispatched: boolean;
  block_reason: IBlockedReason | null;
}

export interface CreateRadarResponse {
  success: boolean;
  message: string;
  data: {
    radar: Radar;
    first_scan: FirstScanResult;
  };
}

export interface RadarScanListResponse {
  success: boolean;
  message: string;
  data: RadarScan[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

export interface RadarScanDetailResponse {
  success: boolean;
  message: string;
  data: RadarScanDetail;
}

export interface RadarScanResponse {
  success: boolean;
  message: string;
  data: RadarScan;
}

export interface NotificationChannelListResponse {
  success: boolean;
  message: string;
  data: NotificationChannel[];
}

export interface NotificationChannelResponse {
  success: boolean;
  message: string;
  data: NotificationChannel;
}
