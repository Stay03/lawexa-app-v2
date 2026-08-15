'use client';

import Link from 'next/link';
import { FolderOpen, FolderX, Search, WifiOff, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FOLDER_ITEM_NOUN } from '../item-row-model';
import type { FolderItemTab } from './item-tabs';

/**
 * The folder page's states — the three-state contract every v2 query region
 * owns (standards §8iv), plus the one this surface needs:
 *
 *  - NOT FOUND / NOT YOURS. `GET /folders/{uuid}` answers 404 for a uuid that
 *    does not exist AND for another account's private folder (probed), so both
 *    land on one honest sentence rather than a guess about which it was.
 *
 * The page has TWO query regions and they fail independently: the folder itself
 * (name, breadcrumb, subfolders) and its items. A failed items request must not
 * take the header with it, which is why the item states below are separate
 * components rather than one page-level error.
 */

function PageState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-14 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground"
      >
        <Icon className="size-6" />
      </span>
      <div className="space-y-1.5">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

/**
 * One skeleton row for the stream, mirroring `FolderItemRow`'s geometry exactly
 * (`gap-3 px-2 py-3`, a `size-9` tile, a two-zone meta line), so nothing
 * reflows on hand-off.
 *
 * TWO TEXT LINES, the stream's MEDIAN: cases, statutes, files and subfolders
 * are two lines and only notes add a preview clamp. Reserving at the tall end
 * would defend against a settle that rarely happens while making the common one
 * — collapsing onto a two-line row — worse.
 */
function StreamRowSkeleton() {
  return (
    <div className="flex min-w-0 items-start gap-3 px-2 py-3">
      <Skeleton className="mt-0.5 size-9 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-3/5 rounded" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-2/5 rounded" />
          <Skeleton className="ml-auto h-3 w-16 shrink-0 rounded" />
        </div>
      </div>
    </div>
  );
}

/** The stream's initial-load skeleton — progressive opacity down the stack, the
 *  shared v2 list fade. */
export function FolderStreamSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.16) }}>
          <StreamRowSkeleton />
        </div>
      ))}
    </div>
  );
}

/** The next-page skeleton shown at the sentinel while a page is in flight. */
export function FolderNextPageSkeleton() {
  return (
    <div
      aria-hidden
      className="flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
    >
      <StreamRowSkeleton />
      <div style={{ opacity: 0.5 }}>
        <StreamRowSkeleton />
      </div>
    </div>
  );
}

/**
 * The WHOLE-PAGE skeleton: the trail, the header and the stream, in the exact
 * geometry the resolved page uses. ONE drawing for the route fallback and the
 * live pending state, and one appearance too: it pulses in both (standards
 * §8i), because a reader cannot tell an RSC payload from a query and a shape
 * that changed behaviour at the hand-off would read as the load starting again.
 *
 * The tab strip is NOT reserved: whether it exists depends on what the folder
 * turns out to hold, and reserving space for a control that may never arrive
 * would leave a permanent gap above every single-type folder.
 */
export function FolderDetailSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      {/* THE SILHOUETTE FOLLOWS THE LIVE HEADER, WHICH LOST TWO THINGS ON A
          PHONE (phase 7): the trail is `sm:` and up (the shell's bar carries the
          way back below it), the name is `md:` and up (the bar carries it), and
          the kebab has gone entirely — Rename and Delete are published to the
          bar's one menu. Reserving any of the three here would have left the
          rows below them jumping at the hand-off. */}
      <Skeleton className="hidden h-4 w-40 rounded sm:block" />
      <div className="flex items-start gap-3 sm:mt-4">
        <Skeleton className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2 pt-0.5">
          <Skeleton className="hidden h-6 w-3/5 rounded md:block" />
          <Skeleton className="h-3.5 w-40 rounded" />
        </div>
      </div>
      <div className="mt-6 border-t border-border/60 pt-2">
        <FolderStreamSkeleton />
      </div>
    </div>
  );
}

/**
 * NOT FOUND — and deliberately not "you don't have permission".
 *
 * The server answers 404 for a folder that never existed, one that was deleted,
 * and one that belongs to somebody else and is private. This screen cannot tell
 * those apart and does not pretend to; naming the wrong one would be worse than
 * naming none.
 */
export function FolderNotFoundState() {
  return (
    <PageState
      icon={FolderX}
      title="This folder isn't here"
      description="It may have been deleted, or it may belong to another account. Your own folders are all in one place."
      action={
        <Button asChild size="sm">
          <Link href="/folders">Back to your folders</Link>
        </Button>
      }
    />
  );
}

/**
 * BEING DELETED — the page you can only arrive at by going BACK into a folder
 * you just deleted, inside its undo window.
 *
 * Without it the route repaints the folder completely alive (the detail query
 * refetches on every visit), Delete menu and all, and then flips to "This
 * folder isn't here" the moment the queued request lands — a screen that
 * contradicts itself twice in six seconds. This says the true thing for those
 * six seconds and points at the control that can still stop it.
 */
