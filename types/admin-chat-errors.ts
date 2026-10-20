// Admin chat error log — types
// Backend: /api/admin/chat-errors[/summary] (role:superadmin), commit 005714a9.
// The list is newest first. per_page is capped at 100 and summary hours at 720.

export type ChatErrorSource = 'server' | 'app';

export const CHAT_ERROR_SOURCES: ChatErrorSource[] = ['server', 'app'];

export type ChatErrorStage =
  | 'refused'
  | 'validation'
  | 'send_failed'
  | 'provider'
  | 'tool'
  | 'stream'
  | 'job'
  | 'client';

export const CHAT_ERROR_STAGES: ChatErrorStage[] = [
  'refused',
  'validation',
  'send_failed',
  'provider',
  'tool',
  'stream',
  'job',
  'client',
];

export const CHAT_ERRORS_PER_PAGE_DEFAULT = 25;
export const CHAT_ERRORS_PER_PAGE_MAX = 100;
export const CHAT_ERROR_SUMMARY_HOURS_DEFAULT = 24;
export const CHAT_ERROR_SUMMARY_HOURS_MAX = 720;

export interface ChatErrorUserRef {
  id: number;
  uuid: string;
  name: string;
}

export interface ChatError {
  id: number;
  /** ISO timestamp. */
  occurred_at: string;
  source: ChatErrorSource;
  stage: ChatErrorStage;
  http_status: number | null;
  error_code: string | null;
  error_type: string | null;
  message: string | null;
  tool_name: string | null;
  user: ChatErrorUserRef | null;
  /** Internal numeric conversation id, not the uuid. */
  conversation_id: number | null;
  space_id: number | null;
  agent_id: number | null;
  model_id: number | null;
  ai_request_id: number | null;
  execution_id: number | null;
  platform: string | null;
  app_version: string | null;
}

export interface ChatErrorStageCount {
  stage: ChatErrorStage;
  count: number;
}

export interface ChatErrorCodeCount {
  stage: ChatErrorStage;
  error_code: string | null;
  count: number;
}

export interface ChatErrorUserCount {
  user_id: number;
  count: number;
}

export interface ChatErrorSummary {
  hours: number;
  total: number;
  by_stage: ChatErrorStageCount[];
  /** Top 20. */
  by_code: ChatErrorCodeCount[];
  top_users: ChatErrorUserCount[];
}

export interface ChatErrorsFilters {
  stage?: ChatErrorStage;
  source?: ChatErrorSource;
  code?: string;
  user_id?: number;
  space_id?: number;
  /** YYYY-MM-DD */
  from?: string;
  /** YYYY-MM-DD */
  to?: string;
}

export interface ChatErrorsParams extends ChatErrorsFilters {
  page?: number;
  per_page?: number;
}

export interface ChatErrorSummaryParams extends ChatErrorsFilters {
  hours?: number;
}

/** One reader for both the URL query and the filter form: `key` → raw value or null. */
export type ParamSource = (key: string) => string | null;

const FILTER_KEYS: (keyof ChatErrorsFilters)[] = [
  'stage',
  'source',
  'code',
  'user_id',
  'space_id',
  'from',
  'to',
];

export function isChatErrorStage(value: string | null): value is ChatErrorStage {
  return value !== null && (CHAT_ERROR_STAGES as string[]).includes(value);
}

export function isChatErrorSource(value: string | null): value is ChatErrorSource {
  return value !== null && (CHAT_ERROR_SOURCES as string[]).includes(value);
}

/** "12" → 12. Anything that is not a safe positive integer is undefined. */
function positiveInt(value: string | null): number | undefined {
  if (value === null || !/^[1-9][0-9]*$/.test(value.trim())) return undefined;
  const n = Number(value.trim());
  return Number.isSafeInteger(n) ? n : undefined;
}

function isoDate(value: string | null): string | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined;
}

function text(value: string | null): string | undefined {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : undefined;
}

/** The filters a URL or a form holds, with every value checked and the rest dropped. */
export function readChatErrorFilters(get: ParamSource): ChatErrorsFilters {
  const stage = get('stage');
  const source = get('source');
  return {
    stage: isChatErrorStage(stage) ? stage : undefined,
    source: isChatErrorSource(source) ? source : undefined,
    code: text(get('code')),
    user_id: positiveInt(get('user_id')),
    space_id: positiveInt(get('space_id')),
    from: isoDate(get('from')),
    to: isoDate(get('to')),
  };
}

/** The list request a URL asks for: its filters, page (default 1) and per_page (default 25, max 100). */
export function readChatErrorsParams(get: ParamSource): ChatErrorsParams {
  const perPage = positiveInt(get('per_page'));
  return {
    ...readChatErrorFilters(get),
    page: positiveInt(get('page')) ?? 1,
    per_page: perPage === undefined ? CHAT_ERRORS_PER_PAGE_DEFAULT : Math.min(perPage, CHAT_ERRORS_PER_PAGE_MAX),
  };
}

export function hasChatErrorFilters(filters: ChatErrorsFilters): boolean {
  return FILTER_KEYS.some((key) => filters[key] !== undefined);
}

/**
 * The URL query for a set of params, in a fixed key order, without the
 * defaults (page 1, the default per_page) so a plain list keeps a plain URL.
 * Returns '' when nothing is set.
 */
export function chatErrorsQueryString(params: ChatErrorsParams): string {
  const query = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = params[key];
    if (value !== undefined) query.set(key, String(value));
  }
  if (params.page !== undefined && params.page > 1) query.set('page', String(params.page));
  if (params.per_page !== undefined && params.per_page !== CHAT_ERRORS_PER_PAGE_DEFAULT) {
    query.set('per_page', String(params.per_page));
  }
  return query.toString();
}
