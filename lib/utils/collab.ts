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

/** What one resolved `@handle` renders as, and who it names. */
export interface MentionChip {
  /** The text the chip shows after the `@` — the mentioned person's DISPLAY
   *  NAME, or their handle when the name does not identify them on its own.
   *  See {@link buildMentionChips}. */
  label: string;
  /** The mentioned member, so a renderer can decide "this one is me" by
   *  identity instead of by comparing display-name strings — which two people
   *  called "Ada Obi" would both satisfy. `null` for the `@lawexa` chip. */
  uuid: string | null;
  /** The unique handle the server actually resolved, when it recorded one —
   *  the ONE fact that separates two identically-named people. `null` on
   *  pre-2026-08-05 history and on `@lawexa`. */
  username: string | null;
}

/**
 * A parsed message-content segment: plain text, a resolved @mention, or a link.
 *
 * A link carries both halves because they differ: `value` is what the reader
 * sees (`www.lawexa.com`, as typed) and `href` is where the tap goes
 * (`https://www.lawexa.com`, with the scheme we supplied).
 */
export type MessageSegment =
  | { type: 'text'; value: string }
  | { type: 'link'; value: string; href: string }
  | ({ type: 'mention'; value: string } & MentionChip);

/**
 * A web address inside message text — an explicit scheme, or a `www.` host.
 *
 * ── WHAT IS DELIBERATELY NOT MATCHED, AND WHY ──────────────────────────────
 * A NAKED DOMAIN. `lawexa.com` on its own stays text. Deciding that it is an
 * address means also deciding that `Order 5 r.2` and `s.14(1)` are not, and in
 * a legal product a false link inside a citation is worse than a missing one.
 *
 * `www.` IS matched, and the first version of this was wrong to lump the two
 * together (@arthur tested it with `www.lawexa.com` on 2026-08-08, minutes
 * after it shipped). Nobody types `www.` by accident and no citation format
 * contains it, so the prefix is the writer saying "address" as clearly as a
 * scheme does. It is a signal, where a naked domain is a guess.
 *
 * A second dot is required after `www.`, so `www.lawexa` — not a public host —
 * stays text while `www.lawexa.com` does not.
 *
 * ── THE SCHEME RULE IS SECURITY, NOT SCOPE ─────────────────────────────────
 * This runs over text a stranger typed and the output becomes an `href`, so a
 * pattern loose enough to admit `javascript:` or `data:` would hand every
 * member a script-injection primitive. Matching only `https?` — and SUPPLYING
 * `https://` ourselves for the `www.` case — means a dangerous scheme cannot be
 * produced at all. That is a stronger guarantee than sanitising afterwards.
 *
 * ── EMAILS ARE THE THIRD ALTERNATIVE (@arthur, 2026-08-08) ─────────────────
 * "Emails should open mail app." A plain address left the reader copying it by
 * hand, which is the complaint this whole change started from, one step along.
 *
 * ORDER INSIDE THIS PATTERN IS LOad-BEARING. The address alternatives come
 * first, so `www.lawexa.com` is claimed as a link; the email alternative then
 * catches `ada@www.x.com` whole, rather than leaving the name behind and
 * linking the host. Both shapes are covered by one left-to-right scan with no
 * second pass to keep in step.
 *
 * Global, so callers must request a fresh instance — `lastIndex` is stateful.
 */
