import type { Notification } from '@/types/notification';

/**
 * Notification PRESENTATION — the one place that reads an inbox row's
 * mixed-vintage fields and says what the row MEANS: the three things the bell
 * renders (a mark, a title, a preview), the one thing a click needs (a
 * destination), and the one thing the cache needs ({@link
 * notificationChannelUuid} — which channel the row points into). Pure and
 * React-free, so the rules below are readable and checkable without a
 * component around them.
 *
 * ── THE MIXED INBOX, WHICH IS THE WHOLE PROBLEM ───────────────────────────
 * The backend started filling `title`, `message` and `icon` for channel
 * notifications on 2026-08-04, and did NOT backfill. Every row created before
 * that deploy is wordless: empty `title`, null `message`, null `icon`, and
 * none of the `channel_uuid` / `message_uuid` / `space_uuid` ids. Both kinds
 * will sit in the same list for a long time.
 *
 * So there are exactly two honest sources of copy, in this order:
 *  1. WHAT THE SERVER SAID. A non-empty `title` ("Ada mentioned you in
 *     #contract-law") and `message` (the preview) are rendered verbatim.
 *  2. WHAT THE ROW IS. `type` is populated on every row ever created, and it
 *     is real data — not a guess — so a wordless row is labelled with its own
 *     KIND ("You were mentioned") and simply has no preview. It says less
 *     than a new row; it never says something that is not true.
 *
 * The literal fallback string 'Notification' now needs `type` to be empty as
 * well, which no row is. That is the string the owner objected to, and it is
 * the difference between a last-resort and a default.
 *
 * ── WHY `type` IS NORMALISED RATHER THAN MATCHED ──────────────────────────
 * The same notification kind is spelled two ways on two surfaces (digest §F.8):
 * the REST inbox returns class names (`ChannelMentionNotification`) while the
 * broadcast payload uses snake case (`channel_mention`, `channel_reply`).
 * Neither vocabulary is ours to freeze, so both are folded to one token first
 * and every rule below reads the token. A kind nobody anticipated still gets a
 * legible label out of {@link humanizeToken} instead of falling off a map.
 *
 * ── ONE KIND NEEDS ITS ADDRESS TRANSLATED (2026-08-05) ────────────────────
 * `channel_quiz_live` arrives with an `action_url` written in the BACKEND's
 * routing vocabulary rather than this app's. It is the only row so far whose
 * link cannot be followed as sent, and {@link toAppPath} is where that one
 * rewrite lives — see its docblock for what the lobby's real address is and how
 * the channel page answers it.
 */

/** The row's visual class. One glyph per kind — never a second accent colour. */
export type NotificationMark = 'mention' | 'reply' | 'invite' | 'quiz' | 'general';

/**
 * Where a click goes. `none` is a real answer: a row may carry no
 * `action_url` at all, and inventing a destination for it (v1 sends those to
 * `/notifications/{id}`) would eject the reader from the v2 shell into v1.
 */
export type NotificationDestination =
  | { readonly kind: 'internal'; readonly href: string }
  | { readonly kind: 'external'; readonly href: string }
  | { readonly kind: 'none' };

export interface NotificationPresentation {
  readonly mark: NotificationMark;
  /** Never empty. Server copy when there is any, else the row's own kind. */
  readonly title: string;
  /** The server's preview, or null — never a manufactured stand-in. */
  readonly preview: string | null;
  readonly destination: NotificationDestination;
}

const NO_DESTINATION: NotificationDestination = { kind: 'none' };

/** Last resort, reachable only if `type` is empty too (no row is). */
const UNLABELLED_TITLE = 'Notification';

/**
 * Sentence-style labels for the kinds we know, so a wordless row still reads
 * like a notification rather than like a database enum. Keyed by the
 * normalised token, so BOTH vocabularies land on the same entry.
 */
const KIND_TITLES: Readonly<Record<string, string>> = {
  channel_mention: 'You were mentioned',
  channel_reply: 'Someone replied to you',
  channel_invite: 'Channel invitation',
  space_invite: 'Space invitation',
  organization_invite: 'Organization invitation',
  channel_quiz_live: 'A quiz is live',
};

