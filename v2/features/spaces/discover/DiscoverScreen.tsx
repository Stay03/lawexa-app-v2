'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { Compass, Search, Users } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SpaceCrest } from '@/v2/features/collab/kit/Crest';
import { CollabFailure } from '@/v2/features/collab/kit/CollabFailure';
import { useServerSearch } from '@/v2/features/spaces/use-server-search';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import type { DiscoverableSpace } from '@/types/collab';
import { useDiscoverSpaces } from '@/v2/features/invites/queries';
import { discoverRows } from './discover-model';
import { SpaceJoinAction } from './SpaceJoinAction';

/**
 * DiscoverScreen — the public spaces anybody can find, and the way in.
 *
 * ── A GUEST MAY READ, AND MUST BE TOLD WHY THEY CANNOT JOIN ────────────────
 * @staynjokede's ruling: guests read public spaces and their open channels; an
 * account is needed to join and to write. So the list is shown to everybody and
 * the refusal is EXPLAINED rather than silent. A button that does nothing, or a
 * bare "403", teaches somebody that Lawexa is broken — the honest version says
 * what to do instead and offers it.
 *
 * The server decides, not us: `POST /spaces/{uuid}/join` answers `403` for a
 * guest, and that is the answer we translate. We do not try to work out
 * guest-ness here, for the same reason the invite page does not — a guest
 * carries a real sign-in.
 *
 * ── ANYONE NEW JOINS AT ONCE (Arthur's A, 12 November 2026, thread dcd06933) ─
 * Every public space's card says "Join". A new person is in at once and the
 * card opens the space. Someone the Owner removed or turned down sends a
 * request instead (the server's `202`), and the card shows "Request sent"
 * with a way to take it back, as it does while that request waits
 * (`discoverAction`). Every signed-in account sees the list.
 */

function SpaceRow({ space }: { space: DiscoverableSpace }) {
  return (
    // ONE GRID, TWO SHAPES (techlead, 15 October 2026): on a phone the action
    // runs full width under the text, where a thumb is; from `md:` it sits at
    // its own size on the right of the title row, so a 640px card does not
    // carry a bar across its whole width.
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 rounded-xl border border-border/60 p-4 md:grid-cols-[auto_minmax(0,1fr)_auto]">
      {/* The crest and the name open the Space (Lucy's walk, 16 November 2026):
          a member lands in it, anyone else on its page with the way in. The
          crest is the same link for a pointer only; the name is the one a
          keyboard and a screen reader meet. */}
      <Link href={`/spaces/${space.uuid}`} tabIndex={-1} aria-hidden className="self-start">
        <SpaceCrest uuid={space.uuid} name={space.name} type={space.type} size="md" />
      </Link>
      <div className="min-w-0">
        <Link
          href={`/spaces/${space.uuid}`}
          className="block truncate rounded-sm text-[15px] font-semibold text-foreground underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {space.name}
        </Link>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <Users aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">
            {space.active_members_count}{' '}
            {space.active_members_count === 1 ? 'person' : 'people'} · {space.type_label}
            {space.owner?.name ? ` · by ${space.owner.name}` : ''}
          </span>
        </p>
        {space.description ? (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {space.description}
          </p>
        ) : null}
      </div>

      <SpaceJoinAction space={space} className="col-span-2 mt-3 md:col-span-1 md:mt-0 md:self-start" />
    </li>
  );
}

/**
 * The chrome, once. The title, the sentence under it and the search field are
 * the same at every stage of the wait, so they are written in ONE place and the
 * only thing that changes is what sits in the rows slot.
 *
 * This exists because the route boundary (`app/v2/spaces/discover/loading.tsx`)
 * has to paint the identical shape the live screen paints, and a hand-drawn
 * copy of a frame diverges from the real one within two design rounds — the
 * lesson `home-frame.ts` was built to enforce, applied here.
 *
 * `search` is the FIELD, passed in rather than assumed: the live screen gives a
 * real, typed-into input, and the fallback gives a still one that waits on
 * nothing. Static controls are a reserved shape and never a pulsing skeleton
 * (standards §8i) — only the rows pulse.
 */
function DiscoverFrame({
  search,
  children,
}: {
  search: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      {/* ONE TITLE PER SCREEN, AT EVERY WIDTH (phase 7). This route published
          NOTHING to the shell's bar, so a phone met it with the hamburger, an
          empty bar centre and no way back at all. "Find a space" is a fact about
          the address, so the bar states it below `md:` and this heading is drawn
          from `md:` up. It is stated at every width for assistive tech. */}
      <h1 className="sr-only md:not-sr-only md:flex md:items-center md:gap-2 md:text-2xl md:font-semibold md:text-foreground">
        <Compass aria-hidden className="hidden size-6 text-primary md:block" />
        Find a space
      </h1>
      <p className="text-sm text-muted-foreground md:mt-1.5">
        Public spaces anyone can join. Private ones never appear here.
      </p>

      <div className="relative mt-5">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        {search}
      </div>

      <div className="mt-5">{children}</div>
    </div>
  );
}

