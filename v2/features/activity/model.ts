import { parsePastedContent, stripContextTags, stripPastedTags } from '@/lib/utils';
import type { ActivityMessage } from '@/types/chat';

/**
 * activity/model — the pure half of `/activity`: what a past question reads as
 * in a row of the table. No JSX, no hooks, and no clock read of its own (`now`
 * and the time zone are passed in), so `model.test.ts` covers all of it and the
 * screen stays a renderer.
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
 * ── WHEN ───────────────────────────────────────────────────────────────────
 * The date and the time are the reader's LOCAL day and clock: "Today",
 * "Yesterday", then "28 Sep", with the year once it is not this year. A table
 * column of dates reads best when every date has the same shape, so the
 * weekday names the old day headings used are gone.
 */

/** The server's file marker: `<attached_image name="a.png" />`. */
const ATTACHMENT_MARKER = /\s*<attached_(?:image|document)\b[^>]*\/>/g;

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

/** The quiet marks beside a question: "Pasted text", "2 files". Empty when it carried neither. */
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

/**
 * The months by hand, not `Intl`: `en-GB` prints September as "Sep" in some
 * engines and "Sept" in others, and one column must not mix the two.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The date column for a day (`YYYY-MM-DD`): "Today", "Yesterday", then
 * "28 Sep", with the year once it is not this year ("31 Dec 2025").
 */
export function askedDate(key: string, todayKey: string): string {
  const ago = daysBetween(key, todayKey);
  if (ago === 0) return 'Today';
  if (ago === 1) return 'Yesterday';
  const [year, month, day] = key.split('-');
  const dayMonth = `${Number(day)} ${MONTHS[Number(month) - 1]}`;
  return year === todayKey.slice(0, 4) ? dayMonth : `${dayMonth} ${year}`;
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

/** One row of the activity table, ready to print. */
export interface ActivityRow {
  id: number;
  /** The conversation's uuid, for the `/c/{uuid}` link. */
  conversationId: string;
  /** The conversation's title, cleaned for display. */
  chatTitle: string;
  preview: QuestionPreview;
  marks: AttachmentMark[];
  /** "Today", "28 Sep", "31 Dec 2025"; '' for an unreadable time. */
  date: string;
  /** "2:05 pm"; '' for an unreadable time. */
  time: string;
  /** The full timestamp, for `<time dateTime>`. */
  createdAt: string;
}

/**
 * A question as a row of the table, dated in `timeZone` (the reader's own
 * when omitted) against `now`. A row with an unreadable time keeps its place
 * with the date and time left blank: it is still a question the reader asked.
 */
export function activityRow(
  message: ActivityMessage,
  { now, timeZone }: { now: number; timeZone?: string },
): ActivityRow {
  const preview = questionPreview(message);
  const key = dayKey(message.created_at, timeZone);
  const todayKey = dayKey(now, timeZone);
  return {
    id: message.id,
    conversationId: message.conversation.uuid,
    chatTitle: conversationTitle(message.conversation.title),
    preview,
    marks: attachmentMarks(preview),
    date: key !== null && todayKey !== null ? askedDate(key, todayKey) : '',
    time: clockTime(message.created_at, timeZone),
    createdAt: message.created_at,
  };
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
