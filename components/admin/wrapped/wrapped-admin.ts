import { CAMPUS_NAMES, PERSONAS } from '@/lib/wrapped/copy';
import type { WrappedCampus, WrappedPersonaKey } from '@/lib/wrapped/types';
import type {
  WrappedAdminCounts,
  WrappedAdminStudent,
  WrappedAdminSummary,
  WrappedStoryFunnel,
  WrappedStudentStatus,
} from '@/types/wrapped-admin';

/**
 * The Wrapped admin page as data: the funnel, the two splits and the student
 * list's view, read from Backend's summary and student list (thread 384c,
 * e717a1af). Everything here is pure, so the page only draws.
 *
 * ── ONE FUNNEL PER STORY ───────────────────────────────────────────────────
 * Most students have the short story, which shows cards 1, 7 and 8, so one
 * funnel over both would count them at cards they never see (techlead's
 * review). Each story gets its own funnel from `reached_by_story`, and each
 * step says how many of that story's students got there, and how many of the
 * step before. A share of nothing is no share at all, so a zero base shows a
 * dash, never "0%" or "NaN%".
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

/** The cards each story shows (Backend 318a345a): the short story is for students with little activity. */
export const STORY_CARD_NUMBERS: Record<string, readonly number[]> = {
  full: [1, 2, 3, 4, 5, 6, 7, 8],
  short: [1, 7, 8],
};

/** Card 8 is the share card in both stories. */
function cardLabel(card: number): string {
  return card === STORY_CARDS ? 'Reached the share card' : `Reached card ${card}`;
}

/**
 * have → opened → each card the story shows → finished → shared, each step
 * against the story's own `have` and the step before.
 */
export function storyFunnelSteps(story: string, funnel: WrappedStoryFunnel): FunnelStep[] {
  const raw: { key: string; label: string; count: number }[] = [
    { key: 'have', label: 'Have this story', count: funnel.have },
    { key: 'opened', label: 'Opened it', count: funnel.opened },
  ];
  // The story's own cards, else whichever cards the server counted, in order.
  const cards =
    STORY_CARD_NUMBERS[story] ??
    Object.keys(funnel.reached)
      .map(Number)
      .filter((card) => Number.isInteger(card) && card > 0)
      .sort((a, b) => a - b);
  for (const card of cards) {
    raw.push({ key: `card-${card}`, label: cardLabel(card), count: funnel.reached[String(card)] ?? 0 });
  }
  raw.push({ key: 'finished', label: 'Finished', count: funnel.finished });
  raw.push({ key: 'shared', label: 'Shared', count: funnel.shared });

  return raw.map((step, index) => ({
    ...step,
    ofHave: percentOf(step.count, funnel.have),
    ofPrevious: index === 0 ? null : percentOf(step.count, raw[index - 1].count),
  }));
}

export interface StoryFunnel {
  story: string;
  title: string;
  /** What the story is, under its title. */
  note: string;
  have: number;
  steps: FunnelStep[];
}

const STORY_NOTES: Record<string, string> = {
  full: 'All eight cards.',
  short: 'For students with little activity: cards 1, 7 and the share card.',
};

/** One funnel per story, the full story first. An edition with no per-story counts shows none. */
export function storyFunnels(summary: WrappedAdminSummary): StoryFunnel[] {
  const stories = summary.reached_by_story ?? {};
  const order = (story: string) => (story === 'full' ? 0 : story === 'short' ? 1 : 2);
  return Object.entries(stories)
    .sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b))
    .map(([story, funnel]) => ({
      story,
      title: `${storyLabel(story)} story`,
      note: STORY_NOTES[story] ?? '',
      have: funnel.have,
      steps: storyFunnelSteps(story, funnel),
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
