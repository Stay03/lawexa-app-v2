'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  BookText,
  ChevronRight,
  GraduationCap,
  MessageSquare,
  NotebookPen,
  Scale,
  type LucideIcon,
} from 'lucide-react';

import { cn, stripPastedTags } from '@/lib/utils';
import type { UserRole } from '@/types/auth';
import { conversationsQueries } from '@/v2/features/conversations/queries';
import { HomeGreeting } from './HomeGreeting';
import { HomeComposer } from './HomeComposer';
import { HomePrompts } from './HomePrompts';

/**
 * HomeDesignB — "Research Launchpad" (the power-user candidate). The gold-shimmer
 * composer stays the primary action; each breakpoint is its own composition.
 *
 * MOBILE: greeting → a quick-start tile grid (Cases / Statutes / Notes / Quiz) →
 * a peek at REAL recent conversations → suggested prompts, all scrolling above a
 * composer that docks at the thumb via `position: sticky` (NOT fixed — shell-
 * contract compliant) and floats ALONE (rounded, shadowed) with a soft bottom
 * fade dissolving the content behind it.
 *
 * DESKTOP: the quick-start TILES ARE HIDDEN (owner #20 — the sidebar already
 * provides those shortcuts). The space is rebalanced into a two-column workspace:
 * the composer + suggested prompts on the left, and the recents panel promoted to
 * a full-height right column — so nothing is left where the tiles were.
 *
 * The greeting (`HomeGreeting`) is v1's REAL smart engine with the skeleton-first
 * reveal and the confidential-mode heading swap (owned here so greeting + composer
 * stay in lockstep). Suggested prompts are v1's ACTUAL four (owner #21). The whole
 * surface assembles with one signature — a staggered fade-and-rise entrance
 * (CSS-only, `motion-reduce`-honouring). Carries `data-design="b"` and the
 * server-renderable `data-v2-marker="V2-HOME"` marker.
 */

