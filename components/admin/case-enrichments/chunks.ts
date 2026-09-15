// Reading `stats.chunks` on an enrichment run. Every screen goes through here,
// so a run with no record, or with a number where the record should be, reads
// the same everywhere.

import type {
  EnrichmentChunkError,
  EnrichmentChunkErrorDetails,
  EnrichmentChunks,
  EnrichmentStats,
  EnrichmentWithheldScalar,
} from '@/types/admin-case-enrichments';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const indexList = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((item): item is number => Number.isInteger(item)) : [];

/** The run's chunk record, or null when it has none or carries a number there. */
export function chunkRecord(stats: EnrichmentStats | null): EnrichmentChunks | null {
  const chunks = stats?.chunks;
  return isRecord(chunks) ? (chunks as EnrichmentChunks) : null;
}

export interface PartsProgress {
  /**
   * Parts read over this report text so far, across every run on it. Null
   * when the record has no list of parts read: a running run, and a failed
   * run where no part answered, carry a plan and no `done`.
   */
  read: number | null;
  total: number;
  missing: number[];
  /** Parts this run asked the model for. */
  requested: number[];
  /** The partial run this one continues, or null. */
  resumes: number | null;
}

/** How much of the report a run has read, or null without a usable record. */
export function partsProgress(stats: EnrichmentStats | null): PartsProgress | null {
  const record = chunkRecord(stats);
  if (!record || !Number.isInteger(record.total) || record.total <= 0) return null;

  const plan = isRecord(record.plan) ? record.plan : null;
  const resumes = plan?.resumes;
  return {
    read: Array.isArray(record.done) ? indexList(record.done).length : null,
    total: record.total,
    missing: indexList(record.missing),
    requested: indexList(plan?.requested),
    resumes: typeof resumes === 'number' && Number.isInteger(resumes) ? resumes : null,
  };
}

/** Each part's error, in the order the run recorded them. */
export function partErrors(record: EnrichmentChunks): EnrichmentChunkError[] {
  if (!Array.isArray(record.errors)) return [];
  return record.errors.filter(
    (entry: unknown): entry is EnrichmentChunkError =>
      isRecord(entry) && Number.isInteger(entry.chunk)
  );
}

/** What the AI service said under one part's failure, in a shape a screen can draw. */
export interface PartFailure {
  /** 'schema_violation', 'rate_limited', 'retry_deadline', or null on an old run. */
  code: string | null;
  retryable: boolean | null;
  /**
   * Where the model's answer stopped, in characters, when the validator named
   * the position. Null when it did not, which is not the same as "not cut".
   */
  cutAt: number | null;
  /** The validator's own lines, untruncated, in the order it wrote them. */
  validatorLines: string[];
  /** The stored 405-character sample of the answer, opening and ending. */
  sample: string | null;
  firstAttemptSample: string | null;
  upstreamCode: string | null;
}

const textList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/* The validator writes the character it stopped at into its own sentence, e.g.
   "JSON parse error: Unterminated string starting at at pos 28795". That number
   is the only untruncated evidence of how long the answer was, because both the
   AI service and the API trim the answer itself. */
const CUT_POSITION = /pos (\d+)/;

function cutPosition(lines: string[]): number | null {
  for (const line of lines) {
    const found = CUT_POSITION.exec(line);
    if (found) return Number(found[1]);
  }
  return null;
}

/**
 * The detail under a part error, or null when the run carries none. Runs made
 * before the API sent this have `error` alone and must still read cleanly.
 */
export function partFailure(entry: EnrichmentChunkError): PartFailure | null {
  const outer: EnrichmentChunkErrorDetails | null = isRecord(entry.details)
    ? (entry.details as EnrichmentChunkErrorDetails)
    : null;
  const inner = isRecord(outer?.details) ? outer.details : null;
  const code = text(outer?.code) ?? text(entry.code);
  const validatorLines = textList(inner?.validation_errors);
  const sample = text(inner?.raw_output);
  const firstAttemptSample = text(inner?.raw_output_first_attempt);
  const upstreamCode = text(inner?.upstream_code);
  const retryable = typeof outer?.retryable === 'boolean' ? outer.retryable : null;

  if (
    code === null &&
    retryable === null &&
    validatorLines.length === 0 &&
    sample === null &&
    firstAttemptSample === null &&
    upstreamCode === null
  ) {
    return null;
  }

  return {
    code,
    retryable,
    cutAt: cutPosition(validatorLines),
    validatorLines,
    sample,
    firstAttemptSample,
    upstreamCode,
  };
}

/** Held scalars as [field, held] pairs, in the order the API sent them. */
export function withheldScalars(record: EnrichmentChunks): [string, EnrichmentWithheldScalar][] {
  if (!isRecord(record.withheld)) return [];
  return Object.entries(record.withheld).filter(
    (entry: [string, unknown]): entry is [string, EnrichmentWithheldScalar] =>
      isRecord(entry[1]) && Number.isInteger(entry[1].chunk)
  );
}

/** A part index as people count it: index 0 is part 1. */
export function partLabel(index: number): string {
  return `Part ${index + 1}`;
}

/** A held value as text, whatever type the model read. */
export function withheldText(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}
