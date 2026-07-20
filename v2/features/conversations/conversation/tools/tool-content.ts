import type { ToolMessage } from '@/types/chat';
import type { NoteLinkInfo } from '@/lib/utils/parse-content-xml';

/**
 * tool-content.ts — the v2-side presentation layer for tool-call payloads.
 *
 * WHY THIS EXISTS (owner's exhibit 2): the shared `lib/utils/tool-display.ts`
 * (v1-shared, READ-ONLY) flattens EVERY parameter through `String(value)` — so a
 * `create_note` call renders its HTML `content` argument as a wall of raw
 * `<h1>…</h1>` source text. That extractor cannot be changed without touching v1,
 * so the v2 tool surface classifies the RAW `toolParameters` itself here: short
 * scalars stay inline chips, long text / HTML / arrays become bounded blocks or
 * link rows, and HTML is stripped to readable prose (never dumped as source).
 *
 * Pure module (no JSX, no hooks) so it is safe to call in render. Result-data
 * shapes are ASSUMED defensively — every extractor returns `null` the moment a
 * field it needs is missing, so a shape it doesn't recognise falls through to the
 * generic (still-bounded) renderer rather than throwing or dumping.
 */

/* ── tool-family predicates ─────────────────────────────────────────────── */

export function isStatuteTool(name: string): boolean {
  return name === 'search_statutes' || name === 'read_statute';
}

export function isMemoryTool(name: string): boolean {
  return name === 'search_my_conversations' || name === 'view_conversation';
}

/** A tool that WRITES a note (create/save/generate) — routed to a note affordance. */
export function isNoteWriteTool(name: string): boolean {
  const n = name.toLowerCase();
  if (
    n === 'create_note' ||
    n === 'save_note' ||
    n === 'write_note' ||
    n === 'update_note' ||
    n === 'generate_note'
  ) {
    return true;
  }
  return (
    n.includes('note') &&
    (n.includes('create') || n.includes('save') || n.includes('write') || n.includes('generate'))
  );
}

/** A tool that retrieves ONE case/note — routed to a single-entity affordance. */
export function isSingleEntityTool(name: string): boolean {
  return (
    name === 'get_case' ||
    name === 'get_case_details' ||
    name === 'get_note' ||
    name === 'get_note_details' ||
    name === 'view_note'
  );
}

/* ── HTML → readable text ───────────────────────────────────────────────── */

export function looksLikeHtml(value: string): boolean {
  return /<[a-z!][\s\S]*?>/i.test(value);
}

/**
 * Collapse markup to readable plain text for a bounded preview. Block-level tags
 * become newlines so headings/paragraphs/list-items stay separated; everything
 * else is dropped and a few common entities are decoded. This is what turns
 * exhibit 2's raw `<h1>LEGAL ANSWER…</h1>` source into legible prose.
 */
export function stripHtml(input: string): string {
  return input
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article)>/gi, '\n')
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#3?9;|&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ── parameter classification (generic renderer) ────────────────────────── */

export type ClassifiedParam =
  | { kind: 'chip'; label: string; value: string }
  | { kind: 'text'; label: string; value: string }
  | { kind: 'links'; label: string; urls: string[] };

/**
 * Keys the collapsed STEP LINE already communicates (`Searched cases for "x"`,
 * `Read section 12`, `Retrieved case #4`). Repeating them as chips is the exact
 * redundancy the owner flagged, so the generic renderer drops them — but ONLY
 * for tools whose header actually restates them ({@link HEADER_COVERED_TOOLS}).
 * An unknown/future tool gets a bare-name header, so dropping its `query` there
 * would convey it NOWHERE (review F1) — unknown tools keep every param.
 */
const OMIT_KEYS = new Set([
  'query',
  'mode',
  'section',
  'start',
  'end',
  'case_id',
  'note_id',
  'id',
]);

/** The tools `formatToolMessage` gives a parameter-bearing header — the exact
 *  case list of its switch. Keep in lockstep with ToolStepItem. */
const HEADER_COVERED_TOOLS = new Set([
  'search_cases',
  'search_notes',
  'get_case',
  'get_case_details',
  'get_note',
  'get_note_details',
  'search_statutes',
  'read_statute',
  'view_note',
  'web_search',
  'get_page_content',
  'search_my_conversations',
  'view_conversation',
]);

const PARAM_LABELS: Record<string, string> = {
  urls: 'Pages',
  title: 'Title',
  content: 'Content',
  body: 'Body',
  name: 'Name',
  limit: 'Limit',
  page: 'Page',
  per_page: 'Per page',
  category: 'Category',
  status: 'Status',
  sort_by: 'Sort by',
  sort_order: 'Sort order',
};