function linkTokenRegex(): RegExp {
  return /(?:https?:\/\/|\bwww\.)[^\s<>]+|[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;
}

/**
 * Give back the trailing characters that belong to the SENTENCE, not the URL.
 *
 * "See https://lawexa.com/cases." ends in a full stop the reader wrote, and
 * swallowing it produces a link that 404s. Brackets are counted rather than
 * stripped, because a closing paren is only sentence punctuation when the URL
 * did not open one itself — Wikipedia addresses like
 * `.../wiki/Mandamus_(law)` are common enough in our corpus to matter.
 */
function trimSentencePunctuation(raw: string): string {
  let url = raw;
  while (url.length > 1) {
    const last = url[url.length - 1];
    if ('.,;:!?"\''.includes(last)) {
      url = url.slice(0, -1);
      continue;
    }
    if (last === ')' || last === ']') {
      const open = last === ')' ? '(' : '[';
      const opened = url.split(open).length - 1;
      const closed = url.split(last).length - 1;
      if (closed > opened) {
        url = url.slice(0, -1);
        continue;
      }
    }
    break;
  }
  return url;
}

/**
 * Split a run of plain text into text and link segments.
 *
 * Only ever applied to text that mention-scanning has already claimed its share
 * of, so a handle can never be swallowed by a URL or the other way round.
 */
function splitLinks(value: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(linkTokenRegex())) {
    const start = match.index;
    if (start === undefined) continue;
    const token = trimSentencePunctuation(match[0]);
    if (token.length === 0) continue;

    // An email is anything the scan claimed that carries an `@` and no scheme.
    // Checked before the `www.` branch because `ada@www.x.com` satisfies both
    // readings and only one of them is right.
    const isEmail = !/^https?:\/\//i.test(token) && token.includes('@');

    const schemeless = !isEmail && /^www\./i.test(token);
    if (schemeless) {
      // `www.lawexa` is not a public host. Require the second dot before calling
      // a schemeless token an address; a scheme needs no such proof.
      if ((token.match(/\./g)?.length ?? 0) < 2) continue;
      // `ada@www.x.com` is an EMAIL, and `\b` alone happily matches the `www.`
      // inside it — which would have linked the tail of somebody's address and
      // left the name behind as text. Checked by looking at the character
      // before rather than with a lookbehind: a lookbehind that an older engine
      // cannot parse takes the whole module down at load, and a link nicety is
      // not worth that risk.
      const before = start > 0 ? value[start - 1] : '';
      if (before === '@' || before === '.') continue;
    }

    if (start > lastIndex) {
      segments.push({ type: 'text', value: value.slice(lastIndex, start) });
    }
    // WE supply the scheme in both schemeless cases, so it is always one we
    // chose — the token can never contribute one, which is what keeps
    // `javascript:` unreachable no matter what a stranger types.
    segments.push({
      type: 'link',
      value: token,
      href: isEmail
        ? `mailto:${token}`
        : schemeless
          ? `https://${token}`
          : token,
    });
    lastIndex = start + token.length;
  }

  if (lastIndex < value.length) {
    segments.push({ type: 'text', value: value.slice(lastIndex) });
  }
  return segments;
}

/**
 * The mention-token shape (`@handle`). Callers that scan with `matchAll` should
 * request a fresh instance via {@link mentionTokenRegex} — the global flag
 * carries `lastIndex` state, so a shared instance is unsafe across scans.
 *
 * A username is `[a-z0-9_]` only, but `.` stays in the class because messages
 * written before 2026-08-05 tag people by a DOTTED slug of their display name
 * (`@ada.obi`) and those tokens must still resolve. {@link resolveMentionToken}
 * is what tells a dot inside an old handle from a full stop after a new one.
 */
export function mentionTokenRegex(): RegExp {
  return /@[a-z0-9._]+/gi;
}

/**
 * The handle forms a DISPLAY NAME used to resolve under — lowercased with
 * spaces removed, and the same with spaces → `.`.
 *
 * HISTORY ONLY. The server stopped matching these on 2026-08-05 (digest §F.19);
 * they survive here because mentions recorded before that date carry
 * `username: null`, and the name slug is the only key their `@token` can be
 * found under. Never build a NEW handle from a name.
 */
function nameHandleForms(name: string): [squashed: string, dotted: string] {
  const lower = name.toLowerCase().trim();
  return [lower.replace(/\s+/g, ''), lower.replace(/\s+/g, '.')];
}

/** Reserved by the AI summon — the server refuses it as a username. */
const LAWEXA_HANDLE = 'lawexa';