interface QuickStart {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

/** The launchpad destinations (MOBILE ONLY) — canonical clean paths that fall
 *  through the proxy to v1 for now. */
const QUICK_START: QuickStart[] = [
  { label: 'Cases', description: 'Search and cite judgments', href: '/cases', icon: Scale },
  { label: 'Statutes', description: 'Browse Acts and sections', href: '/statutes', icon: BookText },
  { label: 'Notes', description: 'Your saved research', href: '/notes', icon: NotebookPen },
  { label: 'Quiz', description: 'Test your knowledge', href: '/quiz', icon: GraduationCap },
];

/** Shared focus ring — unified across every interactive element. */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * The signature entrance: a soft fade + 8px rise. `fill-mode-both` holds each
 * element hidden through its stagger delay (no pre-flash); `motion-reduce` plus
 * the globals.css reduced-motion guard settle everything to its natural, fully
 * visible state instantly for users who ask for less motion.
 */
const REVEAL =
  'animate-in fade-in slide-in-from-bottom-2 fill-mode-both ease-out motion-reduce:animate-none';

/**
 * Compact relative time for a recents row. Pure — `now` is threaded in from a
 * lazy `useState` initializer so no `Date.now()`/`new Date()` runs in render, and
 * the timestamp is parsed with the deterministic `Date.parse`.
 */
function formatRelativeTime(iso: string, now: number): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const minutes = Math.max(0, Math.round((now - then) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.round(days / 365)}y`;
}

export function HomeDesignB({
  name,
  signedIn = false,
  role,
}: {
  name?: string;
  signedIn?: boolean;
  role?: UserRole;
}) {
  const [input, setInput] = useState('');
  const [confidential, setConfidential] = useState(false);
  const [now] = useState(() => Date.now());
  const composerAreaRef = useRef<HTMLDivElement>(null);

  // v1 parity: filling a prompt stub also focuses the textarea (places the
  // cursor / opens the mobile keyboard) so the user can complete the stub.
  const fillPrompt = (prompt: string) => {
    setInput(prompt);
    composerAreaRef.current?.querySelector('textarea')?.focus();
  };

  const recentsQuery = useQuery({
    ...conversationsQueries.recents(),
    enabled: signedIn,
  });
  const recents = (recentsQuery.data?.data ?? []).slice(0, 6);

  return (
    <div
      data-v2-marker="V2-HOME"
      data-design="b"
      className={cn(
        'mx-auto flex min-h-full w-full flex-col px-4 py-8 sm:px-6 md:py-12',
        // Signed in → a two-column desktop workspace (composer + recents). Guests
        // have no recents column, so the whole thing stays a single centered
        // column (no empty right slot where the tiles used to sit).
        signedIn
          ? 'max-w-5xl md:grid md:grid-cols-[minmax(0,1fr)_19rem] md:items-start md:gap-x-8 md:gap-y-6'
          : 'max-w-2xl',
      )}
    >
      {/* Greeting — top of both breakpoints; full width on desktop. The
          `md:order-1` keeps it first for the GUEST desktop flow (guests get a
          plain flex column, not the grid), so it never sinks below the composer;
          for signed-in users the grid's explicit placement wins and order is
          inert. */}
      <div
        className={`${REVEAL} order-1 duration-500 md:order-1 md:col-span-2`}
        style={{ animationDelay: '0ms' }}
      >
        <HomeGreeting
          name={name}
          confidential={confidential}
          align="left"
          subline="Start something new, or pick up a thread."
          headingClassName="font-comfortaa text-[26px] font-semibold leading-tight md:text-[32px]"
        />
      </div>

      {/* Quick-start tiles — MOBILE ONLY (owner #20). */}
      <section
        aria-label="Jump in"
        className={`${REVEAL} order-2 mt-8 duration-500 md:hidden`}
        style={{ animationDelay: '180ms' }}
      >
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Jump in
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_START.map((tile, i) => {
            const Icon = tile.icon;
            return (
              <Link
                key={tile.href}
                href={tile.href}
                className={`${REVEAL} ${FOCUS_RING} group relative flex min-h-[6.5rem] flex-col justify-between rounded-xl border border-border bg-card p-4 transition-colors duration-300 hover:border-primary/40 hover:bg-secondary/50`}
                style={{ animationDelay: `${220 + i * 55}ms` }}
              >
                <div className="flex items-start justify-between">
                  <span
                    aria-hidden
                    className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15"
                  >
                    <Icon className="size-[18px]" />
                  </span>
                  <ArrowUpRight
                    aria-hidden
                    className="size-4 text-muted-foreground/40 transition-colors group-hover:text-primary"
                  />
                </div>
                <div className="mt-3">
                  <div className="text-[15px] font-medium text-foreground">{tile.label}</div>
                  <div className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                    {tile.description}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recents — MOBILE: a peek after the tiles. DESKTOP: promoted to the full-
          height right column beside the composer. REAL conversations (read-only);
          hidden for guests. Rows link to `/c/{id}` (proxied to v1 for now). */}
      {signedIn ? (
        <section
          aria-label="Recent conversations"
          className={`${REVEAL} order-3 mt-8 rounded-xl border border-border bg-card p-2 duration-500 sm:p-3 md:order-none md:col-start-2 md:row-start-2 md:row-end-4 md:mt-0`}
          style={{ animationDelay: '300ms' }}
        >
          <div className="mb-1 flex items-center justify-between px-2 pt-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent
            </h2>
            <Link
              href="/conversations"
              className={`${FOCUS_RING} inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground`}
            >
              All
              <ChevronRight aria-hidden className="size-3.5" />
            </Link>
          </div>

          {recentsQuery.isPending ? (
            <ul className="flex flex-col">
              {[0.9, 0.65, 0.45, 0.3].map((opacity, index) => (
                <li
                  key={index}
                  className="flex items-center gap-3 px-2 py-2.5"
                  style={{ opacity }}
                >
                  <div className="size-4 shrink-0 animate-pulse rounded bg-muted" />
                  <div className="h-3.5 flex-1 animate-pulse rounded bg-muted" />
                </li>
              ))}
            </ul>
          ) : recentsQuery.isError ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Couldn&apos;t load conversations
            </p>
          ) : recents.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No conversations yet
            </p>
          ) : (
            <ul className="flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
              {recents.map((conversation) => {
                const title = stripPastedTags(conversation.title);
                return (
                  <li key={conversation.id}>
                    <Link
                      href={`/c/${conversation.id}`}
                      className={`${FOCUS_RING} flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary/60`}
                    >
                      <MessageSquare
                        aria-hidden
                        className="size-4 shrink-0 text-muted-foreground/60"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground/90">
                        {title}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground/70">
                        {formatRelativeTime(conversation.updated_at, now)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {/* Suggested prompts — MOBILE: `mt-auto` sinks them toward the thumb, above
          the docked composer, in v1's stacked-list style. DESKTOP: left column,
          under the composer, as a quiet ChatGPT-style list (owner #27). Both
          presentations come from the shared `HomePrompts`; the container keeps its
          order/grid slot so the layout is unchanged. */}
      <div
        className={`${REVEAL} order-4 mt-auto pt-8 duration-500 md:order-3 md:col-start-1 md:row-start-3 md:mt-4 md:max-w-2xl md:pt-0`}
        style={{ animationDelay: '150ms' }}
      >
        <div className="md:hidden">
          <HomePrompts variant="mobile" onSelect={fillPrompt} />
        </div>
        <div className="hidden md:block">
          <HomePrompts variant="desktop" onSelect={fillPrompt} />
        </div>
      </div>

      {/* Composer dock — MOBILE: `sticky bottom-0`, floating alone with a soft
          bottom fade dissolving the scrolling content behind it. DESKTOP: static,
          left column under the greeting. The entrance transform lives on the inner
          wrapper so it never touches the sticky element. */}
      <div className="order-5 sticky bottom-0 z-10 -mx-4 px-4 pb-3 pt-6 sm:-mx-6 sm:px-6 md:static md:order-2 md:z-auto md:col-start-1 md:row-start-2 md:mx-0 md:max-w-2xl md:px-0 md:pb-0 md:pt-0">
        {/* Mobile-only bottom fade (decorative; desktop drops it). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full bg-gradient-to-t from-background via-background/85 to-transparent md:hidden"
        />
        <div
          ref={composerAreaRef}
          className={`${REVEAL} duration-500`}
          style={{ animationDelay: '90ms' }}
        >
          <HomeComposer
            value={input}
            onValueChange={setInput}
            signedIn={signedIn}
            role={role}
            confidential={confidential}
            onConfidentialChange={setConfidential}
            className="shadow-lg"
            sendButtonClassName="md:size-9"
          />
        </div>
      </div>
    </div>
  );
}
