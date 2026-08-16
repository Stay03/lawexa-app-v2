import type { Channel } from '@/types/collab';
import { channelUnreadGrammar } from '@/v2/features/channels/model';
import type { UnreadGrammar } from '@/v2/features/collab/unread-grammar';

/**
 * collab-route — the pure vocabulary of the persistent collab frame: which
 * place the current URL names, and how that place's channels are ordered into
 * the rail. No JSX, no hooks, no browser APIs, so the rail, the drawer, the
 * lobby and every skeleton read the same answers.
 */

/* ── Which place the URL names ────────────────────────────────────────────── */

/**
 * The three shapes a collab URL can take, from the frame's point of view.
 *  - `space`   — `/spaces/{uuid}`: the space is named by the address itself.
 *  - `channel` — `/channels/{uuid}`: the space is a FACT ABOUT THE CHANNEL and
 *    is only known once the channel detail lands. The frame still reserves the
 *    rail immediately, because every channel has a space — waiting would make
 *    the rail appear late and shove the pane sideways.
 *  - `none`    — `/spaces`, `/channels`, or anything else: no place, no rail.
 */
export type CollabRoute =
  | { kind: 'space'; spaceUuid: string }
  | { kind: 'channel'; channelUuid: string }
  | { kind: 'none' };

/** One frozen value, so a route with no place keeps a stable reference. */
export const NO_COLLAB_ROUTE: CollabRoute = { kind: 'none' };

/**
 * The internal tree's prefix. The proxy REWRITES `/spaces/x` → `/v2/spaces/x`,
 * so an opted-in reader's address bar normally shows the clean path — but a
 * direct `/v2/spaces/x` hit is allowed through with the cookie, and then
 * `usePathname()` returns the prefixed form. Both have to resolve to the same
 * place or the rail would silently vanish on the internal address.
 */
const V2_PREFIX = '/v2';

/** The place `pathname` names, if any. Pure; accepts either address form. */
export function parseCollabRoute(pathname: string): CollabRoute {
  const path = pathname.startsWith(`${V2_PREFIX}/`)
    ? pathname.slice(V2_PREFIX.length)
    : pathname;
  const segments = path.split('/').filter(Boolean);
  // Exactly two segments: both routes are leaves, so a deeper path is not one
  // of ours and must not be guessed at.
  if (segments.length !== 2) return NO_COLLAB_ROUTE;
  const [head, uuid] = segments;
  if (!uuid) return NO_COLLAB_ROUTE;
  if (head === 'spaces') return { kind: 'space', spaceUuid: uuid };
  if (head === 'channels') return { kind: 'channel', channelUuid: uuid };
  return NO_COLLAB_ROUTE;
}

/* ── The rail's ordering ──────────────────────────────────────────────────── */

/**
 * One row of the rail. The grammar is DERIVED from
 * `channels/model.ts#channelUnreadGrammar` and never re-invented here — that
 * function is where a mute stops the bold, so nothing downstream can
 * accidentally re-bold a muted room.
 */
export interface RailRow {
  channel: Channel;
  grammar: UnreadGrammar;
  /**
   * The last-message preview, when it is known.
   *
   * THE THREE-WAY VALUE IS THE HONEST ONE. `undefined` means the wire never
   * said: `GET /api/spaces/{space}/channels` does not stamp `last_message` at
   * all (only the cross-space `GET /api/channels` does), so a channel outside
   * that route's page simply has no preview to show. `null` means the server
   * DID say, and said nothing survives — the last message was deleted. A row
   * must be able to tell those apart, because the first falls back to the
   * channel's description and the second is genuinely "No messages yet".
   */
  preview: Channel['last_message'];
}

/**
 * The rail's three sections, in the order they are drawn.
 *
 * ── WHY SECTIONS AND NOT ONE SORTED LIST ───────────────────────────────────
 * The complaint being fixed is that "a channel with 12 mentions can sit below
 * three dead ones" — the per-space list arrives in raw API order. The obvious
 * fix, sorting every row by activity, has a cost the research is explicit
 * about: Discord and Slack both keep a STABLE order precisely so rows do not
 * move under the cursor, and neither reorders on arrival. Sections are the
 * settlement. A row moves only when its unread state changes (a real event the
 * reader caused or is being told about), and within a section the order is
 * fixed.
 *
 * WITHIN each section:
 *  - `unread` is a triage list, so it is newest-first — the point of it is
 *    "what should I read next".
 *  - `rest` and `muted` are a directory, so they are alphabetical, which never
 *    moves when a message arrives.
 */
export interface RailSections {
  /** Unread or @mentioned, and not muted. Newest first. */
  unread: readonly RailRow[];
  /** Everything else that is not muted. Alphabetical. */
  rest: readonly RailRow[];
  /** Muted rooms, whatever their counts. Alphabetical, and always last. */
  muted: readonly RailRow[];
  /** Every row, in the same order the sections are drawn. */
  ordered: readonly RailRow[];
  /** How many rows the whole space has (never a page count — the per-space
   *  list is asked for 50 and a space with more is not a case we have). */
  total: number;
  /** How many are unread — the lobby's kicker, and only ever a fact about
   *  channels, never rendered as a bare numeral beside a mention badge. */
  unreadCount: number;
}

