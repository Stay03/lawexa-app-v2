import type { PaginationMeta } from './case';

/**
 * Lawexa's templates (admin only; Stay's go 4 November 2026, thread 2b658111):
 * documents Lawexa uses as models when it drafts. An admin uploads Word, RTF
 * and PDF files; each becomes a draft while Lawexa blanks out names, dates and
 * amounts and suggests its labels; the admin corrects it and makes it live.
 * The contract is Backend's (`/api/admin/templates`, 4 November 2026).
 */

/** processing while Lawexa reads and blanks it; failed when that did not work. */
export type AdminTemplateStatus = 'processing' | 'draft' | 'live' | 'failed';

export interface AdminTemplatePerson {
  id: number;
  name: string;
}

export interface AdminTemplateRow {
  uuid: string;
  name: string;
  practice_area: string | null;
  document_type: string | null;
  country: { id: number; name: string } | null;
  status: AdminTemplateStatus;
  /** A plain sentence when the reading or the AI pass failed. */
  error: string | null;
  source: { original_name: string; mime_type: string; size: number };
  blanks_count: number;
  uploaded_by: AdminTemplatePerson | null;
  reviewed_by: AdminTemplatePerson | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminTemplateDetail extends AdminTemplateRow {
  /** What was read from the file; read-only. */
  original_text: string;
  /** The blanked template: plain text, paragraphs split by a blank line. */
  text: string;
  /** The distinct blanks in `text`, e.g. ["[PARTY A]", "[DATE]"]. */
  blanks: string[];
}

export interface AdminTemplateListParams {
  search?: string;
  status?: AdminTemplateStatus;
  practice_area?: string;
  document_type?: string;
  country_id?: number;
  page?: number;
  per_page?: number;
}

export interface AdminTemplateListResponse {
  success: boolean;
  message: string;
  data: AdminTemplateRow[];
  pagination: PaginationMeta;
}

/** The labels in use, for the filters and the fields' suggestions. */
export interface AdminTemplateFacets {
  practice_areas: string[];
  document_types: string[];
  countries: { id: number; name: string }[];
}

export type AdminTemplateRefusalReason = 'type' | 'size' | 'duplicate';

export interface AdminTemplateUploadResult {
  created: AdminTemplateRow[];
  refused: { original_name: string; reason: AdminTemplateRefusalReason }[];
}

export interface AdminTemplateUpdatePayload {
  name?: string;
  practice_area?: string | null;
  document_type?: string | null;
  country_id?: number | null;
  text?: string;
}

/**
 * Bulk approve (Arthur, thread 2b658111, 4 November 2026: 300 drafts, not one
 * at a time): either the ticked drafts, or every draft matching the list's
 * current filters. `POST /api/admin/templates/approve`.
 */
export type AdminTemplateBulkApprovePayload =
  | { uuids: string[] }
  | ({ all_drafts: true } & Pick<AdminTemplateListParams, 'search' | 'practice_area' | 'document_type' | 'country_id'>);

export interface AdminTemplateBulkApproveResult {
  /** How many went live (a count, or their uuids). */
  approved: number | string[];
  skipped: { uuid: string; reason: string }[];
}
