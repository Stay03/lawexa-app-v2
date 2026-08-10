'use client';

import { memo, type ReactNode } from 'react';
import Link from 'next/link';
import { BellOff, Hash, Lock, Plus } from 'lucide-react';

import { channelVisibilityFace } from '@/v2/features/collab/visibility';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CollabEmpty } from '@/v2/features/collab/kit/CollabEmpty';
import { CollabFailure } from '@/v2/features/collab/kit/CollabFailure';
import { SpaceCrest } from '@/v2/features/collab/kit/Crest';
import { PresenceStack } from '@/v2/features/collab/kit/PresenceStack';
import type { Member, SlimUser } from '@/types/collab';
import { memberCountLabel, spaceOwnerLabel } from '@/v2/features/spaces/model';
import {
  CONTENT_FADE,
  CountBadge,
  FOCUS_RING,
  UnreadDot,
  formatRelativeTime,
} from '@/v2/shell/designs/modules';
import {
  channelPreviewLine,
  type ChannelPreviewLine,
  type RailRow,
} from './collab-route';
import { RailHeaderSkeleton, RailListSkeleton } from './rail-states';
import type { CollabSpaceScope } from './space-scope';

/**
 * SpaceRail — the persistent channel list for one space: docked at `md:` and
 * up, and the whole payload of the mobile drawer.
 *
 * ── IT IS MEMOISED, AND ITS PROPS ARE STABLE ON PURPOSE ────────────────────
 * The React Compiler's transform is not enabled in this repo, so `memo` here
 * and on the row below is what stops a persistent, always-mounted rail
 * re-rendering fifty rows on every query transition of the frame above it.
 * `scope` arrives from a `useMemo`, `onNavigate` from a `useCallback`, and the
 * docked variant is handed a frozen `now`, so the memo genuinely holds.
 *
 * ── IT IS THE REASON THE FRAME EXISTS ──────────────────────────────────────
 * It is rendered by `CollabFrame`, which is rendered by the `(collab)` layout,
 * which Next preserves across every navigation between its descendants. So
 * choosing a channel here is a route change INSIDE the frame: the rail is not
 * unmounted, not refetched and not repainted, and the conversation swaps like a
 * pane rather than a page. Nothing in this file may reach for a router push or
 * a local "selected channel" state — the URL is the selection, read back
 * through `activeChannelUuid`, so a link, a Back press and a click all land in
 * exactly the same place.
 *
 * ── THE UNREAD GRAMMAR IS DERIVED, NEVER RE-INVENTED ───────────────────────
 * Every row's `grammar` comes from `channels/model.ts#channelUnreadGrammar`
 * via `buildRailSections`. Bold + gold dot = unread; a NUMBER is only ever
 * mentions; muted dims and can never bold; no red anywhere.
 *
 * THE DIM IS SCOPED TO A WRAPPER, and the mention badge is deliberately its
 * SIBLING. CSS `opacity` composites its whole subtree as one layer, so a
 * descendant `opacity-100` inside a faded parent is a no-op — a dim on the
 * anchor would render a muted channel's @you badge at 60%, quieting the one
 * signal Ruling A guarantees a mute may never suppress. Same rule, same shape
 * and same reason as `SpaceChannelRow` and `MyChannelRow`.
 *
 * ── WHY THE DOCKED RAIL IS ONE LINE AND THE DRAWER IS TWO ──────────────────
 * The brief asks the rows to carry the last-message preview, because the
 * cross-space list reads better than the space did. At 240px a preview
 * truncates to about four words, which is decoration rather than information,
 * and a two-line row halves how much of a busy space is visible at once — the
 * reason Discord's and Slack's rails are single-line. So the preview goes where
 * it can actually be read: the DRAWER (a full-width triage surface, and the
 * only channel list below `lg:`) and the lobby's activity block both show it,
 * and the docked rail stays a scannable index beside the pane that has room.
 */

/** The docked width. 240px — the low end of the 240–300px band the sidebar
 *  guidance settles on, chosen because the pane beside it holds a 768px
 *  transcript and every pixel the rail takes comes out of that. It docks at
 *  `lg:` and not `md:`: see `CollabFrame`, where the 272px arithmetic is. */