/**
 * Resolved `@handle` → {@link MentionChip}: the single source of truth shared
 * by the plain-text ({@link parseMessageContent}) and markdown (Lawexa)
 * renderers, in v1 and v2 alike.
 *
 * ── TWO KEY SPACES, AND BOTH ARE LOAD-BEARING (digest §F.19) ───────────────
 * Tagging now matches a unique `@username` and NOTHING else, so a message
 * written today contains `@adaobi2` and its mention entry carries
 * `username: "adaobi2"` — that is the key. Keying on a slug of `mention.name`
 * instead (which is what this map used to do) would leave the body's
 * `@adaobi2` unresolved: the person was notified, and the reader would see
 * grey text with nothing to say why.
 *
 * Mentions recorded BEFORE 2026-08-05 carry `username: null` and are not
 * backfilled. Their bodies hold name slugs, so {@link nameHandleForms} stays
 * as the fallback for exactly those entries. Delete it and every mention in
 * existing history loses its chip.
 *
 * A mention WITH a username registers ONLY that username — never its name slug
 * as well. The server did not match the slug, so nobody was notified by it, and
 * lighting it up would be the client guessing a mention the server refused.
 *
 * ── THE LABEL: THE NAME, UNLESS THE NAME HAS FAILED ───────────────────────
 * A chip normally shows the DISPLAY NAME, not the handle the writer typed. Our
 * username is a lookup key rather than a public identity — it is generated from
 * the name, never chosen, and appears nowhere a person is merely speaking. That
 * is the split Discord settled on when it added unique handles and kept them
 * off the reading surface, and the one the backend already made by leaving
 * notification previews reading "@Ada Obi".
 *
 * The exception is the case this whole change exists for. When a message tags
 * two DIFFERENT people who share a display name, `@Ada Obi` twice tells the
 * reader nothing, and a hover tooltip is not an answer on a phone. So a name
 * that more than one uuid answers to IN THIS MESSAGE gives up its chip to the
 * handle: `@adaobi` and `@adaobi2`, which is the shortest text that identifies
 * them. The rule reads as "a handle here means there was a clash here", it is
 * complete wherever the clash is visible, and it costs the prose nothing the
 * rest of the time. A colliding mention with no handle (old history) keeps its
 * name — there is nothing better to show.
 *
 * @see buildMentionHandleMap for the label-only projection v1 consumes.
 */
export function buildMentionChips(
  metadata: MessageMetadata
): Map<string, MentionChip> {
  // `mentions` is contractual on a channel message, but this map is the last
  // stop before a render: a payload that omits it must degrade to "no
  // mentions", never take the surface down.
  const mentions = metadata.mentions ?? [];

  // How many DISTINCT people each display name stands for here. Counting
  // entries instead of uuids would call one person mentioned twice a clash.
  const peoplePerName = new Map<string, Set<string>>();
  for (const mention of mentions) {
    const uuids = peoplePerName.get(mention.name) ?? new Set<string>();
    uuids.add(mention.uuid);
    peoplePerName.set(mention.name, uuids);
  }

  const chips = new Map<string, MentionChip>();
  for (const mention of mentions) {
    const username = mention.username ?? null;
    const contested = (peoplePerName.get(mention.name)?.size ?? 0) > 1;
    const chip: MentionChip = {
      label: contested && username ? username : mention.name,
      uuid: mention.uuid,
      username,
    };
    if (username) {
      chips.set(username.toLowerCase(), chip);
      continue;
    }
    for (const form of nameHandleForms(mention.name)) {
      chips.set(form, chip);
    }
  }
  if (metadata.lawexa_mentioned) {
    chips.set(LAWEXA_HANDLE, { label: 'Lawexa', uuid: null, username: null });
  }
  return chips;
}

/**
 * {@link buildMentionChips} projected down to `handle → label`, the shape the
 * v1 markdown renderer's rehype plugin takes. A projection rather than a second
 * implementation, so the two can never disagree about what resolves.
 */
export function buildMentionHandleMap(
  metadata: MessageMetadata
): Map<string, string> {
  const handles = new Map<string, string>();
  for (const [form, chip] of buildMentionChips(metadata)) {
    handles.set(form, chip.label);
  }
  return handles;
}

