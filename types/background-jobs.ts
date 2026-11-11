/**
 * Background jobs (Backend's shapes 063d9cc3, docs/api/background-jobs-shapes.md;
 * thread 1874e291). Some of Lawexa's work takes longer than one answer:
 * reading a file, importing a judgment, a Radar scan. That work runs as a
 * background job, Lawexa's answer ends at once, and when the job ends Lawexa
 * is woken in the same chat and answers with the result.
 *
 * Jobs exist only in a person's own chat or a Space chat; confidential,
 * channel and Radar chats never have them.
 */

export type BackgroundJobKind = 'file_transcription' | 'case_import' | 'radar_scan';

export type BackgroundJobStatus = 'running' | 'succeeded' | 'failed' | 'cancelled';

/**
 * Whether Lawexa has come back to an ended job: `null` while it runs or once
 * cancelled, `pending` ended and not answered yet, `woken` answered,
 * `abandoned` Lawexa could not come back (the give-up line was written).
 */
export type BackgroundJobWake = 'pending' | 'woken' | 'abandoned' | null;

export interface BackgroundJobProgress {
  done: number;
  /** Null when the total is not known. */
  total: number | null;
  /** `pages` or `scanned pages`. */
  unit: string;
}

export interface BackgroundJob {
  /** The job's uuid. */
  id: string;
  kind: BackgroundJobKind;
  /** The kind in plain words: `file reading`, `case import`, `Radar scan`. */
  kind_name: string;
  status: BackgroundJobStatus;
  /** Null for imports and scans, which report none. */
  progress: BackgroundJobProgress | null;
  started_at: string;
  finished_at: string | null;
  /** The person's message whose turn started the job; null once that message is gone. */
  started_by_message_id: number | null;
  wake: BackgroundJobWake;
}

/** `GET /conversations/{uuid}/background-jobs`: the reader's own jobs in the chat, oldest first. */
export interface BackgroundJobListResponse {
  success: boolean;
  message: string;
  data: { background_jobs: BackgroundJob[] };
}

/** `POST /background-jobs/{uuid}/cancel`. */
export interface BackgroundJobResponse {
  success: boolean;
  message: string;
  data: { background_job: BackgroundJob };
}

/** One job as a wake message, a give-up line or a notification names it. */
export interface BackgroundJobOutcome {
  job_id: string;
  kind: BackgroundJobKind;
  outcome: 'succeeded' | 'failed';
}