/** The three waiting cards, shared by the route boundary and the live screen so
 *  the hand-off between them moves nothing. */
function DiscoverRowsFallback() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  );
}

/**
 * The route-level fallback for `/spaces/discover`.
 *
 * Until the mobile overhaul's phase 8 this route had NO boundary of its own, so
 * a cold arrival fell through to the deliberately-empty v2 segment boundary and
 * the reader got a blank beat and then a finished page. Blank is the right
 * answer for a boundary that cannot know its destination; it is the wrong answer
 * for a destination that knows exactly what it looks like.
 *
 * The field here is `readOnly` rather than `disabled`: it is a picture of the
 * control that is about to arrive, and a disabled control announces itself as
 * refused. Read-only announces itself as not yet ready, which is the truth.
 */
export function DiscoverFallback() {
  return (
    <>
      {/* EVERY FALLBACK IN v2 ANNOUNCES ITSELF, and not only for the screen
          reader that is the point of it. Each line is distinct — "Loading case"
          against "Loading cases" — so the SEQUENCE of announcements across a
          navigation is the loading chain, readable by a test. That is what
          finally caught the wrong-shaped skeleton on 15 August after it had
          been declared fixed twice. A fallback that says nothing is invisible
          to that test, and this one was. */}
      <span role="status" className="sr-only">
        Loading public spaces
      </span>
      <DiscoverFrame
        search={
          <Input
            readOnly
            value=""
            placeholder="Search by name or description"
            className="pl-9"
            aria-label="Search public spaces"
          />
        }
      >
        <DiscoverRowsFallback />
      </DiscoverFrame>
    </>
  );
}

/**
 * Every signed-in account sees Discover since public shared spaces arrived
 * (Arthur, 15 October 2026). It was Team Channels' alone while only team
 * spaces could be public; the server still decides which rows each account
 * gets.
 */
export function DiscoverScreen() {
  return <DiscoverBody />;
}

function DiscoverBody() {
  // The server searches (names and descriptions), 300ms after the last keystroke.
  const search = useServerSearch();
  const term = search.term;
  const query = useDiscoverSpaces({ search: term || undefined });
  const rows = discoverRows(query.data?.pages);

  // Past the first 20 the next page loads as the list's end scrolls near
  // (Lucy's walk, 16 November 2026). Measured against the pane the page
  // scrolls in, found from the list's own element; the viewport when none.
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const paneRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    paneRef.current = anchorRef.current?.closest<HTMLElement>('[data-v2-scroller]') ?? null;
    return () => {
      paneRef.current = null;
    };
  }, []);
  const { fetchNextPage, refetch } = query;
  const sentinelRef = useInfiniteScrollSentinel<HTMLDivElement>({
    // A failed page is not retried by scrolling; its strip carries the retry.
    hasNextPage: query.hasNextPage && !query.isFetchNextPageError,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage,
    rootRef: paneRef,
    rootMargin: '320px',
  });

  return (
    <DiscoverFrame
      search={
        <Input
          value={search.value}
          onChange={(event) => search.setValue(event.target.value)}
          placeholder="Search by name or description"
          className="pl-9"
          aria-label="Search public spaces"
        />
      }
    >
      <div ref={anchorRef}>
        {query.isPending ? (
          <DiscoverRowsFallback />
        ) : query.isError && rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Couldn&rsquo;t load spaces. Check your connection and try again.
          </p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {term ? `Nothing matches “${term}”.` : 'There are no public spaces yet.'}
          </p>
        ) : (
          <>
            <ul className="space-y-3">
              {rows.map((space) => (
                <SpaceRow key={space.uuid} space={space} />
              ))}
            </ul>
            <div ref={sentinelRef} className="pt-3">
              {query.isFetchingNextPage ? (
                <Skeleton aria-hidden className="h-28 w-full rounded-xl motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200" />
              ) : null}
            </div>
            {query.isError ? (
              <CollabFailure
                className="mt-2"
                message="Couldn’t load more spaces."
                onRetry={() => void (query.isFetchNextPageError ? fetchNextPage() : refetch())}
              />
            ) : null}
          </>
        )}
      </div>
    </DiscoverFrame>
  );
}