export const SPACE_RAIL_WIDTH = 'w-60';

/** The faces a `PresenceStack` shows, in roster order. */
function facesOf(members: readonly Member[]): readonly SlimUser[] {
  return members.map((member) => member.user);
}

/* ── One row ──────────────────────────────────────────────────────────────── */

/**
 * The row's second line, painted from the ONE derivation in `collab-route`.
 * It takes the resolved line rather than the row, so a caller decides whether
 * the line EXISTS (and reserves height for it) with the same value it renders
 * — a component that can return `null` cannot be asked that question from the
 * outside.
 */
export function ChannelPreviewText({
  line,
}: {
  line: Exclude<ChannelPreviewLine, { kind: 'none' }>;
}): ReactNode {
  if (line.kind === 'text') return line.text;
  return (
    <>
      <span className="text-foreground/70">{line.author}</span>
      {`: ${line.snippet}`}
    </>
  );
}

const RailChannelRow = memo(function RailChannelRow({
  row,
  active,
  now,
  withPreview,
  onNavigate,
}: {
  row: RailRow;
  /** This channel is the one on screen. `aria-current="page"` says so. */
  active: boolean;
  /**
   * The shared minute clock — no `Date.now()` runs in render (React Compiler
   * lint). `0` is its pre-hydration value and means "no age yet": passing it
   * to the formatter would date every row as "now", so the age is withheld
   * for that one frame rather than being made up.
   */
  now: number;
  withPreview: boolean;
  onNavigate?: () => void;
}) {
  const { channel, grammar } = row;
  const { unread, mentions, muted } = grammar;
  const visibilityFace = channelVisibilityFace(channel.visibility);
  const Icon = visibilityFace.icon;
  const age =
    withPreview && now > 0 ? formatRelativeTime(channel.last_message_at, now) : '';
  const line = withPreview ? channelPreviewLine(row) : null;
  const preview = line !== null && line.kind !== 'none' ? line : null;
  // SCOPED, NEVER ON THE ANCHOR — see the file docblock. The mention badge and
  // the age sit OUTSIDE this wrapper.
  const dim = muted
    ? 'opacity-60 transition-opacity duration-150 group-hover:opacity-100 motion-reduce:transition-none'
    : undefined;

  return (
    <li>
      <Link
        href={`/channels/${channel.uuid}`}
        aria-current={active ? 'page' : undefined}
        onClick={onNavigate}
        className={cn(
          'group v2-interactive flex gap-2 rounded-lg px-2 py-1.5',
          'transition-colors duration-150 motion-reduce:transition-none',
          withPreview ? 'min-h-12 items-start' : 'min-h-9 items-center',
          active
            ? 'bg-secondary'
            : 'hover:bg-secondary/60 active:bg-secondary/80',
          FOCUS_RING,
        )}
      >
        <span
          className={cn(
            'flex min-w-0 flex-1 gap-2',
            withPreview ? 'items-start' : 'items-center',
            dim,
          )}
        >
          <Icon
            aria-hidden
            className={cn(
              'size-4 shrink-0 transition-colors duration-150 motion-reduce:transition-none',
              withPreview && 'mt-0.5',
              // The SAME activity test every other collab row uses, so a
              // muted-with-@you channel is warm here and warm there.
              unread || mentions > 0 ? 'text-primary' : 'text-muted-foreground',
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                title={channel.name}
                className={cn(
                  'min-w-0 truncate text-sm transition-colors duration-150 motion-reduce:transition-none',
                  unread
                    ? 'font-semibold text-foreground'
                    : active
                      ? 'font-medium text-foreground'
                      : 'font-normal text-muted-foreground group-hover:text-foreground',
                )}
              >
                {channel.name}
              </span>
              {unread ? <UnreadDot /> : null}
              {muted ? (
                <BellOff
                  aria-label="Muted"
                  className="size-3 shrink-0 text-muted-foreground"
                />
              ) : null}
            </span>
            {preview ? (
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                <ChannelPreviewText line={preview} />
              </span>
            ) : null}
          </span>
        </span>

        {/* OUTSIDE the dim wrapper — the only place a muted row's @you badge
            can stay at full strength (Ruling A's one guaranteed-loud signal). */}
        <span
          className={cn(
            'flex shrink-0 items-center gap-2',
            withPreview && 'mt-0.5',
          )}
        >
          {mentions > 0 ? (
            <CountBadge
              count={mentions}
              label={`${mentions} unread ${mentions === 1 ? 'mention' : 'mentions'} in ${channel.name}`}
            />
          ) : null}
          {age ? (
            <span
              className={cn('text-[11px] tabular-nums text-muted-foreground', dim)}
            >
              {age}
            </span>
          ) : null}
        </span>
      </Link>
    </li>
  );
});

/* ── One section ──────────────────────────────────────────────────────────── */

function RailSection({
  label,
  rows,
  activeChannelUuid,
  now,
  withPreview,
  onNavigate,
}: {
  /** `null` suppresses the heading — a single-section rail needs no label. */
  label: string | null;
  rows: readonly RailRow[];
  activeChannelUuid: string | null;
  now: number;
  withPreview: boolean;
  onNavigate?: () => void;
}) {
  if (rows.length === 0) return null;
  return (
    <>
      {label ? (
        <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {label}
        </p>
      ) : null}
      <ul aria-label={label ?? undefined} className="flex flex-col gap-0.5">
        {rows.map((row) => (
          <RailChannelRow
            key={row.channel.uuid}
            row={row}
            active={row.channel.uuid === activeChannelUuid}
            now={now}
            withPreview={withPreview}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </>
  );
}

/* ── The rail ─────────────────────────────────────────────────────────────── */

export const SpaceRail = memo(function SpaceRail({
  scope,
  activeChannelUuid,
  atLobby,
  now,
  variant,
  onNavigate,
}: {
  scope: CollabSpaceScope;
  activeChannelUuid: string | null;
  /** The reader is on the space's own page, so its header row is "here". */
  atLobby: boolean;
  /** The drawer's minute clock. The docked variant is handed `0` — its rows
   *  are single-line and show no age — so no tick can re-render it. */
  now: number;
  /** `drawer` is the left sheet below `lg:`: full width, so rows preview. */
  variant: 'docked' | 'drawer';
  /** Activating anything closes the drawer. Omitted by the docked rail, which
   *  has nothing to close. */
  onNavigate?: () => void;
}) {
  const { space, identity, sections } = scope;
  const withPreview = variant === 'drawer';
  // Labels earn their room only when there is more than one section to tell
  // apart; a rail with nothing unread and nothing muted is just "the channels".
  const sectionCount = [sections.unread, sections.rest, sections.muted].filter(
    (section) => section.length > 0,
  ).length;
  const labelled = sectionCount > 1;

  const newChannel = scope.canManage ? (
    <div className="shrink-0 border-t border-border/60 p-2">
      <Button
        variant="ghost"
        size="sm"
        className="v2-interactive w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
        onClick={() => {
          // Close-then-open, in that order: the drawer rewrites its own entry
          // in place so the dialog's push lands on an entry that survives.
          onNavigate?.();
          scope.openCreateChannel();
        }}
      >
        <Plus aria-hidden className="size-4" />
        New channel
      </Button>
    </div>
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Identity ─────────────────────────────────────────────────────
            The crest and the name paint from `identity`, which on a channel
            route arrives with the channel itself — a whole round trip before
            the space detail. The facts only the detail carries (privacy, the
            owner, the roster) hold their shape until it lands, so the block
            resolves in place instead of shimmering as a whole. ───────────── */}
      {identity === null ? (
        <RailHeaderSkeleton />
      ) : (
        <div className={cn('px-2 pt-2', CONTENT_FADE)}>
          <Link
            href={`/spaces/${identity.uuid}`}
            aria-current={atLobby ? 'page' : undefined}
            onClick={onNavigate}
            className={cn(
              'v2-interactive flex items-center gap-2.5 rounded-lg px-2 py-1.5',
              'transition-colors duration-150 motion-reduce:transition-none',
              atLobby ? 'bg-secondary' : 'hover:bg-secondary/60',
              FOCUS_RING,
            )}
          >
            <SpaceCrest
              uuid={identity.uuid}
              name={identity.name}
              type={identity.type}
              size="md"
            />
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  title={identity.name}
                  className="min-w-0 truncate text-sm font-semibold text-foreground"
                >
                  {identity.name}
                </span>
                {space?.is_private ? (
                  <Lock
                    aria-label="Private space"
                    className="size-3 shrink-0 text-muted-foreground"
                  />
                ) : null}
              </span>
              {space ? (
                <span className="block truncate text-[11px] text-muted-foreground">
                  {`${space.type_label} · ${spaceOwnerLabel(space)}`}
                </span>
              ) : (
                <Skeleton aria-hidden className="mt-1 h-2.5 w-2/5 rounded" />
              )}
            </span>
          </Link>

          {/* WHO IS IN THE SPACE — a glance, deliberately NOT a door.
              `onClick` is omitted (the kit then renders a plain element rather
              than a button), because the roster it would open is a lobby
              concern: `?roster=1` exists on the space route only, so that the
              `?invite=` param nested in that sheet has exactly one owner at
              every address. On a channel route the reader's "who is here" is
              the CHANNEL's roster, which the channel screen owns — two
              presence stacks with two doors on one screen was the redundancy
              this removes. It sits OUTSIDE the link above either way: a button
              nested in an anchor is invalid, and the browser's repair swallows
              one of the two activations. */}
          <div className="px-2 pb-2 pt-1.5">
            {space ? (
              <PresenceStack
                members={facesOf(scope.members)}
                total={space.active_members_count}
                countLabel={memberCountLabel(space.active_members_count)}
                label={`${memberCountLabel(space.active_members_count)} in ${space.name}`}
                size="sm"
              />
            ) : (
              <Skeleton aria-hidden className="h-5 w-24 rounded-full" />
            )}
          </div>
        </div>
      )}

      <div className="mx-2 h-px shrink-0 bg-border/60" />

      {/* ── Channels ───────────────────────────────────────────────────── */}
      <nav
        aria-label={identity ? `Channels in ${identity.name}` : 'Channels'}
        className="v2-quiet-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-2"
      >
        {/* NO LIVE REGION HERE. The rail is chrome, and the lobby's activity
            block already announces "Loading channels" for the same query — two
            polite regions saying the same sentence at the same moment is one
            announcement too many, and the page's content is the one worth
            announcing. */}
        {scope.isChannelsPending ? (
          <RailListSkeleton />
        ) : scope.isChannelsError && sections.total === 0 ? (
          <CollabFailure
            message="Couldn't load channels."
            onRetry={scope.retryChannels}
            className="mx-1 mt-2 text-xs"
          />
        ) : sections.total === 0 ? (
          <CollabEmpty
            icon={Hash}
            title="No channels yet"
            description={
              scope.canManage
                ? 'Channels split a space by topic. Make the first one.'
                : 'Channels appear here once an owner or admin makes one.'
            }
            className="px-3 pb-4 pt-6 text-xs"
          />
        ) : (
          <div className={CONTENT_FADE}>
            <RailSection
              label={labelled ? 'Unread' : null}
              rows={sections.unread}
              activeChannelUuid={activeChannelUuid}
              now={now}
              withPreview={withPreview}
              onNavigate={onNavigate}
            />
            <RailSection
              label={labelled ? 'Channels' : null}
              rows={sections.rest}
              activeChannelUuid={activeChannelUuid}
              now={now}
              withPreview={withPreview}
              onNavigate={onNavigate}
            />
            <RailSection
              label={labelled ? 'Muted' : null}
              rows={sections.muted}
              activeChannelUuid={activeChannelUuid}
              now={now}
              withPreview={withPreview}
              onNavigate={onNavigate}
            />
          </div>
        )}
      </nav>

      {newChannel}
    </div>
  );
});
