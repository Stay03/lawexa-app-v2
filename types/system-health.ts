/**
 * System health — `GET /api/health`.
 *
 * MEASURED AGAINST PRODUCTION 2026-08-12, NOT TRANSCRIBED FROM THE DESCRIPTION
 * WE WERE HANDED, and the two differ in ways that would have produced a wrong
 * screen:
 *  - there are FOUR checks, not the two described (database and cache as well);
 *  - a check reports `status: 'up'`, not a boolean;
 *  - `mail.failures` arrives as a STRING ("0"), not a number — see below;
 *  - `queue.pending` is a map of queue name → depth, not a single number.
 *
 * NO TOKEN IS NEEDED: the endpoint answers anonymously (measured). It is
 * mounted on an admin screen because it is an operator's tool, not because the
 * server refuses anyone.
 */

/** Per-check verdict. `up` is the only good value; anything else is a fault and
 *  is rendered as the server's own word rather than being mapped to a guess. */
export type HealthCheckStatus = 'up' | (string & {});

export interface HealthCheckBase {
  status: HealthCheckStatus;
  /** How long the check itself took. */
  ms: number;
}

export interface MailHealthCheck extends HealthCheckBase {
  /** `configured` when credentials are in place. */
  transport: string;
  /**
   * Send failures inside `window_minutes`.
   *
   * A STRING ON THE WIRE ("0"), because it comes straight from a database
   * count. Comparing it against a number happens to work — JavaScript coerces
   * for `>`, so `"10" > 5` is true — but everything else about it lies:
   * `failures + 1` gives "01", `toLocaleString()` leaves it ungrouped, and a
   * field typed `number` would simply be false. Read it through
   * {@link mailFailureCount} and let the seam live in one place.
   */
  failures: string | number;
  window_minutes: number;
}

export interface QueueFailedCounts {
  last_hour: number;
  last_day: number;
  /**
   * Failures still on the books, NOT everything that has ever failed.
   *
   * Inferred from the operator's own arithmetic: the total was 729, eighteen
   * stuck emails were re-sent, and it became 711. A lifetime tally cannot go
   * down. So this is the size of the backlog a person could still clear, which
   * is why it is worth showing at all.
   */
  total: number;
}

export interface QueueHealthCheck extends HealthCheckBase {
  driver: string;
  workers_running: boolean;
  /** Queue name → jobs waiting. The set of queues is the server's to decide, so
   *  this is read as a map and never as four known keys. */
  pending: Record<string, number>;
  /** Null when nothing is waiting. */
  oldest_pending_minutes: number | null;
  failed: QueueFailedCounts;
}

export interface SystemHealthChecks {
  database: HealthCheckBase;
  cache: HealthCheckBase;
  mail: MailHealthCheck;
  queue: QueueHealthCheck;
}

export interface SystemHealth {
  /** The whole-system verdict, e.g. `healthy`. */
  status: string;
  checks: SystemHealthChecks;
}

export interface SystemHealthResponse {
  success: boolean;
  /** A sentence written by the server, e.g. "All systems operational." */
  message: string;
  data: SystemHealth;
}

/** The mail failure count as a number, whichever way the server sent it. */
export function mailFailureCount(mail: MailHealthCheck): number {
  const parsed = Number(mail.failures);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Total jobs waiting across every queue the server reported. */
export function pendingTotal(queue: QueueHealthCheck): number {
  return Object.values(queue.pending).reduce((sum, n) => sum + n, 0);
}

/** Is this check reporting a fault? */
export function isCheckDown(check: HealthCheckBase): boolean {
  return check.status !== 'up';
}