/** One frozen empty value, so a space with no channels allocates nothing. */
export const NO_RAIL_SECTIONS: RailSections = {
  unread: [],
  rest: [],
  muted: [],
  ordered: [],
  total: 0,
  unreadCount: 0,
};

/** Newest first; a missing or unparseable timestamp sorts last. */
function activityRank(iso: string | null): number {
  if (!iso) return 0;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function byRecency(left: RailRow, right: RailRow): number {
  const delta =
    activityRank(right.channel.last_message_at) -
    activityRank(left.channel.last_message_at);
  return delta !== 0 ? delta : left.channel.name.localeCompare(right.channel.name);
}

function byName(left: RailRow, right: RailRow): number {
  return left.channel.name.localeCompare(right.channel.name);
}

/**
 * The preview lookup, built from the caller's CROSS-SPACE channel page.
 *
 * `GET /api/channels` is the only route that stamps `last_message`, and the
 * realtime spine already mounts it app-wide for every eligible viewer with
 * exactly `{ viewerId }` params — so reading it here costs no request, no
 * skeleton and no second cache entry. It is a single page (the API's default
 * 20, most-recently-active first across ALL spaces), which is why the result is
 * a lookup rather than a list: a channel it does not reach keeps `undefined`
 * and falls back to its description, instead of being told it has no messages.
 */
export function channelPreviewIndex(
  channels: readonly Channel[],
): ReadonlyMap<string, Channel['last_message']> {
  const index = new Map<string, Channel['last_message']>();
  for (const channel of channels) {
    if (channel.last_message !== undefined) {
      index.set(channel.uuid, channel.last_message);
    }
  }
  return index;
}

/**
 * What a channel row's SECOND line says, resolved once so the rail, the drawer
 * and the lobby cannot each answer it differently.
 *
 * The three-way `preview` value drives three genuinely different sentences: a
 * real preview; the server's "the last message is gone" (`null`); or silence
 * from a payload that never carried one (`undefined`), which falls back to the
 * channel's purpose — and only claims "No messages yet" when the channel's own
 * `last_message_at` agrees that nothing has ever been said.
 */
export type ChannelPreviewLine =
  | { kind: 'message'; author: string; snippet: string }
  | { kind: 'text'; text: string }
  | { kind: 'none' };

const NO_PREVIEW_LINE: ChannelPreviewLine = { kind: 'none' };
const NEVER_USED: ChannelPreviewLine = { kind: 'text', text: 'No messages yet' };

export function channelPreviewLine(row: RailRow): ChannelPreviewLine {
  const { channel, preview } = row;
  if (preview) {
    return { kind: 'message', author: preview.author_name, snippet: preview.snippet };
  }
  if (preview === null) return NEVER_USED;
  const description = channel.description?.trim();
  if (description) return { kind: 'text', text: description };
  return channel.last_message_at ? NO_PREVIEW_LINE : NEVER_USED;
}

/*
 * THE LOBBY'S RANKING DOES NOT LIVE HERE. The space page's "Active here"
 * digest re-ranks these sections by recency AND merges the space's THREADS
 * into them — a surface-specific vocabulary, moved to
 * `spaces/detail/activity-digest.ts` when threads joined it, because threads
 * have no rail row by design (`topLevel()`) and this module must stay the
 * rail's and drawer's shared truth. The tier test stays HERE, in
 * `buildRailSections`, so the two surfaces can never disagree about what
 * counts as unread.
 */

/** Sort one space's channels into {@link RailSections}. Pure. */
export function buildRailSections(
  channels: readonly Channel[],
  previews: ReadonlyMap<string, Channel['last_message']>,
): RailSections {
  if (channels.length === 0) return NO_RAIL_SECTIONS;

  const unread: RailRow[] = [];
  const rest: RailRow[] = [];
  const muted: RailRow[] = [];

  for (const channel of channels) {
    const grammar = channelUnreadGrammar(channel);
    const row: RailRow = {
      channel,
      grammar,
      preview: previews.get(channel.uuid),
    };
    // A muted room sinks whatever its counts say — that is what a mute means,
    // and Ruling A keeps its @you badge loud where it lands rather than
    // promoting the row back up.
    if (grammar.muted) muted.push(row);
    else if (grammar.unread || grammar.mentions > 0) unread.push(row);
    else rest.push(row);
  }

  unread.sort(byRecency);
  rest.sort(byName);
  muted.sort(byName);

  return {
    unread,
    rest,
    muted,
    ordered: [...unread, ...rest, ...muted],
    total: channels.length,
    unreadCount: unread.length,
  };
}
