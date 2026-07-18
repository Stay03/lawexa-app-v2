'use client';

import { useState } from 'react';
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

import { stripPastedTags } from '@/lib/utils';
import { getSmartGreetingParts } from '@/lib/constants/greetings';
import { PulsingHeart } from '@/components/ui/pulsing-heart';
import { useMounted } from '@/v2/shell/use-mounted';
import { conversationsQueries } from '@/v2/features/conversations/queries';
import { HomeComposer } from './HomeComposer';

/**
 * HomeDesignB — "Research Launchpad" (the power-user candidate). The gold-shimmer
 * composer stays the primary action, but it anchors an organized command center:
 * a designed quick-start tile grid (Cases / Statutes / Notes / Quiz) and a peek at
 * REAL recent conversations. Each breakpoint is its own composition. On MOBILE the
 * composer docks at the thumb via `position: sticky` (NOT fixed — shell-contract
 * compliant) and floats ALONE — a rounded, shadowed card with the launchpad
 * scrolling visibly behind it (a soft bottom fade, no solid band). On DESKTOP it
 * becomes a left-aligned workspace: the composer sits high under the greeting,
 * with the tiles + recents laid out side by side below. The whole surface
 * assembles with one signature — a staggered fade-and-rise entrance (CSS-only,
 * honouring `motion-reduce`). Carries `data-design="b"` and the server-renderable
 * `data-v2-marker="V2-HOME"` marker.
 */

interface QuickStart {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

/** The launchpad destinations — canonical clean paths (they fall through the
 * proxy to v1 for now; the intended strangler experience). */
const QUICK_START: QuickStart[] = [
  { label: 'Cases', description: 'Search and cite judgments', href: '/cases', icon: Scale },
  { label: 'Statutes', description: 'Browse Acts and sections', href: '/statutes', icon: BookText },
  { label: 'Notes', description: 'Your saved research', href: '/notes', icon: NotebookPen },
  { label: 'Quiz', description: 'Test your knowledge', href: '/quiz', icon: GraduationCap },
];

/** Suggested research prompts — clicking one loads it into the composer. */
const SUGGESTED_PROMPTS = [
  'Explain the ratio in Madukolu v Nkemdilim',
  'Consent requirements under the Land Use Act',
  'Quiz me on the Evidence Act 2011',
] as const;

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
}: {
  name?: string;
  signedIn?: boolean;
}) {
  const [input, setInput] = useState('');

  // v1's smart greeting, resolved once via a lazy initializer (engine internals
  // use Math.random/Date). `useMounted` shows the neutral 'Welcome' fallback on
  // the server + first client render, then the real greeting once mounted.
  const mounted = useMounted();
  const [parts] = useState(() => getSmartGreetingParts(name));
  const [now] = useState(() => Date.now());
  const greeting = mounted ? parts.greeting : 'Welcome';
  const greetingName = mounted ? parts.name : '';
  const isSpecial = mounted ? parts.isSpecial : null;

  const recentsQuery = useQuery({
    ...conversationsQueries.recents(),
    enabled: signedIn,
  });
  const recents = (recentsQuery.data?.data ?? []).slice(0, 6);

  return (
    <div
      data-v2-marker="V2-HOME"
      data-design="b"
      className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 py-8 sm:px-6 md:py-12"
    >
      {/* Greeting — always first, both breakpoints. Capped at v1's ~36px scale. */}
      <header
        className={`${REVEAL} order-1 duration-500`}
        style={{ animationDelay: '0ms' }}
      >
        <h1 className="font-comfortaa text-[26px] font-semibold leading-tight text-foreground md:text-[32px]">
          {isSpecial === '__PULSING_HEART__' ? (
            <PulsingHeart />
          ) : (
            <>
              {greeting}
              {greetingName ? (
                <>
                  {', '}
                  <span className="text-primary">{greetingName}</span>
                </>
              ) : null}
            </>
          )}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          Start something new, or pick up a thread.
        </p>
      </header>

      {/* Launchpad — mobile: stacked above the composer. Desktop: below it, with
          the quick-start grid and recents peek side by side. */}
      <section
        aria-label="Launchpad"
        className="order-2 mt-8 md:order-4 md:mt-10 lg:grid lg:grid-cols-3 lg:gap-6"
      >
        {/* Quick start — fills the row for guests (no recents column). */}
        <div className={signedIn ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <h2
            className={`${REVEAL} mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground duration-500`}
            style={{ animationDelay: '180ms' }}
          >
            Jump in
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
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
        </div>

        {/* Recents peek — REAL conversations (read-only). Hidden for guests. Rows
            are links to `/c/{id}` (proxied to the v1 conversation page for now).
            Loading skeletons + an empty state keep every state considered. */}
        {signedIn ? (
          <section
            aria-label="Recent conversations"
            className={`${REVEAL} mt-8 rounded-xl border border-border bg-card p-2 duration-500 sm:p-3 lg:col-span-1 lg:mt-0`}
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
              <ul className="flex flex-col">
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
      </section>

      {/* Suggested prompts — in the scrollable flow above the composer. On mobile
          `mt-auto` sinks this group toward the thumb; on tall content it scrolls
          in above the docked composer. */}
      <div
        className={`${REVEAL} order-3 mt-auto flex flex-wrap gap-2 pt-8 duration-500 md:mt-4 md:max-w-2xl md:pt-0`}
        style={{ animationDelay: '150ms' }}
      >
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => setInput(prompt)}
            className={`${FOCUS_RING} inline-flex min-h-11 items-center rounded-full border border-border bg-transparent px-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-secondary hover:text-foreground active:bg-secondary`}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Composer dock — the primary action. MOBILE: `sticky bottom-0` pins it to
          the thumb from first paint; the card floats ALONE (rounded + shadowed)
          with a soft bottom fade dissolving the scrolling launchpad behind it —
          no solid band. DESKTOP: static, high under the greeting. The entrance
          transform lives on the inner wrapper so it never touches the sticky
          element itself. */}
      <div className="order-4 sticky bottom-0 z-10 -mx-4 px-4 pb-3 pt-6 sm:-mx-6 sm:px-6 md:static md:order-2 md:z-auto md:mx-0 md:mt-6 md:max-w-2xl md:px-0 md:pt-0 md:pb-0">
        {/* Mobile-only bottom fade: scrolling content dissolves into the page
            before it reaches the card (transparent up top, page bg by the card).
            Decorative; desktop drops it (the composer is static there). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full bg-gradient-to-t from-background via-background/85 to-transparent md:hidden"
        />
        <div className={`${REVEAL} duration-500`} style={{ animationDelay: '90ms' }}>
          <HomeComposer
            value={input}
            onValueChange={setInput}
            signedIn={signedIn}
            className="shadow-lg"
            sendButtonClassName="md:size-9"
          />
        </div>
      </div>
    </div>
  );
}