function labelFor(key: string): string {
  return (
    PARAM_LABELS[key] ??
    key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** A scalar longer than this (or multi-line / HTML) becomes a bounded block. */
const INLINE_MAX = 72;

export function classifyParameters(
  params: Record<string, unknown>,
  toolName?: string,
): ClassifiedParam[] {
  const out: ClassifiedParam[] = [];
  const headerCovers = toolName !== undefined && HEADER_COVERED_TOOLS.has(toolName);

  for (const [key, raw] of Object.entries(params)) {
    if (raw === undefined || raw === null || raw === '') continue;
    if (headerCovers && OMIT_KEYS.has(key)) continue;
    const label = labelFor(key);

    if (Array.isArray(raw)) {
      const urls = raw.filter(
        (u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u),
      );
      if (urls.length > 0 && urls.length === raw.length) {
        out.push({ kind: 'links', label, urls });
        continue;
      }
      const joined = raw
        .map((x) => (typeof x === 'string' ? x : JSON.stringify(x)))
        .join(', ');
      out.push(
        joined.length > INLINE_MAX
          ? { kind: 'text', label, value: joined }
          : { kind: 'chip', label, value: joined },
      );
      continue;
    }

    if (typeof raw === 'object') {
      out.push({ kind: 'text', label, value: JSON.stringify(raw, null, 2) });
      continue;
    }

    const str = String(raw);
    if (looksLikeHtml(str)) {
      out.push({ kind: 'text', label, value: stripHtml(str) });
    } else if (str.length > INLINE_MAX || str.includes('\n')) {
      out.push({ kind: 'text', label, value: str });
    } else {
      out.push({ kind: 'chip', label, value: str });
    }
  }

  return out;
}

/* ── result-data helpers ────────────────────────────────────────────────── */

function unwrap(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;
  const top = data as Record<string, unknown>;
  const inner = top.data;
  return (inner && typeof inner === 'object' ? (inner as Record<string, unknown>) : top);
}

/** A meaningful server message on the result (e.g. "Note created"), if present. */
export function extractResultMessage(message: ToolMessage): string | null {
  const data = message.toolResult?.data;
  if (!data || typeof data !== 'object') return null;
  const m = (data as Record<string, unknown>).message;
  if (typeof m !== 'string') return null;
  const trimmed = m.trim();
  if (!trimmed || /^(success|ok|done)$/i.test(trimmed)) return null;
  return trimmed;
}

/**
 * The note produced by a note-WRITE tool, as the `NoteLinkInfo` the shared
 * {@link NoteLinkCard} consumes. Requires both a title and a resolvable URL —
 * otherwise `null`, so the generic renderer shows a clean stripped preview
 * instead of a broken card.
 */
export function extractCreatedNote(message: ToolMessage): NoteLinkInfo | null {
  if (!isNoteWriteTool(message.toolName)) return null;

  const paramTitle =
    typeof message.toolParameters.title === 'string'
      ? message.toolParameters.title.trim()
      : undefined;

  let title = paramTitle || undefined;
  let url: string | undefined;
  let downloadUrl: string | undefined;

  const inner = unwrap(message.toolResult?.data);
  if (inner) {
    const node =
      inner.note && typeof inner.note === 'object'
        ? (inner.note as Record<string, unknown>)
        : inner;
    const t = node.title ?? node.name;
    if (typeof t === 'string' && t.trim()) title = t.trim();

    const direct = node.url ?? node.view_url ?? node.link;
    const slug = node.slug;
    if (typeof direct === 'string' && direct) url = direct;
    else if (typeof slug === 'string' && slug) url = `/notes/${slug}`;

    const dl = node.download_url ?? node.docx_url ?? node.download;
    if (typeof dl === 'string' && dl) downloadUrl = dl;
  }

  if (!title || !url) return null;
  return { title, url, downloadUrl };
}

export interface SingleEntity {
  kind: 'case' | 'note';
  title: string;
  href: string;
  meta?: string;
}

/** The single case/note a retrieval tool returned, as an elevated link row. */
export function extractSingleEntity(message: ToolMessage): SingleEntity | null {
  if (!isSingleEntityTool(message.toolName)) return null;
  const inner = unwrap(message.toolResult?.data);
  if (!inner) return null;

  const isCase = message.toolName.includes('case');
  const key = isCase ? 'case' : 'note';
  const node =
    inner[key] && typeof inner[key] === 'object'
      ? (inner[key] as Record<string, unknown>)
      : inner;

  const slug = node.slug;
  if (typeof slug !== 'string' || !slug) return null;
  const title =
    typeof node.display_title === 'string' && node.display_title
      ? node.display_title
      : typeof node.title === 'string' && node.title
        ? node.title
        : null;
  if (!title) return null;

  if (isCase) {
    const court = node.court as Record<string, unknown> | undefined;
    const courtName =
      typeof court?.abbreviation === 'string'
        ? court.abbreviation
        : typeof court?.name === 'string'
          ? court.name
          : undefined;
    const date = typeof node.judgment_date === 'string' ? node.judgment_date : undefined;
    const meta = [courtName, date].filter(Boolean).join(' · ') || undefined;
    return { kind: 'case', title, href: `/cases/${slug}`, meta };
  }

  const course = node.course as Record<string, unknown> | undefined;
  const meta =
    typeof course?.name === 'string'
      ? course.name
      : typeof node.topic === 'string'
        ? node.topic
        : undefined;
  return { kind: 'note', title, href: `/notes/${slug}`, meta };
}

export interface WebResult {
  title: string;
  url: string;
  source?: string;
}

/** Web-search hits as source rows (Perplexity-style), if the result carries them. */
export function extractWebResults(message: ToolMessage): WebResult[] | null {
  if (message.toolName !== 'web_search') return null;
  const inner = unwrap(message.toolResult?.data);
  if (!inner) return null;

  const arr = inner.results ?? inner.items ?? inner.web ?? inner.sources;
  if (!Array.isArray(arr)) return null;

  const out: WebResult[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const url =
      typeof o.url === 'string' ? o.url : typeof o.link === 'string' ? o.link : null;
    const title =
      typeof o.title === 'string' ? o.title : typeof o.name === 'string' ? o.name : null;
    if (!url || !title) continue;
    let source: string | undefined;
    try {
      source = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      source = undefined;
    }
    out.push({ title, url, source });
  }

  return out.length > 0 ? out : null;
}

/* ── affirmative zero-result detection ──────────────────────────────────── */

/** The result-bearing tools whose collapsed step line should glance-hint a
 *  zero-hit outcome ("… · no matches") — searches over a corpus. */
export function isSearchLikeTool(name: string): boolean {
  return (
    name === 'search_cases' ||
    name === 'search_notes' ||
    name === 'search_statutes' ||
    name === 'web_search'
  );
}

function firstNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    if (typeof obj[key] === 'number') return obj[key] as number;
  }
  return null;
}

