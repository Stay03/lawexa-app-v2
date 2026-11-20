import type { BlankEdit, PrivateItemKind, TemplateBlank, TemplateSegment, UseItem } from '@/types/private-items';

/**
 * The pure parts of My templates and My skills (Arthur agreed the pages, 19
 * November 2026, thread 9ae498ae; Backend's shapes the same day).
 */

/** Pull touching text segments together, so a removed blank leaves one run of text. */
function joinText(segments: TemplateSegment[]): TemplateSegment[] {
  const out: TemplateSegment[] = [];
  for (const segment of segments) {
    const last = out.at(-1);
    if (segment.type === 'text' && last?.type === 'text') out[out.length - 1] = { type: 'text', text: last.text + segment.text };
    else if (segment.type === 'text' && segment.text === '') continue;
    else out.push(segment);
  }
  return out;
}

/**
 * The segments after the edits, in order, the way the server applies them on
 * save, so "Check the blanks" shows each change before anything is sent.
 */
export function applyBlankEdits(segments: readonly TemplateSegment[], edits: readonly BlankEdit[]): TemplateSegment[] {
  let current: TemplateSegment[] = [...segments];
  for (const edit of edits) {
    if (edit.op === 'rename') {
      current = current.map((s) => (s.type === 'blank' && s.name === edit.from ? { type: 'blank', name: edit.to } : s));
    } else if (edit.op === 'merge') {
      const merged = new Set(edit.blanks);
      current = current.map((s) => (s.type === 'blank' && merged.has(s.name) ? { type: 'blank', name: edit.to } : s));
    } else if (edit.op === 'remove') {
      current = joinText(current.map((s) => (s.type === 'blank' && s.name === edit.blank ? { type: 'text', text: edit.text } : s)));
    } else if (edit.passage) {
      const next: TemplateSegment[] = [];
      for (const s of current) {
        if (s.type !== 'text' || !s.text.includes(edit.passage)) {
          next.push(s);
          continue;
        }
        s.text.split(edit.passage).forEach((part, index) => {
          if (index > 0) next.push({ type: 'blank', name: edit.blank });
          next.push({ type: 'text', text: part });
        });
      }
      current = joinText(next);
    }
  }
  return current;
}

const SNIPPET_SIDE = 28;

/** Each blank in the segments, how often it appears, and up to three short snippets around it. */
export function blanksOf(segments: readonly TemplateSegment[]): TemplateBlank[] {
  const found = new Map<string, TemplateBlank>();
  segments.forEach((segment, index) => {
    if (segment.type !== 'blank') return;
    const before = segments[index - 1];
    const after = segments[index + 1];
    const left = before?.type === 'text' ? before.text.slice(-SNIPPET_SIDE).replace(/\s+/g, ' ') : '';
    const right = after?.type === 'text' ? after.text.slice(0, SNIPPET_SIDE).replace(/\s+/g, ' ') : '';
    const row = found.get(segment.name) ?? { name: segment.name, count: 0, examples: [] };
    row.count += 1;
    if (row.examples.length < 3) row.examples.push(`…${left}[${segment.name}]${right}…`);
    found.set(segment.name, row);
  });
  return [...found.values()];
}

/** A blank's name as the server takes it: capitals, digits, spaces, _ ' -. */
export function blankName(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9 _'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "Used today", "Used 3 days ago", "Never used": the row's quiet line. */
export function usedLine(lastUsedAt: string | null | undefined, now: number): string {
  if (!lastUsedAt) return 'Not used yet';
  const days = Math.floor((now - Date.parse(lastUsedAt)) / 86_400_000);
  if (Number.isNaN(days)) return 'Not used yet';
  if (days <= 0) return 'Used today';
  if (days === 1) return 'Used yesterday';
  if (days < 30) return `Used ${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'Used a month ago' : `Used ${months} months ago`;
}

const SHORT_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** "19 Nov 2026"; empty for a date it cannot read. */
export function shortDate(iso: string): string {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? '' : SHORT_DATE.format(time);
}

/** The line a Space chat's sender sees before they use their own item there (Techlead, 19 November 2026). */
export function sharedAnswerLine(kind: PrivateItemKind): string {
  return kind === 'template'
    ? "Everyone in this chat sees Lawexa's answer, which can include this template's wording."
    : "Everyone in this chat sees Lawexa's answer, which can follow this skill's steps.";
}

/** The address param "Use in chat" opens a box with: `?use=template:{uuid}` or `?use=skill:{uuid}`. */
export const USE_PARAM = 'use';

/** `template:{uuid}` or `skill:{uuid}`, else null. */
export function parseUse(raw: string | null): UseItem | null {
  const match = /^(template|skill):([0-9a-f-]{36})$/i.exec(raw ?? '');
  return match ? { kind: match[1].toLowerCase() as UseItem['kind'], uuid: match[2].toLowerCase() } : null;
}
