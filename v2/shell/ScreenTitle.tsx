'use client';

import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { topLevelScreenFor } from './top-level-route';

/**
 * ScreenTitle — a top-level screen's ONE heading, in the page body where the
 * owner's rule puts it.
 *
 * These screens used to print a small title in the BAR and none in the page,
 * which is the exact inverse of the grammar `pushed-route.ts` documents. Worse,
 * they printed no `<h1>` at all: a reader on a screen reader landed on `/cases`,
 * `/statutes`, `/notes`, `/folders`, `/bookmarks`, `/radars`, `/spaces`,
 * `/channels` or `/conversations` and found a document with no heading of any
 * level naming it. This is both halves of that fix — the title moves into the
 * page AND becomes a real heading — which is why it is an `h1` and not a styled
 * `div`.
 *
 * ── IT READS THE TABLE, IT DOES NOT TAKE THE TEXT ──────────────────────────
 * The title comes from `top-level-route.ts`, off the pathname, for the same
 * reason the bar's does: one table, one answer, no screen able to disagree with
 * another about what it is called. It also means the route FALLBACKS can render
 * this component and get the right words — the title is static chrome, so it
 * must be on the pixels before the rows are, and a fallback that had to be
 * handed the string would drift from the screen within two design rounds.
 *
 * A screen whose table entry is `null` already owns its heading (the home's
 * greeting, the quiz hub's hero sentence). This renders NOTHING for those, so
 * adopting it can never mint a second `h1`.
 *
 * ── SCALE ──────────────────────────────────────────────────────────────────
 * `text-[1.75rem]` on a phone stepping to `text-3xl` from `sm:`. That is the
 * page-title scale the home greeting already uses at its smallest
 * (`HOME_GREETING_HEADING_FOCUSED`), so a reader moving from the home to a
 * library meets one typographic idea of "this is the screen" rather than two.
 * The serif reading face is deliberately NOT used: that face belongs to
 * documents (a case, a statute, a note), and a library is not one.
 */
export function ScreenTitle({ className }: { className?: string }) {
  const screen = topLevelScreenFor(usePathname() ?? '');
  if (screen?.title == null) return null;

  return (
    <h1
      className={cn(
        'mb-3 text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground sm:text-3xl',
        className,
      )}
    >
      {screen.title}
    </h1>
  );
}