/**
 * A quiet, sentence-case empty message ONLY when a SUCCESSFUL result payload
 * DEMONSTRABLY holds an empty list — a recognised array key present and length 0,
 * or an explicit `returned`/`total`/`count` of 0. Returns `null` (never a zero
 * claim) when the step is still running, failed (the error line owns that), or
 * the payload shape is simply unrecognised. "We couldn't read it" must never
 * masquerade as "it returned zero" (owner's honesty requirement): an unknown
 * shape falls through to the generic renderer, which stays truthful.
 */
export function detectEmptyResult(message: ToolMessage): string | null {
  if (message.toolStatus !== 'complete') return null;
  if (message.toolResult?.success === false) return null;
  const inner = unwrap(message.toolResult?.data);
  if (!inner) return null;

  const name = message.toolName;

  // Corpus searches + page fetches — tailored copy, keyed on a recognised array.
  const searchSpecs: Array<{ names: string[]; keys: string[]; empty: string }> = [
    { names: ['search_cases'], keys: ['cases'], empty: 'No cases matched' },
    { names: ['search_notes'], keys: ['notes'], empty: 'No notes matched' },
    { names: ['search_statutes'], keys: ['statutes'], empty: 'No statutes matched' },
    {
      names: ['web_search'],
      keys: ['results', 'items', 'web', 'sources'],
      empty: 'No web results',
    },
    {
      names: ['get_page_content'],
      keys: ['pages', 'documents', 'results'],
      empty: 'No page content returned',
    },
  ];

  for (const spec of searchSpecs) {
    if (!spec.names.includes(name)) continue;
    for (const key of spec.keys) {
      if (Array.isArray(inner[key])) {
        return (inner[key] as unknown[]).length === 0 ? spec.empty : null;
      }
    }
    // Recognised tool but no recognised array — trust an explicit zero counter,
    // otherwise stay silent (we could not read the list).
    return firstNumber(inner, ['returned', 'total', 'count']) === 0 ? spec.empty : null;
  }

  if (name === 'read_statute') {
    const mode = typeof inner.mode === 'string' ? inner.mode : undefined;
    if (mode === 'outline') {
      return Array.isArray(inner.outline) && inner.outline.length === 0
        ? 'No outline available'
        : null;
    }
    if ('content' in inner) {
      const content = inner.content;
      return content == null || (typeof content === 'string' && content.trim() === '')
        ? 'No matching content'
        : null;
    }
    return null;
  }

  if (isSingleEntityTool(name)) {
    const key = name.includes('case') ? 'case' : 'note';
    if (inner[key] === null) return name.includes('case') ? 'Case not found' : 'Note not found';
    return null;
  }

  // Generic honest empty — a recognised empty list or an explicit zero counter,
  // else null (unknown shape → the caller shows the server message / "Completed").
  const rawData = message.toolResult?.data;
  if (rawData && typeof rawData === 'object' && Array.isArray((rawData as Record<string, unknown>).data)) {
    return ((rawData as Record<string, unknown>).data as unknown[]).length === 0
      ? 'No results'
      : null;
  }
  const genericKeys = ['results', 'items', 'cases', 'notes', 'statutes', 'lawyers'];
  for (const key of genericKeys) {
    if (Array.isArray(inner[key])) {
      return (inner[key] as unknown[]).length === 0 ? 'No results' : null;
    }
  }
  return firstNumber(inner, ['returned', 'total', 'count']) === 0 ? 'No results' : null;
}

/** Compact duration for a step header (`1.2s`, `12s`, `1m 30s`). Malformed
 *  input (NaN/negative/∞) renders nothing rather than "NaNs" (review F2). */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '';
  const seconds = ms / 1000;
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s ? `${m}m ${s}s` : `${m}m`;
}
