import type { InfiniteData } from '@tanstack/react-query';

import type {
  ContentRequest,
  ContentRequestListResponse,
  ContentRequestStatus,
  ContentRequestType,
  SubmitContentRequestData,
} from '@/types/content-request';
import { caseHref } from '@/v2/features/cases/case-row-model';
import { statuteHref } from '@/v2/features/statutes/statute-row-model';

/**
 * My requests: the pure half. Everything here is a fact about the API's answer
 * or about an address, so the screens stay layout and the tests can pin it.
 *
 * ── THE API, AS THE SERVER WRITES IT (lawexa-api, read 24 October 2026) ────
 *   GET  /content-requests          the viewer's OWN requests, whatever their
 *                                   role; `sort=created_at&direction=desc` is
 *                                   the default; `per_page` clamped to 1..50
 *   GET  /content-requests/{uuid}   owner or researcher+; 403 / 404 otherwise
 *   POST /content-requests          `type` (case | note), `title` (max 255),
 *                                   `additional_notes` (optional, max 2000);
 *                                   guests get 403; 422 carries `errors`
 *
 * `CreateContentRequestRequest` accepts `case` and `note` only. The Phase 14
 * doc says `case | statute | provision`; the server's rule is what is live.
 */

/**
 * Where the screens live. v1's addresses, kept: the "request received" and
 * "request fulfilled" emails link to `/content-requests/{uuid}`
 * (`resources/views/emails/content-request/*.blade.php`), so the list and every
 * request keep the address people already hold.
 */
export const REQUESTS_PATH = '/content-requests';

export function requestHref(uuid: string): string {
  return `${REQUESTS_PATH}/${encodeURIComponent(uuid)}`;
}

/** The API's page size for this list, as v1 asked for it. */
export const REQUESTS_PAGE_SIZE = 15;

/**
 * The status words. The API sends `status_label` in Title Case ("In Progress");
 * v2 writes sentence case on every surface, so the four values the server's
 * enum has get their own words here, and anything newer falls back to the
 * server's label rather than to a blank.
 */
const STATUS_WORDS: Record<ContentRequestStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  fulfilled: 'Fulfilled',
  rejected: 'Rejected',
};

export function statusWord(request: Pick<ContentRequest, 'status' | 'status_label'>): string {
  return STATUS_WORDS[request.status] ?? (request.status_label || request.status);
}

/** The one sentence under a request's title that says where it stands. */
const STATUS_SENTENCES: Record<ContentRequestStatus, string> = {
  pending: 'Waiting for our research team to look at it.',
  in_progress: 'Our research team is working on it.',
  fulfilled: 'Our research team has added it.',
  rejected: 'Our research team could not add it.',
};

export function statusSentence(status: ContentRequestStatus): string | null {
  return STATUS_SENTENCES[status] ?? null;
}

/**
 * The pill's look per status, in greys only (Stay's rule: no coloured badges,
 * gold is for actions). A request still open (waiting or being worked on) wears
 * an outline, and the one being worked on adds a small grey dot; a closed one
 * (added or refused) is a solid grey fill. The word says which.
 */
export type StatusTone = 'waiting' | 'working' | 'closed';

const STATUS_TONES: Record<ContentRequestStatus, StatusTone> = {
  pending: 'waiting',
  in_progress: 'working',
  fulfilled: 'closed',
  rejected: 'closed',
};

export function statusTone(status: ContentRequestStatus): StatusTone {
  return STATUS_TONES[status] ?? 'waiting';
}

/** The pill's classes per tone. */
export const STATUS_PILL: Record<StatusTone, string> = {
  waiting: 'border-border bg-background text-muted-foreground',
  working: 'border-border bg-background text-muted-foreground',
  closed: 'border-transparent bg-foreground/10 text-foreground',
};

/** The kinds the server takes on a new request, in the order the form offers them. */
export const REQUEST_TYPES: readonly { value: ContentRequestType; label: string }[] = [
  { value: 'case', label: 'A case' },
  { value: 'note', label: 'A note' },
];

/**
 * The word for a requested kind. `statute` and `provision` are here because
 * the older doc lists them and rows of those kinds may exist; an unknown kind
 * prints as the server sent it.
 */
const TYPE_WORDS: Record<string, string> = {
  case: 'Case',
  note: 'Note',
  statute: 'Statute',
  provision: 'Provision',
};

export function typeWord(type: string): string {
  return TYPE_WORDS[type] ?? type;
}

/**
 * Where a fulfilled request's content opens, or `null` when the API gave no
 * way to reach it.
 *
 * The server links `case` and `note` content and sends its slug
 * (`CaseSummaryResource`, `NoteSummaryResource`); for any other kind it sends
 * `created_content: null`. A statute is linked here too in case that changes,
 * and only when a slug arrives. A provision has no address of its own without
 * its statute, so it gets none.
 */
