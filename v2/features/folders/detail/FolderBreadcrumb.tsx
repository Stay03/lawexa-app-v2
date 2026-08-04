'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { folderHref, folderPathSegments } from '../folder-row-model';
import type { FolderRecord } from '../types';

/**
 * FolderBreadcrumb — the way back up, and an object lesson in only claiming
 * what the payload can address.
 *
 * ── WHAT THE SERVER ACTUALLY GIVES US ───────────────────────────────────────
 * The folder detail carries `parent` — ONE level, with a uuid — and
 * `slug_path`, the full chain from the root as SLUGS
 * ("contract-law/damages/mitigation", the folder's own slug last). There is no
 * ancestor list. So for a folder three deep we know:
 *
 *   the root         addressable  → `/folders`, always a link
 *   the parent       addressable  → its uuid is in the payload
 *   everything else  NOT addressable: a slug is not an address (the slug route
 *                    404s, and sibling folders may share one), and de-slugging
 *                    "contract-law" into "Contract law" would be INVENTING a
 *                    name — the real one may be "Contract Law (2026)".
 *
 * ── SO THE CRUMB SAYS EXACTLY THAT ──────────────────────────────────────────
 *
 *   Folders  ›  …  ›  Damages  ›  Mitigation
 *   ───────    ───    ───────     ─────────
 *   link      inert    link      current page
 *
 * The ellipsis is not decoration and it is not an overflow menu: it is the
 * honest shape of "there are N levels here that this screen cannot open". It
 * carries the raw path on its `title` and a count for a screen reader, so the
 * reader learns the depth without being handed a dead link or a made-up name.
 * When there is nothing between the root and the parent it does not render.
 *
 * ── MOBILE IS ONE NAMED LINK, NOT A SHRUNKEN CRUMB ──────────────────────────
 * Below `sm` the trail becomes a single "← Damages" (or "← Folders" at the
 * root): one 44px target that names where it goes, instead of four crumbs
 * competing for a phone's width. It is `display:none` on desktop and the crumb
 * is `display:none` on mobile, so only one of them is ever in the accessibility
 * tree.
 */
export function FolderBreadcrumb({ folder }: { folder: FolderRecord }) {
  const parent = folder.parent ?? null;
  const segments = folderPathSegments(folder.slug_path);
  // Own slug, plus the parent's when we have one addressable parent.
  const named = parent ? 2 : 1;
  const hiddenCount = Math.max(0, segments.length - named);
  const hiddenPath = segments.slice(0, Math.max(0, segments.length - named)).join(' / ');

  const upHref = parent ? folderHref(parent.uuid) : '/folders';
  const upLabel = parent ? parent.name : 'Folders';

  return (
    <>
      {/* Desktop: the full trail. */}
      <nav aria-label="Breadcrumb" className="hidden sm:block">
        <ol className="flex items-center gap-1 text-xs text-muted-foreground">
          <li className="shrink-0">
            <Crumb href="/folders">Folders</Crumb>
          </li>

          {hiddenCount > 0 ? (
            <>
              <Separator />
              <li className="shrink-0">
                <span
                  className="cursor-default px-1 text-muted-foreground/70"
                  title={`Path: ${hiddenPath}`}
                >
                  &hellip;
                </span>
                <span className="sr-only">
                  {hiddenCount} more{' '}
                  {hiddenCount === 1 ? 'folder' : 'folders'} above, not
                  linkable from here
                </span>
              </li>
            </>
          ) : null}

          {parent ? (
            <>
              <Separator />
              <li className="min-w-0">
                <Crumb href={folderHref(parent.uuid)}>{parent.name}</Crumb>
              </li>
            </>
          ) : null}

          <Separator />
          <li className="min-w-0">
            <span
              aria-current="page"
              className="block truncate px-1 py-0.5 text-foreground"
              title={folder.name}
            >
              {folder.name}
            </span>
          </li>
        </ol>
      </nav>

      {/* Phone: one named link up. */}
      <Link
        href={upHref}
        className={cn(
          'v2-interactive -ml-2 inline-flex min-h-9 max-w-full items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:text-foreground sm:hidden',
          FOCUS_RING,
        )}
      >
        <ChevronLeft aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">{upLabel}</span>
      </Link>
    </>
  );
}

function Crumb({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        'v2-interactive block truncate rounded px-1 py-0.5 transition-colors hover:text-foreground',
        FOCUS_RING,
      )}
    >
      {children}
    </Link>
  );
}

/** Decorative, so it never reaches a screen reader as a word. */
function Separator() {
  return (
    <li aria-hidden className="shrink-0">
      <ChevronRight className="size-3 text-muted-foreground/40" />
    </li>
  );
}
