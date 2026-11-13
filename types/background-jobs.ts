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

/** `agent_reply`: Lawexa messaged another agent and waits for its reply (sub-agents contract, section 1.3). */
export type BackgroundJobKind = 'file_transcription' | 'case_import' | 'radar_scan' | 'agent_reply';

/** An agent, as the sub-agents shapes name it. */
export interface AgentRef {
  id: number;
  name: string;
  slug: string;
}

/**
 * The agent conversation an `agent_reply` job follows a turn of (sub-agents
 * contract, section 4): its uuid opens the panel. No handle and no title: the
 * title comes from the conversation itself.
 */
export interface JobAgentConversation {
  id: string;
  agent: AgentRef;
}

/** A reply an `agent_reply` job brought back, as Lawexa's return names it (section 4). */
export interface AgentReplyOutcome {
  agent_conversation_id: string;
  agent: AgentRef;
  /** Null when the agent could not reply. */
  reply_message_id: number | null;
  /** The reply's first 200 characters; null when it could not reply. */
  preview: string | null;
}

export type BackgroundJobStatus = 'running' | 'succeeded' | 'failed' | 'cancelled';

/**
 * Why a failed job failed (Backend, 12 November 2026, for C1): `stopped` a
 * person pressed Stop on the agent's turn, `no_reply` the agent answered
 * nothing, `error` an error or a timeout, `gone` what it worked on is gone,
 * `wake_abandoned` Lawexa could not come back to it, `stalled` it went quiet
 * past the stall window.
 */
export type BackgroundJobFailure = 'stopped' | 'no_reply' | 'error' | 'gone' | 'wake_abandoned' | 'stalled';

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
  /** Why it failed; null while it runs, when it did not fail, and on a server that does not send it. */
  failure?: BackgroundJobFailure | null;
  /** On an `agent_reply` job: the agent conversation it follows; null or absent on every other kind. */
  agent_conversation?: JobAgentConversation | null;
  /**
   * A running job with a counted progress (a file reading) whose count has not
   * moved for 5 minutes and is waiting to be picked up again (Backend's stall
   * fix ca11f4c8). Absent on an older server, which means false.
   */
  waiting_to_resume?: boolean;
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
  /** On an `agent_reply` job: who replied, and the start of the reply. */
  agent_reply?: AgentReplyOutcome;
}
