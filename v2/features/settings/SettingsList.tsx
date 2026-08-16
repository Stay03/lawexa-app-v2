import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * settings/SettingsList — the row grammar of the settings screen, and the only
 * place it is written.
 *
 * ── WHAT WAS COPIED, AND FROM WHERE ────────────────────────────────────────
 * The owner sent four phone screenshots on 16 August 2026 (three of Claude's
 * settings, one of ChatGPT's) and named the part to take: rows GROUPED into
 * filled rounded blocks, a hairline between rows INSIDE a block, a clear gap
 * BETWEEN blocks, and each row an icon, a label, and a quiet value under the
 * label where there is one. No chevrons — the whole row is the target, and a
 * glyph that only ever says "this is a link" on every row of a list of links
 * says nothing.
 *
 * ── AND WHAT WAS NOT ───────────────────────────────────────────────────────
 * Both reference apps put a HAMBURGER on this screen, because settings is
 * top-level in their navigation. In ours it is reached from the header's
 * overflow menu, so it is a screen you PUSHED into: a back arrow, the title in
 * the bar below `md:`, and no hamburger (`v2/shell/pushed-route.ts`).
 *
 * ── ONE COLUMN AT EVERY WIDTH, AND NO SETTINGS SIDEBAR ─────────────────────
 * v1 puts a second vertical nav column inside the settings page
 * (`components/settings/settings-sidebar-nav.tsx`) with the chosen page beside
 * it. That does not come across, for three reasons:
 *
 *  1. v2 already has a persistent rail on the left. A settings sidebar makes a
 *     THIRD level of navigation visible at once on a wide screen, and squeezes
 *     the content into the middle — the exact complaint that produced
 *     `page-columns.ts`.
 *  2. Under the header rule shipped this week, each option is its own pushed
 *     screen with its own way back. Master/detail says the opposite: that the
 *     list is always beside you and you never go back.
 *  3. It is a different row grammar from the one the owner asked for — a
 *     14px label with a 12px description under it, in a 240px column.
 *
 * So the desktop treatment is the SAME screen in a reading column, and the only
 * thing that changes with the width is WHERE THE TITLE IS: the bar carries it
 * below `md:`, the page draws it from `md:` up. One design at every width, which
 * is also the only way the row grammar can stay one grammar.
 */

/**
 * The settings reading column — deliberately narrower than `LIST_COLUMN`.
 *
 * NOT a drift from `v2/shell/page-columns.ts`: that constant is the one measure
 * for the LIST pages, whose rows carry a name, a citation-bearing meta line and
 * a two-line holding and genuinely earn `max-w-3xl`. A settings row is a short
 * label with at most one quiet line under it. At the list measure the label sits
 * alone at the far left of a very wide filled block, which reads as an empty
 * shelf rather than a row. `/spaces/discover` already sets the same narrower
 * measure for the same reason.
 */
export const SETTINGS_COLUMN = 'mx-auto w-full max-w-2xl px-4 pb-16 pt-4 sm:pt-6';

/**
 * THE FILLED BLOCK ITSELF: a rounded card of rows with a hairline between them.
 *
 * Exported because the settings screens that hold a FORM build their blocks out
 * of the same shape (`SettingsForm.tsx`), and a second copy of these four
 * utilities is a second block that reads as the same block only until one of
 * them is retuned.
 */
export const SETTINGS_BLOCK =
  'divide-y divide-border/70 overflow-hidden rounded-2xl bg-secondary';

/**
 * A filled block of rows.
 *
 * `overflow-hidden` clips the rows' hover tint to the block's rounded corners,
 * so the top and bottom rows do not paint square shoulders over them. It is
 * also why the rows use an INSET focus ring instead of the shared `FOCUS_RING`:
 * an offset ring would be clipped away by exactly the same rule, and a focus
 * ring you cannot see is worse than a slightly different one. `ring-inset` is
 * the same answer a dozen v1 cards already use.
 *
 * The label is stated for assistive technology and never drawn — see
 * {@link SettingsGroup} in `rows.ts` for why the blocks carry no visible
 * headings.
 */
export function SettingsBlock({
  id,
  label,
  children,
}: {
  /** The group's stable key from `rows.ts`. Used to tie the block to its
   *  invisible heading, so it must stay free of whitespace — an
   *  `aria-labelledby` value is a space-separated LIST of ids, and a label like
   *  "Your account" pasted into one would name nothing. */
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  const headingId = `settings-group-${id}`;
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="sr-only">
        {label}
      </h2>
      <ul className={SETTINGS_BLOCK}>{children}</ul>
    </section>
  );
}

/**
 * ONE settings row: a whole-row link, an icon, a label, and a quiet value under
 * the label where the screen honestly has one.
 *
 * `min-h-14` (56px) rather than the 44px accessibility floor: these are the
 * calmest rows in the product and the reference sets them at roughly this
 * height, so the block reads as a list of destinations rather than a dense
 * table. The press state is not written here — `v2/shell/touch-press.tsx` marks
 * the closest tappable ancestor of a finger, and an `a[href]` is one.
 */
export function SettingsLinkRow({
  href,
  icon: Icon,
  label,
  value,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  /**
   * The quiet second line. Rendered only when the screen can read it cheaply
   * and honestly — never a guess, never a fetch made to fill this line.
   */
  value?: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          'group v2-interactive flex min-h-14 items-center gap-3.5 px-4 py-2.5',
          'transition-colors duration-150 hover:bg-foreground/[0.04] motion-reduce:transition-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        )}
      >
        <Icon
          aria-hidden
          className="size-5 shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-foreground motion-reduce:transition-none"
        />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] leading-snug font-medium text-foreground">
            {label}
          </span>
          {value != null ? (
            <span className="truncate text-[13px] leading-snug text-muted-foreground">
              {value}
            </span>
          ) : null}
        </span>
      </Link>
    </li>
  );
}

/**
 * One height per block, at the live row height (`min-h-14`, 3.5rem) times the
 * signed-in row count: 2, 4, 2, 1. Written as literal classes rather than
 * computed, because Tailwind v4 scans source TEXT and would never see a class
 * assembled at runtime.
 */
const FALLBACK_BLOCK_HEIGHTS = ['h-28', 'h-56', 'h-28', 'h-14'] as const;

/**
 * The screen's silhouette, drawn by `app/v2/settings/loading.tsx` while the
 * route segment resolves.
 *
 * It draws the SAME blocks in the SAME column at the SAME row heights as the
 * live screen, so the hand-off moves nothing. The row COUNTS are the signed-in
 * shape (2 / 4 / 2 / 1); a guest sees fewer rows arrive than were reserved,
 * which settles upward and is the harmless direction for a list to change in.
 *
 * `aria-hidden` + `inert`: a fallback is deleted rather than reconciled, so
 * nothing focusable may live in it. The one announcement lives outside it.
 */
export function SettingsFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Opening settings
      </span>
      <div aria-hidden inert className={SETTINGS_COLUMN}>
        <Skeleton className="mb-5 hidden h-8 w-32 rounded-lg md:block" />
        {/* 68px: the card's 40px avatar plus its 14px of padding, top and
            bottom. It is measured off the live card so the two agree. */}
        <Skeleton className="h-[4.25rem] w-full rounded-2xl" />
        <div className="mt-4 flex flex-col gap-4">
          {FALLBACK_BLOCK_HEIGHTS.map((height, index) => (
            <Skeleton key={index} className={cn('w-full rounded-2xl', height)} />
          ))}
        </div>
      </div>
    </>
  );
}
