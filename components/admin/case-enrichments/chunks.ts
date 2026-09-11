// Reading `stats.chunks` on an enrichment run. Every screen goes through here,
// so a run with no record, or with a number where the record should be, reads
// the same everywhere.

import type {
  EnrichmentChunkError,
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
  /** Parts read over this report text so far, across every run on it. */
  read: number;
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
    read: indexList(record.done).length,
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
