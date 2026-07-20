'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, XCircle, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ToolResultParts — the shared anatomy every tool-call and sub-agent result is
 * built from, so tools, sub-agents, and their nested steps read as ONE system
 * (owner: "cleaner, sleeker"). Pulled from the home-module design language
 * (hairline chrome on a raised surface, a leading identity tile, a primary line
 * over quiet meta, sentence-case labels) and from how the best AI products
 * disclose tool use — Perplexity's source rows, Claude's quiet step details.
 */

/** The one focus ring for interactive result rows (mirrors modules/meta.ts,
 *  inlined to avoid a cross-feature import). */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * BoundedScroll — the universal answer to the owner's "messy … should be
 * scrollable with fixed height": ANY potentially-long block (a pasted prompt, a
 * note's HTML body, a statute section, an agent's response) lives inside a capped,
 * internally-scrolling viewport. Scroll-position-aware fades hint more content in
 * either direction and vanish when the content fits — so a short block is never
 * eaten by a permanent fade.
 *
 * React Compiler-clean: no state is set in the effect body. The initial overflow
 * read comes from the ResizeObserver's own first callback; `onScroll` (an event
 * callback) handles the rest — the same pattern MessageList uses for its pill.
 */
export function BoundedScroll({
  children,
  maxHeight = 'max-h-56',
  surface = 'from-background',
  fade = true,
  className,
}: {
  children: React.ReactNode;
  /** Tailwind max-height utility for the scroll cap. */
  maxHeight?: string;
  /** Tailwind `from-*` matching the block's own background, so the fade blends. */
  surface?: string;
  fade?: boolean;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const top = el.scrollTop > 2;
    const bottom = Math.ceil(el.scrollTop + el.clientHeight) < el.scrollHeight - 2;
    setEdges((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
  }, []);

  useEffect(() => {
    if (!fade) return;
    const el = scrollRef.current;
    const inner = innerRef.current;
    if (!el || !inner) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [fade, measure]);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={fade ? measure : undefined}
        className={cn('overflow-y-auto overscroll-contain', maxHeight, className)}
      >
        <div ref={innerRef}>{children}</div>
      </div>
      {fade && (
        <>
          <div
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-x-0 top-0 h-4 rounded-t-[inherit] bg-gradient-to-b to-transparent transition-opacity duration-150 motion-reduce:transition-none',
              surface,
              edges.top ? 'opacity-100' : 'opacity-0',
            )}
          />
          <div
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-x-0 bottom-0 h-6 rounded-b-[inherit] bg-gradient-to-t to-transparent transition-opacity duration-150 motion-reduce:transition-none',
              surface,
              edges.bottom ? 'opacity-100' : 'opacity-0',
            )}
          />
        </>
      )}
    </div>
  );
}

/**
 * A hairline panel that holds result rows — the within-step echo of a home
 * module: `rounded-xl border-border bg-card`, no shadow, so it reads as designed
 * chrome rather than an assembled box.
 */
export function ToolResultGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mt-2 overflow-hidden rounded-xl border border-border bg-card',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * One result as a whole-row link into the resource — the module row anatomy
 * (identity tile → title → quiet meta → trailing affordance) so "tapping into a
 * case feels designed" instead of a cramped text line. ≥44px target, both lines
 * truncate, the tile and trailing icon never shrink.
 */
export function ResultRowLink({
  href,
  icon: Icon,
  title,
  meta,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  meta?: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group v2-interactive flex min-h-11 items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary active:bg-secondary/80',
        FOCUS_RING,
      )}
    >
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors group-hover:text-foreground"
      >
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{title}</span>
        {meta != null && meta !== '' ? (
          <span className="truncate text-xs text-muted-foreground">{meta}</span>
        ) : null}
      </span>
      <ExternalLink
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground"
      />
    </a>
  );
}

/** Sentence-case section label inside an expanded step (never uppercase-tracking). */
export function ToolSectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-xs font-medium">{children}</p>;
}

/**
 * A single quiet status line — the ONLY thing a bodiless step shows on success
 * (a muted check + optional server message) or failure (destructive). Bare result
 * counts and "found in Xs" are gone; the duration lives on the step header.
 */
export function ToolStateLine({
  tone = 'muted',
  children,
}: {
  tone?: 'muted' | 'error';
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 text-xs',
        tone === 'error' ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {tone === 'error' ? (
        <XCircle aria-hidden className="size-3.5 shrink-0" />
      ) : (
        <Check aria-hidden className="size-3.5 shrink-0" strokeWidth={2.5} />
      )}
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}
