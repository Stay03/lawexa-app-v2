import type { IPlanLimit, TUploadLimitType } from '@/types/subscription';

/**
 * The plan's file and upload limits as the admin limits form edits them
 * (Arthur's spec: "All limits must be configurable in Admin without code
 * changes"; techlead's go, thread 1c93152c, 31 October 2026). The rules are
 * the server's own (`UpdatePlanLimitsRequest::after`, `FileLimitService`), so
 * the form refuses what the server would refuse before the save is sent.
 * The three sizes stop at 500 MB since uploads go straight to storage
 * (Backend 527ce6a4); before that a request to our server carried 100 MB.
 */
export type FileLimitGroup = 'files' | 'spaces';

export interface FileLimitField {
  type: TUploadLimitType;
  label: string;
  group: FileLimitGroup;
  /** The unit the value is in, for the hint. */
  unit: 'MB' | 'files' | 'pages';
  /** The most the server takes; null for no ceiling. */
  max: number | null;
  /** Whether -1 (no limit) is taken. */
  noLimit: boolean;
  /** Whether 0 is taken (storage only: no uploads at all). */
  zero: boolean;
  /** The server's value when the plan has no row (`FileLimitService::DEFAULTS`). */
  fallback: number;
}

export const FILE_LIMIT_FIELDS: readonly FileLimitField[] = [
  { type: 'upload_size_mb', label: 'Document size', group: 'files', unit: 'MB', max: 500, noLimit: false, zero: false, fallback: 10 },
  { type: 'media_size_mb', label: 'Video and audio size', group: 'files', unit: 'MB', max: 500, noLimit: false, zero: false, fallback: 100 },
  { type: 'files_per_message', label: 'Files per chat message', group: 'files', unit: 'files', max: 20, noLimit: false, zero: false, fallback: 10 },
  { type: 'storage_mb', label: 'File storage', group: 'files', unit: 'MB', max: null, noLimit: true, zero: true, fallback: -1 },
  { type: 'scan_pages', label: 'Scanned pages read per PDF', group: 'files', unit: 'pages', max: 50, noLimit: false, zero: false, fallback: 10 },
  { type: 'max_pdf_pages', label: 'Pages per PDF', group: 'files', unit: 'pages', max: null, noLimit: true, zero: false, fallback: -1 },
  { type: 'space_storage_mb', label: 'Storage across owned Spaces', group: 'spaces', unit: 'MB', max: null, noLimit: true, zero: false, fallback: -1 },
  { type: 'space_upload_size_mb', label: 'File size in a Space', group: 'spaces', unit: 'MB', max: 500, noLimit: true, zero: false, fallback: -1 },
  { type: 'files_per_space_upload', label: 'Files per Space upload', group: 'spaces', unit: 'files', max: null, noLimit: true, zero: false, fallback: -1 },
  { type: 'max_space_documents', label: 'Files per Space', group: 'spaces', unit: 'files', max: null, noLimit: true, zero: false, fallback: -1 },
];

export const FILE_LIMIT_TYPES = FILE_LIMIT_FIELDS.map((field) => field.type);

/** The period a file row is saved with: a size or a count per upload does not reset over time. */
export const FILE_LIMIT_PERIOD = 'lifetime';

/** "1 to 500 MB", "-1 for no limit, or 1 and up", "-1 for no limit, 0 for none, or any size in MB". */
export function fileLimitHint(field: FileLimitField): string {
  const unit = field.unit === 'MB' ? ' MB' : ` ${field.unit}`;
  if (!field.noLimit) return `1 to ${field.max}${unit}`;
  if (field.max !== null) return `-1 for no limit, or 1 to ${field.max}${unit}`;
  if (field.zero) return `-1 for no limit, 0 for none, or any size in MB`;
  return `-1 for no limit, or 1 and up`;
}

/** The server's refusal for this value, in the form's words, or null when it takes it. */
export function fileLimitError(field: FileLimitField, value: number): string | null {
  if (!Number.isInteger(value)) return 'Enter a whole number.';
  if (value === -1) return field.noLimit ? null : `Enter ${fileLimitHint(field)}.`;
  if (value === 0 && field.zero) return null;
  if (value < 1 || (field.max !== null && value > field.max)) return `Enter ${fileLimitHint(field)}.`;
  return null;
}

/** 51200 → "50 GB", for an MB value of a gigabyte or more; null otherwise. */
export function gigabytesHint(field: FileLimitField, value: number): string | null {
  if (field.unit !== 'MB' || !Number.isFinite(value) || value < 1024) return null;
  return `${Number((value / 1024).toFixed(2))} GB`;
}

export interface FileLimitValue {
  limit_value: number;
  /** Whether the plan has its own row; without one the server reads the free plan's, then its default. */
  set: boolean;
}

/** The form's starting values: the plan's rows, or the server's default for a row the plan lacks. */
export function fileLimitValues(limits: readonly IPlanLimit[]): Record<TUploadLimitType, FileLimitValue> {
  return Object.fromEntries(
    FILE_LIMIT_FIELDS.map((field) => {
      const found = limits.find((limit) => limit.type === field.type);
      return [field.type, found ? { limit_value: found.value, set: true } : { limit_value: field.fallback, set: false }];
    }),
  ) as Record<TUploadLimitType, FileLimitValue>;
}

/**
 * The file rows a save sends: the ones the plan has, and the ones the admin
 * changed from where the form started. A row the plan lacks and nobody
 * touched is left out, so saving the AI messages does not pin a default over
 * the free plan's value.
 */
export function fileLimitRows(
  values: Record<TUploadLimitType, FileLimitValue>,
  initial: Record<TUploadLimitType, FileLimitValue>,
): { limit_type: TUploadLimitType; limit_value: number; period: typeof FILE_LIMIT_PERIOD }[] {
  return FILE_LIMIT_FIELDS.filter(
    (field) => values[field.type].set || values[field.type].limit_value !== initial[field.type].limit_value,
  ).map((field) => ({
    limit_type: field.type,
    limit_value: values[field.type].limit_value,
    period: FILE_LIMIT_PERIOD,
  }));
}
