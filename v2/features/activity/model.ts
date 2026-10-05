import { parsePastedContent, stripContextTags, stripPastedTags } from '@/lib/utils';
import type { ActivityMessage } from '@/types/chat';

/**
 * activity/model — the pure half of `/activity`: what a past question reads as
 * in a row, and how the rows fall into days and conversations. No JSX, no
 * hooks, and no clock read of its own (`now` and the time zone are passed in),
 * so `model.test.ts` covers all of it and the screen stays a renderer.
 *
 * ── WHAT A ROW SAYS ────────────────────────────────────────────────────────
 * A stored question carries machinery the reader never typed: the content
 * tags a chat started from a case or a note opens with (`<case_slug>`), the
 * `<pasted_content>` blocks the composer wraps a paste in, and the
 * `<attached_image name="…" />` marker the server writes for each file (see
 * `UserMessageRow`, which strips the same marker from the bubble). v1 printed
 * a paste as a literal "[pasted content]" in the middle of the sentence. Here
 * the typed words are the preview, and a paste or a file is counted beside it.
 *
 * ── HOW THE ROWS GROUP ─────────────────────────────────────────────────────
 * By the reader's LOCAL day, newest first, then by RUN: consecutive questions
 * of one day that belong to one conversation share one conversation heading.
 * A study session of fifteen follow-ups is one heading and fifteen lines, not
 * fifteen copies of the same title. A run is broken by a question from another
 * conversation, so the order on screen is always the order they were asked.
 */

/** The server's file marker: `<attached_image name="a.png" />`. */
const ATTACHMENT_MARKER = /\s*<attached_(?:image|document)\b[^>]*\/>/g;

/** A trailing ellipsis, as the server cuts a long conversation title. */
const TRAILING_ELLIPSIS = /\s*(?:\.{3}|…)\s*$/;

export interface QuestionPreview {
  /** The typed words on one line, or '' when the question was only a paste or a file. */
  text: string;
  /** How many pasted blocks the question carried. */
  pastes: number;
  /** How many files the reader attached (server-made page pictures excluded). */
  files: number;
}

/** The words a reader typed, with the paste and file machinery counted, not printed. */
export function questionPreview(message: Pick<ActivityMessage, 'content' | 'metadata'>): QuestionPreview {
  const stripped = stripContextTags(message.content.replace(ATTACHMENT_MARKER, ''));
  const { pastedTexts, remainingText } = parsePastedContent(stripped);
  const files = (message.metadata?.files ?? []).filter(
    (file) => file.rendered_from_file_id === undefined,
  ).length;
  return {
    text: collapseWhitespace(remainingText),
    pastes: pastedTexts.length,
    files,
  };
}

export interface AttachmentMark {
  kind: 'pastes' | 'files';
  label: string;
}

/** The quiet line under a question: "Pasted text", "2 files". Empty when it carried neither. */
export function attachmentMarks({ pastes, files }: QuestionPreview): AttachmentMark[] {
  const marks: AttachmentMark[] = [];
  if (pastes > 0) {
    marks.push({ kind: 'pastes', label: pastes === 1 ? 'Pasted text' : `${pastes} pasted texts` });
  }
  if (files > 0) {
    marks.push({ kind: 'files', label: files === 1 ? '1 file' : `${files} files` });
  }
  return marks;
}

/** The conversation title as the reader should see it: no tags, one line. */
export function conversationTitle(title: string): string {
  return collapseWhitespace(stripContextTags(stripPastedTags(title))) || 'Untitled chat';
}

/**
 * Whether a conversation's title is just this question again. The server
 * names a new chat after its first question, cut at about fifty characters
 * with "...", so the opener of a chat and its title say the same thing.
 */
export function titleRepeatsQuestion(title: string, question: string): boolean {
  const stem = normalise(title.replace(TRAILING_ELLIPSIS, ''));
  return stem.length > 0 && normalise(question).startsWith(stem);
}