export function contentHref(request: Pick<ContentRequest, 'status' | 'created_content_type' | 'created_content'>): string | null {
  if (request.status !== 'fulfilled') return null;
  const slug = request.created_content?.slug;
  if (!slug) return null;
  switch (request.created_content_type) {
    case 'case':
      return caseHref(slug);
    case 'note':
      return `/notes/${encodeURIComponent(slug)}`;
    case 'statute':
      return statuteHref(slug);
    default:
      return null;
  }
}

/** "Open the case", "Open the note"; the button names what it opens. */
export function openContentLabel(type: string | null): string {
  if (type === 'case' || type === 'note' || type === 'statute') return `Open the ${type}`;
  return 'Open it';
}

/** The fields the form holds, as the reader typed them. */
export interface RequestDraft {
  type: ContentRequestType | null;
  title: string;
  notes: string;
}

export const TITLE_MAX = 255;
export const NOTES_MAX = 2000;

/**
 * The POST body: the old form's three fields (`components/content-requests/
 * ContentRequestDialog.tsx`), trimmed, with empty notes left out as v1 left
 * them out. `null` until the draft has what the server requires, so the
 * button can stay disabled without a second copy of the rule.
 */
export function submitBody(draft: RequestDraft): SubmitContentRequestData | null {
  const title = draft.title.trim();
  if (!draft.type || !title) return null;
  const notes = draft.notes.trim();
  return notes
    ? { type: draft.type, title, additional_notes: notes }
    : { type: draft.type, title };
}

export type DraftField = 'type' | 'title' | 'additional_notes';

/**
 * A 422's `errors`, reduced to the first message for each field the form
 * shows. Any other key lands in `other`, so a rule the form does not know
 * about still reaches the reader instead of disappearing.
 */
export function fieldErrors(errors: Record<string, string[]> | null): {
  fields: Partial<Record<DraftField, string>>;
  other: string | null;
} {
  const fields: Partial<Record<DraftField, string>> = {};
  let other: string | null = null;
  for (const [key, messages] of Object.entries(errors ?? {})) {
    const first = messages[0];
    if (!first) continue;
    if (key === 'type' || key === 'title' || key === 'additional_notes') fields[key] = first;
    else other ??= first;
  }
  return { fields, other };
}

/**
 * Every loaded page in one newest-first list, each request once.
 *
 * A request added at the top pushes every row one place down the server's
 * pages, so page 2 fetched after it can repeat page 1's last row. The first
 * copy wins.
 */
export function flattenRequests(pages: readonly ContentRequestListResponse[] | undefined): ContentRequest[] {
  if (!pages) return [];
  const seen = new Set<string>();
  const rows: ContentRequest[] = [];
  for (const page of pages) {
    for (const request of page.data) {
      if (seen.has(request.uuid)) continue;
      seen.add(request.uuid);
      rows.push(request);
    }
  }
  return rows;
}

/**
 * The cached list with a just-made request at its top, and the count moved by
 * one. Unchanged when nothing is cached yet (the first read will carry it) or
 * when the request is already there.
 */
export function prependRequest(
  data: InfiniteData<ContentRequestListResponse, number> | undefined,
  request: ContentRequest,
): InfiniteData<ContentRequestListResponse, number> | undefined {
  if (!data || data.pages.length === 0) return data;
  if (data.pages.some((page) => page.data.some((row) => row.uuid === request.uuid))) return data;
  const [first, ...rest] = data.pages;
  return {
    ...data,
    pages: [
      {
        ...first,
        data: [request, ...first.data],
        pagination: { ...first.pagination, total: first.pagination.total + 1 },
      },
      ...rest,
    ],
  };
}

const DAY_MONTH_YEAR = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** "24 October 2026", or `null` for a missing or unreadable time. */
export function formatDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : DAY_MONTH_YEAR.format(time);
}

/** One line of the detail page's history. */
export interface HistoryStep {
  key: 'asked' | 'working' | 'fulfilled' | 'rejected';
  label: string;
  /** The day, when the API keeps one for this step. */
  day: string | null;
  /** Who did it, when the API names them. */
  by: string | null;
}

/**
 * What happened to a request, oldest first, from the fields the API keeps.
 *
 * The API stores no list of changes: it keeps the day it was asked, and the
 * day and the person for a fulfilment or a refusal. "In progress" has no time
 * of its own (`updated_at` moves on any edit), so that step carries none
 * rather than a day that may be wrong.
 */
export function requestHistory(request: ContentRequest): HistoryStep[] {
  const steps: HistoryStep[] = [
    { key: 'asked', label: 'Asked', day: formatDay(request.created_at), by: null },
  ];
  if (request.status === 'in_progress') {
    steps.push({ key: 'working', label: 'In progress', day: null, by: null });
  }
  if (request.status === 'fulfilled') {
    steps.push({
      key: 'fulfilled',
      label: 'Fulfilled',
      day: formatDay(request.fulfilled_at),
      by: request.fulfilled_by?.name ?? null,
    });
  }
  if (request.status === 'rejected') {
    steps.push({
      key: 'rejected',
      label: 'Rejected',
      day: formatDay(request.rejected_at),
      by: request.rejected_by?.name ?? null,
    });
  }
  return steps;
}
