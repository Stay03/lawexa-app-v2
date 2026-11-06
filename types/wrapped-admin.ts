/**
 * Lawexa Wrapped's admin numbers: the two admin reads of Backend's view
 * tracking contract (thread 384c, e717a1af, 6 November 2026). The app reports
 * each step of a student's story (open, each card, the finish, a share) and
 * the server keeps it forward only, so these counts only ever grow. Opens
 * before the tracking went live were never recorded: `tracking_since` says
 * from when the counts run.
 */

/** One group's counts: everyone, a persona, or a campus. */
export interface WrappedAdminCounts {
  have: number;
  opened: number;
  finished: number;
  shared: number;
}

export interface WrappedAdminTotals extends WrappedAdminCounts {
  /** Every share, so one student sharing twice counts twice. `shared` counts students. */
  shares: number;
  /** Students sent the phone notification about Wrapped. */
  notified: number;
  /** Students with Hide from Wrapped on. Their record is gone, so they are not in `have`. */
  hidden: number;
  /** Non-guest sign-ups through any Wrapped share link. */
  share_signups: number;
}

/** `GET /admin/wrapped/summary` */
export interface WrappedAdminSummary {
  edition: string;
  totals: WrappedAdminTotals;
  /** How many reached at least card n. Always "1" to "8". */
  reached: Record<string, number>;
  /** Keyed by persona key (`section_quoter` ...). */
  by_persona: Record<string, WrappedAdminCounts>;
  /** Keyed by campus; `unknown` holds students with no campus. */
  by_campus: Record<string, WrappedAdminCounts>;
  /** The first open ever recorded, or null before any. */
  tracking_since: string | null;
}

export type WrappedStudentStatus = 'opened' | 'not_opened' | 'finished' | 'shared';

export interface WrappedAdminStudent {
  user_id: number;
  /** The admin user page's key (`/admin/users/{uuid}`). Asked of Backend in 384c; a row without it has no link. */
  user_uuid?: string | null;
  name: string;
  email: string;
  persona: string;
  campus: string | null;
  story: string;
  first_opened_at: string | null;
  last_seen_at: string | null;
  /** The furthest card reached, 1 to 8, or null before an open. */
  last_card: number | null;
  finished_at: string | null;
  shared_at: string | null;
  share_count: number;
  share_signups: number;
}

export interface WrappedAdminStudentPage {
  students: WrappedAdminStudent[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

/** `GET /admin/wrapped/students` filters. Empty values are left out of the request. */
export interface WrappedAdminStudentQuery {
  status: WrappedStudentStatus | null;
  persona: string | null;
  campus: string | null;
  search: string;
  page: number;
  per_page: number;
}
