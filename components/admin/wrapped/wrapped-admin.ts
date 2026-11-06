import { CAMPUS_NAMES, PERSONAS } from '@/lib/wrapped/copy';
import type { WrappedCampus, WrappedPersonaKey } from '@/lib/wrapped/types';
import type {
  WrappedAdminCounts,
  WrappedAdminStudent,
  WrappedAdminSummary,
  WrappedStudentStatus,
} from '@/types/wrapped-admin';

/**
 * The Wrapped admin page as data: the funnel, the two splits and the student
 * list's view, read from Backend's summary and student list (thread 384c,
 * e717a1af). Everything here is pure, so the page only draws.
 *
 * ── PERCENTAGES ARE OF THE STUDENTS WHO HAVE A WRAPPED ────────────────────
 * Each funnel step says how many of `have` got there, and how many of the step
 * before. A share of nothing is no share at all, so a zero base shows a dash,
 * never "0%" or "NaN%".
 *
 * ── LABELS FALL BACK TO THE KEY ───────────────────────────────────────────
 * Persona and campus keys are named from the story's own copy. A key the copy
 * does not know (a new persona, a campus spelled another way) shows as sent,
 * so a count is never dropped for want of a label.
 */

/** The story's last card. `reached` always covers 1 to this. */
export const STORY_CARDS = 8;

/** A whole percentage, or null when the base is zero. */
export function percentOf(count: number, base: number): number | null {
  if (!Number.isFinite(count) || !Number.isFinite(base) || base <= 0) return null;
  return Math.round((count / base) * 100);
}