/**
 * The calendar day an instant (an ISO string or epoch milliseconds) falls on,
 * in `timeZone` (the reader's own when omitted), as `YYYY-MM-DD`; `null` for an
 * unreadable time.
 */
export function dayKey(instant: string | number, timeZone?: string): string | null {
  const time = typeof instant === 'number' ? instant : Date.parse(instant);
  if (Number.isNaN(time)) return null;
  // `en-CA` formats a date as `YYYY-MM-DD`, which is also a sortable key.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(time);
}

/** Whole days from day `from` to day `to` (both `YYYY-MM-DD`). */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' });
const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * The heading for a day: "Today", "Yesterday", the weekday inside the last
 * week, then "12 September", with the year once it is not this year.
 */
export function dayLabel(key: string, todayKey: string): string {
  const ago = daysBetween(key, todayKey);
  if (ago === 0) return 'Today';
  if (ago === 1) return 'Yesterday';
  // The key is a calendar date, so it is formatted as midnight UTC in UTC: the
  // label can never slide to a neighbouring day.
  const date = Date.parse(`${key}T00:00:00Z`);
  if (ago > 1 && ago < 7) return WEEKDAY.format(date);
  return key.slice(0, 4) === todayKey.slice(0, 4)
    ? DAY_MONTH.format(date)
    : DAY_MONTH_YEAR.format(date);
}

/** The time of day a question was asked ("2:05 pm"), in `timeZone`. */
export function clockTime(iso: string, timeZone?: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(time);
}

export interface ActivityQuestion {
  id: number;
  preview: QuestionPreview;
  /** "2:05 pm". */
  time: string;
  /** The full timestamp, for `<time dateTime>`. */
  createdAt: string;
}

export interface ActivityRun {
  /** Stable key: the run's newest question id. */
  key: string;
  conversationId: string;
  title: string;
  /**
   * `true` when the run is one question whose title only repeats it (a chat's
   * opener on its own): the row then IS the heading, and the title is not
   * printed twice.
   */
  merged: boolean;
  /**
   * `true` when the title only repeats one of the run's questions (a chat
   * named after its opener, with follow-ups). The title is then not printed:
   * the first question leads the run instead, so no line says the same thing
   * twice (techlead 191c4346, 5 October 2026).
   */
  titleRepeats: boolean;
  questions: ActivityQuestion[];
}

export interface ActivityDay {
  key: string;
  label: string;
  runs: ActivityRun[];
}

/**
 * Days, then runs, from questions already sorted newest first (the order the
 * server returns them). A question with an unreadable time is dropped rather
 * than filed under a day it did not happen on.
 */
export function groupActivity(
  messages: readonly ActivityMessage[],
  { now, timeZone }: { now: number; timeZone?: string },
): ActivityDay[] {
  const todayKey = dayKey(now, timeZone);
  const days: ActivityDay[] = [];

  for (const message of messages) {
    const key = dayKey(message.created_at, timeZone);
    if (key === null || todayKey === null) continue;

    let day = days.at(-1);
    if (day?.key !== key) {
      day = { key, label: dayLabel(key, todayKey), runs: [] };
      days.push(day);
    }

    const question: ActivityQuestion = {
      id: message.id,
      preview: questionPreview(message),
      time: clockTime(message.created_at, timeZone),
      createdAt: message.created_at,
    };

    const run = day.runs.at(-1);
    if (run?.conversationId === message.conversation.uuid) {
      run.questions.push(question);
      run.merged = false;
      run.titleRepeats ||= titleRepeatsQuestion(run.title, question.preview.text);
    } else {
      const title = conversationTitle(message.conversation.title);
      const repeats = titleRepeatsQuestion(title, question.preview.text);
      day.runs.push({
        key: String(message.id),
        conversationId: message.conversation.uuid,
        title,
        merged: repeats,
        titleRepeats: repeats,
        questions: [question],
      });
    }
  }

  return days;
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function normalise(text: string): string {
  return collapseWhitespace(text).toLowerCase();
}