/**
 * Resolve one already-isolated `@token` against the chip map, or `null` when
 * the server did not resolve it (the "never guess" rule — an unmatched token
 * stays plain text). Returns the part of the token that IS the handle: never
 * longer than what was scanned, and shorter when trailing punctuation came off.
 *
 * PREFER {@link scanMentions} WHEN YOU HOLD THE SURROUNDING TEXT. This half of
 * the rule knows nothing about where the token came from, so a caller running
 * its own `matchAll` must ALSO apply the word boundary — otherwise "write to
 * bob@ada.com" yields an `@ada.` that sheds down onto a real key and chips
 * someone the server never resolved there. `scanMentions` is both halves.
 *
 * TRAILING FULL STOPS ARE SHED. `mentionTokenRegex` has to admit `.` for old
 * dotted name slugs, so "ask @adaobi." scans as the token `@adaobi.` — which is
 * not a handle any more and would resolve to nothing, leaving a mention that
 * notified someone rendered as grey text. So the whole token is tried first
 * (that is what keeps `@ada.obi` working, and what stops `@ada` stealing a
 * chip from `@ada.obi` when both are keys), then dots come off the end one at
 * a time. Only handles the server ALREADY resolved for this message can be
 * found either way, so shedding punctuation can never invent a mention.
 */
export function resolveMentionToken(
  token: string,
  chips: ReadonlyMap<string, MentionChip>
): { token: string; chip: MentionChip } | null {
  let candidate = token;
  while (candidate.length > 1) {
    const chip = chips.get(candidate.slice(1).toLowerCase());
    if (chip) return { token: candidate, chip };
    if (!candidate.endsWith('.')) return null;
    candidate = candidate.slice(0, -1);
  }
  return null;
}

/** Characters a handle may be made of. A `@` immediately after one of these is
 *  inside a word, not starting one — see {@link scanMentions}. */
const HANDLE_CHAR = /[a-z0-9._@]/i;

/** One resolved mention found in a run of text. */
export interface MentionHit {
  /** Index of the `@` within the scanned text. */
  index: number;
  /** The handle token as it appears at that index, punctuation already shed. */
  token: string;
  chip: MentionChip;
}

/**
 * Find every resolved mention in a run of text, in order and non-overlapping.
 * THE ONE PLACE that owns the token shape, the word boundary and the
 * punctuation rule, so the plain-text and markdown renderers cannot drift on
 * what counts as a mention.
 *
 * A HANDLE ONLY STARTS A WORD. `mentionTokenRegex` has no left boundary of its
 * own, so "write to bob@ada.com" scans an `@ada` that no writer typed as a tag
 * — and once trailing dots are shed, that fragment can land on a real key and
 * chip a person the server never resolved there. An `@` preceded by any handle
 * character is therefore skipped, which leaves "(@adaobi)" and "hi @adaobi"
 * matching and takes email addresses and `a@b` out of the running entirely.
 */
export function scanMentions(
  text: string,
  chips: ReadonlyMap<string, MentionChip>
): MentionHit[] {
  if (chips.size === 0) return [];
  const hits: MentionHit[] = [];
  for (const match of text.matchAll(mentionTokenRegex())) {
    const index = match.index ?? 0;
    if (index > 0 && HANDLE_CHAR.test(text[index - 1])) continue;
    const resolved = resolveMentionToken(match[0], chips);
    if (!resolved) continue;
    hits.push({ index, token: resolved.token, chip: resolved.chip });
  }
  return hits;
}

/**
 * Is this chip the reader themselves? BY UUID — the only comparison that can
 * tell two members with the same display name apart, which is the whole reason
 * usernames exist. A `null` viewer (signed out, or a surface with no identity)
 * matches nobody, and `@lawexa`'s null uuid must never match either.
 */
export function isSelfMention(
  uuid: string | null,
  viewerUuid: string | null
): boolean {
  return uuid !== null && uuid === viewerUuid;
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
  const chips = buildMentionChips(metadata);

  if (chips.size === 0) {
    return content ? splitLinks(content) : [];
  }

  const segments: MessageSegment[] = [];
  let lastIndex = 0;
  for (const hit of scanMentions(content, chips)) {
    if (hit.index > lastIndex) {
      segments.push(...splitLinks(content.slice(lastIndex, hit.index)));
    }
    segments.push({ type: 'mention', value: hit.token, ...hit.chip });
    // Only past the HANDLE — any full stop the scan swept up stays text.
    lastIndex = hit.index + hit.token.length;
  }

  if (lastIndex < content.length) {
    segments.push(...splitLinks(content.slice(lastIndex)));
  }
  return segments;
}
