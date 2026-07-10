// Admin AKN statute-import observability — types
// Backend: /api/admin/statute-imports[/summary] (role:admin)

import type { JobUserRef } from '@/lib/utils/observability';

export type StatuteImportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export const STATUTE_IMPORT_STATUSES: StatuteImportStatus[] = [
  'pending',
  'processing',
  'completed',
  'failed',
];

export interface StatuteImportStatuteRef {
  id: number;
  title: string;
  slug: string;
}

export interface StatuteImport {
  id: number;
  uuid: string;
  status: StatuteImportStatus;
  original_filename: string | null;
  total_nodes: number | null;
  processed_nodes: number | null;
  error_message: string | null;
  warnings: string[] | null;
  creator: JobUserRef | null;
  /** Set once the statute is created. */
  statute: StatuteImportStatuteRef | null;
  created_at: string;
  updated_at: string;
}

export interface StatuteImportSummary {
  imports: Record<StatuteImportStatus, number>;
  /** processing whose updated_at is > 30 min old — genuinely stuck. */
  stuck_processing: number;
  failed_last_7_days: number;
}

export interface StatuteImportsParams {
  status?: StatuteImportStatus;
  user_id?: number;
  date_from?: string;
  date_to?: string;
  per_page?: number;
  page?: number;
}