export function percentText(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

export interface FunnelStep {
  key: string;
  label: string;
  count: number;
  /** Of the students who have a Wrapped. */
  ofHave: number | null;
  /** Of the step before; null on the first step. */
  ofPrevious: number | null;
}

/** have → opened → each card → finished → shared. */
export function funnelSteps(summary: WrappedAdminSummary): FunnelStep[] {
  const { totals, reached } = summary;
  const raw: { key: string; label: string; count: number }[] = [
    { key: 'have', label: 'Have a Wrapped', count: totals.have },
    { key: 'opened', label: 'Opened it', count: totals.opened },
  ];
  for (let card = 1; card <= STORY_CARDS; card += 1) {
    raw.push({ key: `card-${card}`, label: `Reached card ${card}`, count: reached[String(card)] ?? 0 });
  }
  raw.push({ key: 'finished', label: 'Finished', count: totals.finished });
  raw.push({ key: 'shared', label: 'Shared', count: totals.shared });

  return raw.map((step, index) => ({
    ...step,
    ofHave: percentOf(step.count, totals.have),
    ofPrevious: index === 0 ? null : percentOf(step.count, raw[index - 1].count),
  }));
}

/** The key Backend uses for students with no campus. */
export const NO_CAMPUS = 'unknown';

export function personaLabel(key: string): string {
  return PERSONAS[key as WrappedPersonaKey]?.name ?? key;
}

export function campusLabel(key: string | null): string {
  if (!key || key === NO_CAMPUS) return 'No campus';
  return CAMPUS_NAMES[key as WrappedCampus] ?? key;
}

/** The list filters by any campus key except "unknown", which the server does not take (Backend 8ef3c301). */
export function isFilterableCampus(key: string): boolean {
  return key !== NO_CAMPUS;
}

/**
 * A student with little activity gets the short story, which shows cards 1, 7
 * and 8 (Backend 8ef3c301, Irish 32bcb65c). The funnel counts a card as
 * reached once the student is at it or past it.
 */
export function storyLabel(story: string): string {
  if (story === 'full') return 'Full';
  if (story === 'short') return 'Short';
  return story;
}

export interface SplitRow extends WrappedAdminCounts {
  key: string;
  label: string;
  openedRate: number | null;
  finishedRate: number | null;
  sharedRate: number | null;
}

/**
 * One row per persona or campus, most students first. The "no campus" row goes
 * last whatever its size: it is the remainder, not a place.
 */
export function splitRows(
  groups: Record<string, WrappedAdminCounts>,
  labelOf: (key: string) => string
): SplitRow[] {
  return Object.entries(groups)
    .map(([key, counts]) => ({
      key,
      label: labelOf(key),
      have: counts.have,
      opened: counts.opened,
      finished: counts.finished,
      shared: counts.shared,
      openedRate: percentOf(counts.opened, counts.have),
      finishedRate: percentOf(counts.finished, counts.have),
      sharedRate: percentOf(counts.shared, counts.have),
    }))
    .sort((a, b) => {
      if ((a.key === NO_CAMPUS) !== (b.key === NO_CAMPUS)) return a.key === NO_CAMPUS ? 1 : -1;
      return b.have - a.have || a.label.localeCompare(b.label);
    });
}

// ── The student list's view, kept in the URL ───────────────────────────────

export const STUDENT_STATUSES: readonly WrappedStudentStatus[] = ['opened', 'not_opened', 'finished', 'shared'];

export const STUDENT_STATUS_LABELS: Record<WrappedStudentStatus, string> = {
  opened: 'Opened',
  not_opened: 'Not opened',
  finished: 'Finished',
  shared: 'Shared',
};

export const STUDENTS_PER_PAGE = 25;

export interface StudentView {
  status: WrappedStudentStatus | null;
  persona: string | null;
  campus: string | null;
  search: string;
  page: number;
}

/** The view a URL asks for. Anything it cannot read falls back to "all". */
export function readStudentView(params: Pick<URLSearchParams, 'get'>): StudentView {
  const status = params.get('status');
  const page = Number.parseInt(params.get('page') ?? '', 10);
  return {
    status: STUDENT_STATUSES.find((value) => value === status) ?? null,
    persona: params.get('persona') || null,
    campus: params.get('campus') || null,
    search: params.get('search') ?? '',
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** The query-string keys a new search deletes, so a narrower list opens on its first page. */
export const SEARCH_RESETS: readonly string[] = ['page'];

/** A filter change: written, and the page reset. */
export function filterUpdate(
  patch: Partial<Pick<StudentView, 'status' | 'persona' | 'campus'>>
): Record<string, string | null> {
  const updates: Record<string, string | null> = { page: null };
  for (const [key, value] of Object.entries(patch)) updates[key] = value ?? null;
  return updates;
}

export const CLEAR_FILTERS: Record<string, string | null> = {
  status: null,
  persona: null,
  campus: null,
  search: null,
  page: null,
};

export function pageUpdate(page: number): Record<string, string | null> {
  return { page: page > 1 ? String(page) : null };
}

export function isFiltered(view: StudentView): boolean {
  return Boolean(view.status || view.persona || view.campus || view.search.trim());
}

/** How far a student got, in words. */
export function progressText(student: Pick<WrappedAdminStudent, 'first_opened_at' | 'last_card' | 'finished_at'>): string {
  if (!student.first_opened_at) return 'Not opened';
  if (student.finished_at) return 'Finished';
  if (!student.last_card) return 'Opened';
  return `Card ${student.last_card} of ${STORY_CARDS}`;
}

const LAGOS_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Lagos',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "6 Nov, 13:05 WAT", or null for no time or one that does not parse. */
export function lagosTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${LAGOS_TIME.format(date)} WAT`;
}

/** The line under the page title: from when the opens are counted. */
export function trackingLine(trackingSince: string | null): string {
  const since = lagosTime(trackingSince);
  return since ? `Opens counted since ${since}. Opens before then were not recorded.` : 'No opens recorded yet.';
}

/** "Bar Finals 2026" from "bar-finals-2026"; any other key as sent. */
export function editionLabel(edition: string): string {
  return edition === 'bar-finals-2026' ? 'Bar Finals 2026' : edition;
}
