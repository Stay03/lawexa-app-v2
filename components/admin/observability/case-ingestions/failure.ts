import type { CaseIngestion } from '@/types/admin-case-ingestions';

/**
 * What a failed ingestion's `status_code` actually means, and whether it is
 * honest to show it as an HTTP status.
 *
 * Measured across all 95 failed rows on 16 September 2026:
 *
 *     500   job timeout      34     our own process died
 *     500   worker stopped   14
 *     500   db deadlock       4
 *     500   attempt limit     3
 *     502   schema violation 17     the AI service answered badly
 *     502   rate limited     16
 *     409   duplicate guard   6
 *     422   config fault      1
 *
 * **500 never means an HTTP 500 here.** Nothing answered over HTTP; the job was
 * killed at its time limit, or the worker died, or MySQL broke a deadlock. 502
 * is the opposite: a real response from the AI service, so the number is true
 * and worth showing.
 *
 * The screen printed "HTTP 500" for all of them. After two days of watching the
 * provider refuse us, that reads as the provider failing again — the opposite of
 * what happened, on the most common failure we have.
 */
export interface IngestionFailure {
  /** A sentence naming what happened, or null when the raw error is clearer. */
  headline: string | null;
  /** Whether `status_code` is a real HTTP status and can be shown as one. */
  statusIsHttp: boolean;
}

/**
 * The failures our own process produces, keyed by what the error text says.
 * Each is a 500 in the data and none of them is an HTTP response.
 */
const OURS: ReadonlyArray<readonly [RegExp, string]> = [
  [/has timed out/i, 'The ingestion ran its full time limit and was stopped.'],
  [/attempted too many times/i, 'The ingestion was retried to its attempt limit and gave up.'],
  [/worker stopped/i, 'The worker stopped before the ingestion finished.'],
  [
    /Serialization failure|Deadlock found/i,
    'Two ingestions collided writing the same table and the database stopped one of them.',
  ],
];

export function ingestionFailure(ingestion: CaseIngestion | null): IngestionFailure {
  const error = String(ingestion?.error ?? '');
  const match = OURS.find(([pattern]) => pattern.test(error));
  if (match) return { headline: match[1], statusIsHttp: false };

  /* A 500 with wording nobody has catalogued is still our process dying: no
     upstream in this pipeline answers 500. Say less rather than claim a status
     that did not happen. */
  if (ingestion?.status_code === 500) {
    return { headline: 'The ingestion stopped before it finished.', statusIsHttp: false };
  }

  return { headline: null, statusIsHttp: ingestion?.status_code != null };
}