function trimmedOrNull(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

/**
 * Fold either vocabulary onto one snake-case token:
 * `ChannelMentionNotification` → `channel_mention`, `channel_reply` →
 * `channel_reply`, `Radar Report` → `radar_report`.
 */
function normalizeToken(value: string): string {
  return value
    .replace(/Notification$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

/** `channel_mention` → `Channel mention`; null when there is nothing to say. */
function humanizeToken(token: string): string | null {
  const words = token.replace(/_/g, ' ').trim();
  if (!words) return null;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Substring rules, not equality: they hold for `mention`, `channel_mention`
 * and `ChannelMentionNotification` alike, which is what lets one function read
 * both the `icon` word and the `type` token.
 */
function markFromToken(token: string): NotificationMark | null {
  if (token.includes('mention')) return 'mention';
  if (token.includes('repl')) return 'reply';
  if (token.includes('invit')) return 'invite';
  // Matches the server's own `icon: "quiz"` AND the kind token
  // `channel_quiz_live`, which is the point of reading both through one
  // function: the mark is right whichever vocabulary a row arrives in.
  if (token.includes('quiz')) return 'quiz';
  return null;
}

/**
 * TRANSLATE THE BACKEND'S DEEP LINK INTO AN ADDRESS THIS APP HAS.
 *
 * `channel_quiz_live` ships `action_url: /channels/{c}/quiz-games/{g}` — a path
 * shape from the API's own routing table, and one no route in this app answers.
 * Following it verbatim would 404 the reader out of the very lobby the
 * notification exists to open, and adding a route to match it would be building
 * a second address for a surface that already has one.
 *
 * The lobby is a MODE over the channel, not a page away from it (see
 * `GameOverlay` for why), and its address is `?game={uuid}` on the channel:
 * `app/v2/(collab)/channels/[channelId]/page.tsx` reads `?game=` from the
 * navigation URL and hands it to `ChannelScreen` as `initialGameUuid`, which
 * arms the `game` URL overlay and mounts the overlay in the first frame. So a
 * pushed `/channels/{c}?game={g}` opens the lobby exactly as pressing Join in
 * the room does, with the chat mounted behind it.
 *
 * Anything that is not that shape is returned untouched — this rewrites one
 * known path and guesses at nothing. A query string on the incoming link is
 * dropped with the path it belonged to: the destination reads `?game=` and
 * `?tab=`/`?m=`, none of which a lobby link has any reason to carry.
 */
const BACKEND_QUIZ_GAME_PATH = /^\/channels\/([^/]+)\/quiz-games\/([^/]+)\/?$/;

function toAppPath(href: string): string {
  const match = BACKEND_QUIZ_GAME_PATH.exec(href.split(/[?#]/)[0]);
  if (!match) return href;
  return `/channels/${match[1]}?game=${match[2]}`;
}

/**
 * A click destination, classified so the caller never has to parse a URL.
 *
 * A leading `//` is protocol-relative — an OFF-SITE address wearing a path's
 * clothes — so it is refused before the `startsWith('/')` test can adopt it.
 * Anything that is neither a rooted path nor an absolute http(s) URL is `none`
 * rather than a navigation attempt at a string we do not understand.
 *
 * An INTERNAL path goes through {@link toAppPath} on the way out, because the
 * backend names one surface by a route this app does not have. External URLs
 * are left exactly as they are — they are not ours to rewrite.
 */
function resolveDestination(actionUrl: string | null): NotificationDestination {
  const href = trimmedOrNull(actionUrl);
  if (!href || href.startsWith('//')) return NO_DESTINATION;
  if (href.startsWith('/')) return { kind: 'internal', href: toAppPath(href) };
  if (/^https?:\/\//i.test(href)) return { kind: 'external', href };
  return NO_DESTINATION;
}

/**
 * What KIND of thing this row is.
 *
 * Prefers the server's `icon` (`mention` / `reply` / `invite` — its own
 * classification of the row) and falls back to the kind token, so a pre-deploy
 * channel row is still classified correctly from its `type` even though its
 * `icon` is null. Exported because the mark is not only a glyph: it is also
 * what tells `settle.ts` whether a channel read could possibly have cleared
 * this row.
 */
export function notificationMark(notification: Notification): NotificationMark {
  return (
    markFromToken(normalizeToken(notification.icon ?? '')) ??
    markFromToken(normalizeToken(notification.type)) ??
    'general'
  );
}

/**
 * WHICH CHANNEL this row points into, or null when it points into none — or
 * points into one from before the ids existed and left no link to say which.
 *
 * `channel_uuid` is the direct answer on every row created since 2026-08-04.
 * A pre-deploy row has no such field, but it does carry the `action_url` it
 * has always been rendered from (digest §F.8), and that link's own path names
 * the channel: `/channels/{uuid}?m=…`. Reading it is not an inference about
 * the row — it is the row's own address, the one a click already follows.
 *
 * Null therefore means exactly one thing: this row cannot be attributed to a
 * channel by any evidence it carries. Callers must treat that as unknown, not
 * as "no".
 */
export function notificationChannelUuid(
  notification: Notification,
): string | null {
  const stamped = trimmedOrNull(notification.channel_uuid);
  if (stamped) return stamped;
  const destination = resolveDestination(notification.action_url);
  if (destination.kind !== 'internal') return null;
  return /^\/channels\/([^/?#]+)/.exec(destination.href)?.[1] ?? null;
}

/** Present one inbox row. */
export function presentNotification(
  notification: Notification,
): NotificationPresentation {
  const typeToken = normalizeToken(notification.type);
  const serverTitle = trimmedOrNull(notification.title);

  return {
    mark: notificationMark(notification),
    title:
      serverTitle ??
      KIND_TITLES[typeToken] ??
      humanizeToken(typeToken) ??
      UNLABELLED_TITLE,
    preview: trimmedOrNull(notification.message),
    destination: resolveDestination(notification.action_url),
  };
}
