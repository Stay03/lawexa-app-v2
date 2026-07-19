'use client';

import { useState, type ComponentProps, type ReactNode } from 'react';
import Link from 'next/link';
import type { ExtraProps } from 'react-markdown';

import { cn } from '@/lib/utils';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePointerCapability } from './use-pointer-capability';
import { CasePreview } from './CasePreview';

/**
 * CaseMentionLink — the `a` renderer for assistant markdown (§C KEEP, ported
 * v2-natively; owner #44). It replaces v1's DOM-scanning tippy hook
 * (`lib/hooks/useCaseMentionTooltips.ts`) with a React-native preview.
 *
 * DETECTION: assistant messages render through react-markdown WITHOUT rehype-raw,
 * so the ONLY anchors in the DOM are markdown links — raw `<a class="case-mention"
 * data-case-slug>` HTML (the TipTap note-editor variant, `components/notes/mention/
 * CaseMention.ts`) never parses into an element here. So href-pattern matching on
 * `/cases/{slug}` (absolute or relative) is both reliable and complete for this
 * surface; a non-case anchor renders exactly as react-markdown's default `<a>`.
 *
 * MEMO SAFETY: this is referenced from a MODULE-STABLE `components` map in
 * MarkdownText, so it never defeats the per-block `React.memo` streaming
 * pipeline. It calls no data hook itself — the fetch lives in {@link CasePreview},
 * which mounts only when a preview opens — so token arrival never fetches and
 * never re-renders beyond the block that already re-parses.
 */

/** Path-ANCHORED: the href's path must BE a case page (`/cases/{slug}`), so nested
 *  paths like `/admin/cases/123` never match (review finding). */
const CASE_PATH = /^\/cases\/([^/?#]+)\/?$/;

/** Hosts whose absolute `/cases/{slug}` links are OUR case pages. SSR-safe by
 *  construction (a static allow-list — `location` is unavailable at render). */
const OWN_HOSTS = new Set(['lawexa.com', 'www.lawexa.com']);

/**
 * Pure — the case slug for an INTERNAL `/cases/{slug}` href, else null.
 * Relative hrefs are matched on their path; absolute hrefs must additionally be
 * on an own host, so a foreign site with a coincidental `/cases/` segment is
 * never hijacked into an internal link + preview (review finding).
 */
export function extractCaseSlug(href: string | undefined): string | null {
  if (!href) return null;
  let pathname: string;
  if (href.startsWith('/')) {
    pathname = href.split(/[?#]/, 1)[0];
  } else {
    try {
      const url = new URL(href);
      if (!OWN_HOSTS.has(url.hostname)) return null;
      pathname = url.pathname;
    } catch {
      // Neither root-relative nor an absolute URL — not a case link.
      return null;
    }
  }
  const match = CASE_PATH.exec(pathname);
  if (!match) return null;
  try {
    const slug = decodeURIComponent(match[1]).trim();
    return slug.length > 0 ? slug : null;
  } catch {
    // Malformed percent-encoding — fall back to the raw segment.
    const slug = match[1].trim();
    return slug.length > 0 ? slug : null;
  }
}

const TRIGGER_CLASS =
  'case-mention v2-interactive text-primary focus-visible:ring-ring focus-visible:ring-offset-background -mx-0.5 rounded-sm px-0.5 font-medium transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1';

/** Shared width cap: ~450px, but never wider than the viewport minus the
 *  collision padding (16px each side), so it fits a 320px screen. */
const CONTENT_WIDTH = 'w-[min(28rem,calc(100vw-2rem))]';

export function CaseMentionLink({
  href,
  title,
  children,
}: ComponentProps<'a'> & ExtraProps) {
  const slug = extractCaseSlug(href);
  if (!slug) {
    // Non-case anchor — react-markdown's default output (href + optional title).
    return (
      <a href={href} title={title}>
        {children}
      </a>
    );
  }
  return <CaseMention slug={slug}>{children}</CaseMention>;
}

function CaseMention({ slug, children }: { slug: string; children: ReactNode }) {
  const pointer = usePointerCapability();
  const casePath = `/cases/${slug}`;

  // Pre-mount (SSR + first hydration render): a plain, navigable anchor with no
  // preview wrapper, so server and client agree. Once the pointer type resolves
  // on the client the anchor upgrades in place to its interactive variant.
  if (pointer === null) {
    return (
      <Link href={casePath} className={TRIGGER_CLASS}>
        {children}
      </Link>
    );
  }

  if (pointer === 'fine') {
    return (
      <DesktopCaseHoverCard slug={slug} casePath={casePath}>
        {children}
      </DesktopCaseHoverCard>
    );
  }

  return (
    <TouchCasePopover slug={slug} casePath={casePath}>
      {children}
    </TouchCasePopover>
  );
}

/**
 * Desktop (fine pointer): a hover-card. Opens on hover OR keyboard focus after a
 * ~350ms intent delay, interactive so the mouse can travel into it, and a click
 * still navigates to the case page (the trigger is a real link). No focus trap —
 * keyboard users read via the link + can Enter to navigate; Esc dismisses.
 */
function DesktopCaseHoverCard({
  slug,
  casePath,
  children,
}: {
  slug: string;
  casePath: string;
  children: ReactNode;
}) {
  return (
    <HoverCard openDelay={350} closeDelay={250}>
      <HoverCardTrigger asChild>
        <Link href={casePath} className={TRIGGER_CLASS}>
          {children}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start" className={CONTENT_WIDTH}>
        <CasePreview slug={slug} href={casePath} />
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * Touch (coarse pointer): tap opens a preview popover instead of navigating — a
 * deliberate replacement for navigate-on-tap, since hover previews are invisible
 * on phones (the §C ask). The trigger stays a real link (long-press "open link",
 * screen-reader "link" semantics, and a pre-JS fallback all keep working); the
 * tap prevents navigation and toggles the controlled popover, and the explicit
 * "Open case" action (≥44px) inside is how the user then reaches the case page.
 */
function TouchCasePopover({
  slug,
  casePath,
  children,
}: {
  slug: string;
  casePath: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <a
          href={casePath}
          className={TRIGGER_CLASS}
          onClick={(event) => {
            // Tap previews rather than navigates; "Open case" navigates.
            event.preventDefault();
            setOpen((previous) => !previous);
          }}
        >
          {children}
        </a>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        collisionPadding={16}
        // The shared PopoverContent animation (`data-open:animate-in …`) is not
        // motion-safe-gated, so force it off under reduced motion — the important
        // suffix beats the primitive's low-specificity `:where()` rule, giving an
        // instant, symmetric open/close there (owner #24). Normal motion keeps the
        // primitive's symmetric fade+zoom.
        className={cn(
          CONTENT_WIDTH,
          'gap-0 overflow-hidden p-0 motion-reduce:animate-none!',
        )}
      >
        <CasePreview slug={slug} href={casePath} />
      </PopoverContent>
    </Popover>
  );
}
