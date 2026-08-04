/**
 * Presentation helpers for the Channels feature — avatar initials, message
 * timestamps and mention parsing. Kept UI-agnostic so components stay lean.
 */

import {
  format,
  formatDistanceToNow,
  isSameYear,
  isToday,
  isYesterday,
} from 'date-fns';

import type { MessageMetadata } from '@/types/collab';

/** Up to two uppercase initials from a display name. */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * date-fns `format` and `formatDistanceToNow` THROW `RangeError: Invalid time
 * value` on an unparseable date, and every caller below runs inside render —
 * so one malformed timestamp from the wire takes down the whole screen rather
 * than blanking one line. These formatters are therefore total: an unreadable
 * date renders as nothing.
 */
function parseServerDate(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Short clock time for a message bubble, e.g. "10:32 AM". */
export function formatMessageTime(iso: string): string {
  const date = parseServerDate(iso);
  return date === null ? '' : format(date, 'h:mm a');
}

/** Full timestamp for tooltips, e.g. "Jul 12, 2026, 10:32 AM". */
export function formatFullTimestamp(iso: string): string {
  const date = parseServerDate(iso);
  return date === null ? '' : format(date, 'MMM d, yyyy, h:mm a');
}

/** Human day separator: "Today", "Yesterday", or a dated label. */
export function formatDayLabel(iso: string): string {
  const date = parseServerDate(iso);
  if (date === null) return '';
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isSameYear(date, new Date())) return format(date, 'EEEE, MMMM d');
  return format(date, 'MMMM d, yyyy');
}

/** Compact relative age, e.g. "5 minutes ago". Used on list cards / detail. */
export function formatRelativeTime(iso: string): string {
  const date = parseServerDate(iso);
  return date === null ? '' : formatDistanceToNow(date, { addSuffix: true });
}

/** Whether two ISO timestamps fall on the same calendar day. */
export function isSameCalendarDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

/******************************************************************************
                              Mentions
******************************************************************************/

/** A parsed message-content segment: plain text or a resolved @mention. */
export type MessageSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string; label: string };

/**
 * The mention-token shape (`@handle`). Callers that scan with `matchAll` should
 * request a fresh instance via {@link mentionTokenRegex} — the global flag
 * carries `lastIndex` state, so a shared instance is unsafe across scans.
 */
export function mentionTokenRegex(): RegExp {
  return /@[a-z0-9._]+/gi;
}

/** The valid handle forms for a member name (spaceless and dotted). */
function handleForms(name: string): string[] {
  const lower = name.toLowerCase().trim();
  return [lower.replace(/\s+/g, ''), lower.replace(/\s+/g, '.')];
}

/**
 * Resolved `@handle` → display name, the single source of truth shared by the
 * plain-text ({@link parseMessageContent}) and markdown (Lawexa) renderers. For
 * every `metadata.mentions` name both {@link handleForms} (spaceless + dotted)
 * are added; `@lawexa` is added when `metadata.lawexa_mentioned`.
 */
export function buildMentionHandleMap(
  metadata: MessageMetadata
): Map<string, string> {
  const handles = new Map<string, string>();
  // `mentions` is contractual on a channel message, but this map is the last
  // stop before a render: a payload that omits it must degrade to "no
  // mentions", never take the surface down.
  for (const mention of metadata.mentions ?? []) {
    for (const form of handleForms(mention.name)) {
      handles.set(form, mention.name);
    }
  }
  if (metadata.lawexa_mentioned) {
    handles.set('lawexa', 'Lawexa');
  }
  return handles;
}

/**
 * Split message content into text + mention segments. Only handles that the
 * server actually resolved (`metadata.mentions`) — plus `@lawexa` when
 * `lawexa_mentioned` — are highlighted; unresolved `@tokens` stay plain text,
 * matching the server's "never guess" mention rule.
 */
export function parseMessageContent(
  content: string,
  metadata: MessageMetadata
): MessageSegment[] {
  const handles = buildMentionHandleMap(metadata);

  if (handles.size === 0) {
    return content ? [{ type: 'text', value: content }] : [];
  }

  const segments: MessageSegment[] = [];
  let lastIndex = 0;
  for (const match of content.matchAll(mentionTokenRegex())) {
    const token = match[0];
    const index = match.index ?? 0;
    const label = handles.get(token.slice(1).toLowerCase());
    if (!label) continue;

    if (index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, index) });
    }
    segments.push({ type: 'mention', value: token, label });
    lastIndex = index + token.length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) });
  }
  return segments;
}
