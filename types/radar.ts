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
  /** Always `[]` for a Space Radar: its reports go to the Space's members. */
  channels: NotificationChannel[];
  conversation_uuid: string;
  /**
   * ── A RADAR IN A SPACE (Radar in Spaces, plan 5.2; Stay's go 26 Oct 2026) ──
   * Present on a Space Radar's reads only; a personal Radar's read leaves them
   * out, so every one is optional and a personal screen never reads them.
   * `unread_reports_count` on a Space Radar is the READER'S own.
   */
  space?: RadarSpaceStub | null;
  creator?: RadarPerson | null;
  /** The creator, the Space owner or a Space admin: edit, pause, archive. */
  can_manage?: boolean;
  /** May mark this Radar's reports read, priority, complete or archived. */
  can_triage?: boolean;
  schedule_state?: RadarScheduleState;
}

export interface RadarSpaceStub {
  uuid: string;
  name: string;
}

/** A member as a Space Radar names them: the slim user, never an email. */
export interface RadarPerson {
  uuid: string;
  name: string;
  avatar_url: string | null;
}

/** `no_balance`: the Space owner, who pays for the scans, has no messages left. */
export type RadarScheduleState = 'active' | 'paused' | 'no_balance' | 'failed';

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
  /** On a Space Radar's report, the READER'S own read (Stay, 26 October 2026:
   *  per member); `workflow_status` and `priority` stay shared. */
  read_at: string | null;
  priority: boolean;
  dismissed_at: string | null;
  // Sharing state: false = a shared link is live (see ScanShareButton). Present
  // on owner reads + list rows; withheld from the trimmed non-owner shape.
  is_private: boolean;
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
  // Non-bot reads of the published report (signed-in users + crawlers).
  views_count: number;
  /** Space reports only, and not in the first part (plan 5.4): they come
   *  with the affected-items and drafts step. */
  affected_items?: RadarAffectedItem[];
  /** Drafts in this Radar's earlier reports: a draft's ordinal is
   *  `draft_offset + its index in this report` (plan 5.5). */
  draft_offset?: number;
  export_urls?: { docx: string; pdf: string } | null;
  radar?: { uuid: string; name: string; status?: RadarStatus } | null;
  space?: RadarSpaceStub | null;
  /** A space report's own read of what the caller may do (Backend's B3). */
  can_manage?: boolean;
  can_triage?: boolean;
}

export type RadarAffectedItemType = 'file' | 'note' | 'conversation';

/** A file, note or chat in the Space that a report says is affected, and why. */
export interface RadarAffectedItem {
  type: RadarAffectedItemType;
  id: string | number;
  name: string;
  reason: string;
  url: string | null;
  /** False once the item has left the Space or been deleted. */
  exists: boolean;
}

/**
 * Trimmed reader shape returned to signed-in non-owners and logged-out/public
 * visitors when a scan is published. Owner-only triage fields
 * (workflow_status, read_at, dismissed_at, priority, error, is_private) are
 * withheld; carries the radar context for display instead.
 */
export interface SharedRadarScanDetail {
  uuid: string;
  title: string | null;
  status: ScanStatus;
  has_findings: boolean;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  report: string | null;
  sources: ReportSource[];
  radar: { uuid: string; name: string };
  views_count: number;
  created_at: string;
  updated_at: string;
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

/**
 * Body for `POST /spaces/{uuid}/radars`: the personal body without `channels`
 * (a Space Radar reports to the Space's members).
 */
export type CreateSpaceRadarPayload = Omit<CreateRadarPayload, 'channels'>;

export type UpdateSpaceRadarPayload = Partial<CreateSpaceRadarPayload>;

/** Formats `GET /radars/{radar}/scans/{scan}/export` serves. */
export type RadarExportFormat = 'docx' | 'pdf';

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
  /** On a Space create, `payer` says whose balance stopped the scan: the
   *  Space's owner pays, so a member may be stopped by the owner's balance
   *  (Backend, 26 October 2026). Its message already says so. */
  block_reason: (IBlockedReason & { payer?: 'space_owner' | 'self' }) | null;
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

export interface SharedRadarScanResponse {
  success: boolean;
  message: string;
  data: SharedRadarScanDetail;
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