export function FolderDeletingState() {
  return (
    <PageState
      icon={FolderX}
      title="This folder is being deleted"
      description="Nothing has been sent yet. The message at the edge of the screen can still undo it."
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/folders">Back to your folders</Link>
        </Button>
      }
    />
  );
}

/** The folder itself failed to load — distinct from "not found", with a retry. */
export function FolderErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <PageState
      icon={WifiOff}
      title="Couldn't open this folder"
      description={
        message?.trim() ||
        'Something went wrong while loading this folder. Please try again.'
      }
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

/** The ITEMS failed while the folder itself is fine — scoped to the stream, so
 *  the header, the breadcrumb and the subfolders stay usable. */
export function FolderItemsErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <PageState
      icon={WifiOff}
      title="Couldn't load what's in here"
      description={
        message?.trim() ||
        'Something went wrong while loading this folder’s contents. Please try again.'
      }
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

/**
 * The honest footnote for items the stream deliberately did not render.
 *
 * ── WHY A COUNT NEEDS A NOTE AT ALL ─────────────────────────────────────────
 * The header count is the SERVER's `items_count`, and the server counts things
 * v2 does not render: a chat filed by v1 (never shown — the items endpoint
 * serves other people's private conversation titles, which is the wave's urgent
 * backend ask) and a folder filed as an ITEM rather than nested. Leaving that
 * gap unexplained is exactly v1's defect — a stat line contradicting the rows
 * underneath it — so the difference is stated quietly, only when there is one.
 * When the whole page maps to nothing, this note IS the answer: a folder that
 * holds three chats is not an empty folder, and must not be told it is.
 *
 * ── THREE COUNTS, THREE SENTENCES, NEVER A TOTAL ────────────────────────────
 * They are different claims and merging them makes each of them false. A chat
 * is something v2 CHOOSES not to show; a folder-as-item is something v2 shows
 * differently (as a subfolder, above); an unknown type is something this build
 * genuinely cannot open. One merged sentence over one merged total would say
 * "this version can't open them" about a folder that is rendered ten pixels
 * higher. So each count speaks only for itself, and a category with nothing in
 * it says nothing at all.
 */
export function HiddenItemsNote({
  chats,
  folderItems,
  unknown,
}: {
  /** `conversation` rows — dropped for the id-enumeration leak. */
  chats: number;
  /** `folder`-as-item rows — nesting is the folder tree, not an item type. */
  folderItems: number;
  /** Items of a type this build does not model at all. */
  unknown: number;
}) {
  if (chats + folderItems + unknown === 0) return null;

  return (
    <div className="px-2 pt-3 text-xs text-muted-foreground/80 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      {chats > 0 ? (
        <p>
          {chats === 1
            ? '1 chat is filed here. Chats are not shown in folders.'
            : `${chats} chats are filed here. Chats are not shown in folders.`}
        </p>
      ) : null}
      {folderItems > 0 ? (
        <p>
          {folderItems === 1
            ? '1 folder is filed here as an item. Folders belong above, as subfolders.'
            : `${folderItems} folders are filed here as items. Folders belong above, as subfolders.`}
        </p>
      ) : null}
      {unknown > 0 ? (
        <p>
          {unknown === 1
            ? "1 item filed here can't be opened by this version of Lawexa."
            : `${unknown} items filed here can't be opened by this version of Lawexa.`}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The subfolder count and the subfolder ROWS come from two fields of one
 * payload (`children_count` and `children`), and every probe had them agree.
 * If they ever do not — a server-side cap on the embedded array is the obvious
 * way that happens — this says so rather than letting a folder quietly appear
 * to have fewer subfolders than its own header claims.
 */
export function SubfolderGapNote({
  shown,
  counted,
}: {
  shown: number;
  counted: number;
}) {
  if (shown >= counted) return null;
  return (
    <p className="px-2 pt-3 text-xs text-muted-foreground/80">
      Showing {shown} of {counted} subfolders.
    </p>
  );
}

/**
 * Empty — tab-aware, because "this folder is empty" and "there are no statutes
 * in it" are different facts that want different ways forward.
 *
 * THE EMPTY-FOLDER COPY NAMES WHERE FILING HAPPENS. Nothing is added from this
 * page: a case, a statute or a note is filed from the DOCUMENT, with the "Add
 * to folder" control beside its bookmark star. Saying so is the difference
 * between an empty screen and an instruction.
 */
export function FolderEmptyState({
  tab,
  onShowAll,
}: {
  tab: FolderItemTab;
  /** Offered on a filtered tab only — the way back to the whole folder. */
  onShowAll?: () => void;
}) {
  if (tab !== 'all') {
    const noun = FOLDER_ITEM_NOUN[tab];
    return (
      <PageState
        icon={Search}
        title={`No ${noun}s in this folder`}
        description={`Nothing filed here is a ${noun}.`}
        action={
          onShowAll ? (
            <Button variant="outline" size="sm" onClick={onShowAll}>
              Show everything
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <PageState
      icon={FolderOpen}
      title="Nothing filed here yet"
      description="Open a case, a statute or a note and choose “Add to folder” to file it here."
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/cases">Browse cases</Link>
        </Button>
      }
    />
  );
}
