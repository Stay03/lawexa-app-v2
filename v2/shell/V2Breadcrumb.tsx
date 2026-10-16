'use client';

import { Fragment, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCaseName } from '@/v2/features/cases/case-name';
import { casesQueries } from '@/v2/features/cases/queries';
import { channelsQueries } from '@/v2/features/channels/queries';
import { channelDisplayName } from '@/v2/features/channels/thread-model';
import type { CollabHeaderContext } from '@/v2/features/collab/shell/collab-header';
import { conversationsQueries } from '@/v2/features/conversations/queries';
import { foldersQueries } from '@/v2/features/folders/queries';
import { noteDisplayTitle } from '@/v2/features/notes/note-text';
import { notesQueries } from '@/v2/features/notes/queries';
import { useCachedSpaceIdentity } from '@/v2/features/spaces/detail/cached-identity';
import { spacesQueries } from '@/v2/features/spaces/queries';
import { statutesQueries } from '@/v2/features/statutes/queries';
import { useV2Session } from '@/v2/runtime/session-context';
import {
  NO_BREADCRUMB_DATA,
  breadcrumbTrail,
  trailRouteFor,
  type BreadcrumbTrail,
} from './breadcrumb-trail';
import { FOCUS_RING } from './designs/modules';
import type { HeaderPlace } from './header-place';

/**
 * V2Breadcrumb — the desktop bar's trail: where the reader is, from `md:` up
 * (Arthur, 16 October 2026). It takes the slot the quiet "Case" label held,
 * and the parts come from `breadcrumb-trail.ts`.
 *
 * ── NOTHING HERE FETCHES ───────────────────────────────────────────────────
 * Every name is one the screen has already asked for: each query here is
 * `enabled: false`, which subscribes to the screen's cache entry and never
 * requests it. A live observer would refetch on every visit
 * (`REFETCH_ON_VISIT` is `'always'`), doubling the screen's own request. The
 * rest is published: the chat's title and space, the collab frame's space
 * name, and the screen's own crumb (`screen-context.ts`).
 *
 * ── A NAME NOT KNOWN YET IS A SKELETON ─────────────────────────────────────
 * The stores and the cache are empty on the server and on the first client
 * paint, so both draw the same skeleton parts and hydration never disagrees.
 * The skeleton is never a link: a link with no name is a stop with nothing
 * to say.
 *
 * ── ONLY THE LAST PART TRUNCATES ───────────────────────────────────────────
 * The parents are short and are the way back, so they keep their width; the
 * current page gives way. CSS only (`min-w-0 truncate`): the bar measures
 * nothing in JS (`case-chat-phone-screen.test.ts`).
 *
 * `hidden md:flex`: below `md:` the bar has no room and a back arrow already
 * says where up is, so nothing changes on a phone.
 */
export function V2Breadcrumb({
  pathname,
  chatTitle,
  chatSpace,
  confidential,
  collab,
  crumb,
}: {
  pathname: string;
  /** The published route title (`header-context.ts`). */
  chatTitle: string | null;
  /** The space a chat is in (`header-place.ts`). */
  chatSpace: HeaderPlace | null;
  /** The published confidential flag: a confidential chat is in no space. */
  confidential: boolean;
  collab: CollabHeaderContext | null;
  /** The screen's own last part (`screen-context.ts`). */
  crumb: string | null;
}) {
  const route = trailRouteFor(pathname);
  switch (route.kind) {
    case 'space':
      return (
        <SpaceTrail
          pathname={pathname}
          spaceUuid={route.spaceUuid}
          collab={collab}
          tabLabel={crumb}
        />
      );
    case 'discover': {
      const trail = breadcrumbTrail(pathname, NO_BREADCRUMB_DATA);
      return trail ? <TrailView trail={trail} /> : null;
    }
    case 'channel':
      return (
        <ChannelTrail pathname={pathname} channelUuid={route.channelUuid} collab={collab} />
      );
    case 'chat':
      return (
        <ChatTrail
          pathname={pathname}
          conversationId={route.conversationId}
          chatTitle={chatTitle}
          chatSpace={chatSpace}
          confidential={confidential}
        />
      );
    case 'folder':
      return <FolderTrail pathname={pathname} uuid={route.uuid} />;
    case 'note':
      return <NoteTrail pathname={pathname} slug={route.slug} />;
    case 'statute':
      return <StatuteTrail pathname={pathname} slug={route.slug} sectionLabel={crumb} />;
    case 'case': {
      const pending = breadcrumbTrail(pathname, NO_BREADCRUMB_DATA);
      // `?q=` is part of the case's cache key and `useSearchParams` needs a
      // boundary (the `app/v2/layout.tsx` convention); until it resolves the
      // trail is the same one with the title still a skeleton.
      return (
        <Suspense fallback={pending ? <TrailView trail={pending} /> : null}>
          <CaseTrail pathname={pathname} slug={route.slug} />
        </Suspense>
      );
    }
    case 'none':
      return null;
  }
}

/** The space's name: the screen's cached detail, else its list row, else the
 *  collab frame's publish, which arrives a paint after the other two. */
function SpaceTrail({
  pathname,
  spaceUuid,
  collab,
  tabLabel,
}: {
  pathname: string;
  spaceUuid: string;
  collab: CollabHeaderContext | null;
  tabLabel: string | null;
}) {
  const { userId: viewerId } = useV2Session();
  const { data } = useQuery({
    ...spacesQueries.detail(spaceUuid, { viewerId }),
    enabled: false,
  });
  const cached = useCachedSpaceIdentity(spaceUuid);
  const published = collab?.spaceUuid === spaceUuid ? collab.spaceName : null;
  const spaceName = data?.data?.name ?? cached?.name ?? published ?? null;
  const trail = breadcrumbTrail(pathname, { ...NO_BREADCRUMB_DATA, spaceName, tabLabel });
  return trail ? <TrailView trail={trail} /> : null;
}

/** A channel names itself and its space from the frame's own channel read;
 *  the collab frame's publish fills the space in while that is pending. */
function ChannelTrail({
  pathname,
  channelUuid,
  collab,
}: {
  pathname: string;
  channelUuid: string;
  collab: CollabHeaderContext | null;
}) {
  const { userId: viewerId } = useV2Session();
  const { data } = useQuery({
    ...channelsQueries.detail(channelUuid, { viewerId }),
    enabled: false,
  });
  const channel = data?.data ?? null;
  const trail = breadcrumbTrail(pathname, {
    ...NO_BREADCRUMB_DATA,
    // The name only from the record: it alone says whether this is a thread,
    // which takes no `#`. The frame's publish is read from the same entry.
    channelName: channel ? channelDisplayName(channel) : null,
    channelIsThread: channel?.is_thread ?? false,
    channelSpaceUuid: channel?.space.uuid ?? collab?.spaceUuid ?? null,
    channelSpaceName: channel?.space.name ?? collab?.spaceName ?? null,
  });
  return trail ? <TrailView trail={trail} /> : null;
}

/**
 * A chat is personal once its record says it is in no space, or once it is
 * known to be confidential (which never names a space, and whose record the
 * detail fetcher refuses, so it may never reach the cache). A record that names a space waits for the chat's own place
 * publish, which applies the chat's rules about who may see it. Until one of
 * those answers, the first part is a skeleton.
 */
function ChatTrail({
  pathname,
  conversationId,
  chatTitle,
  chatSpace,
  confidential,
}: {
  pathname: string;
  conversationId: string;
  chatTitle: string | null;
  chatSpace: HeaderPlace | null;
  confidential: boolean;
}) {
  const { userId: viewerId } = useV2Session();
  const { data } = useQuery({
    ...conversationsQueries.detail({ conversationId, viewerId }),
    enabled: false,
  });
  const chatIsPersonal =
    confidential || (data !== undefined && (data.is_confidential === true || !data.space));
  const trail = breadcrumbTrail(pathname, {
    ...NO_BREADCRUMB_DATA,
    chatTitle,
    chatSpace,
    chatIsPersonal,
  });
  return trail ? <TrailView trail={trail} /> : null;
}

/** The folder's name and its one parent, from the screen's detail read. */
function FolderTrail({ pathname, uuid }: { pathname: string; uuid: string }) {
  const { userId: viewerId } = useV2Session();
  const { data } = useQuery({ ...foldersQueries.detail({ uuid, viewerId }), enabled: false });
  const folder = data?.data ?? null;
  const parent = folder?.parent ?? null;
  const trail = breadcrumbTrail(pathname, {
    ...NO_BREADCRUMB_DATA,
    folderName: folder?.name ?? null,
    folderParent: parent ? { uuid: parent.uuid, name: parent.name } : null,
  });
  return trail ? <TrailView trail={trail} /> : null;
}

/** The note's title as its masthead prints it, "Untitled" included. */
function NoteTrail({ pathname, slug }: { pathname: string; slug: string }) {
  const { userId: viewerId } = useV2Session();
  const { data } = useQuery({ ...notesQueries.detail({ slug, viewerId }), enabled: false });
  const note = data?.data ?? null;
  const trail = breadcrumbTrail(pathname, {
    ...NO_BREADCRUMB_DATA,
    noteTitle: note ? noteDisplayTitle(note.title) : null,
  });
  return trail ? <TrailView trail={trail} /> : null;
}

function StatuteTrail({
  pathname,
  slug,
  sectionLabel,
}: {
  pathname: string;
  slug: string;
  sectionLabel: string | null;
}) {
  const { data } = useQuery({ ...statutesQueries.detail(slug), enabled: false });
  const detail = data?.data ?? null;
  const statuteTitle = detail ? detail.short_title?.trim() || detail.title : null;
  const trail = breadcrumbTrail(pathname, {
    ...NO_BREADCRUMB_DATA,
    statuteTitle,
    sectionLabel,
  });
  return trail ? <TrailView trail={trail} /> : null;
}

/** The case's name as its masthead prints it (`CaseDocument`). */
function CaseTrail({ pathname, slug }: { pathname: string; slug: string }) {
  const searchQuery = useSearchParams().get('q')?.trim() || undefined;
  const { data } = useQuery({ ...casesQueries.detail(slug, searchQuery), enabled: false });
  const detail = data?.data ?? null;
  const caseTitle = detail ? formatCaseName(detail.display_title || detail.title) : null;
  const trail = breadcrumbTrail(pathname, { ...NO_BREADCRUMB_DATA, caseTitle });
  return trail ? <TrailView trail={trail} /> : null;
}

const CRUMB_LINK = cn(
  'v2-interactive block whitespace-nowrap rounded-md px-1.5 py-1 hover:bg-muted hover:text-foreground dark:hover:bg-muted/50',
  FOCUS_RING,
);

function TrailView({ trail }: { trail: BreadcrumbTrail }) {
  const last = trail.parts.length - 1;
  return (
    <Breadcrumb className="hidden min-w-0 items-center gap-2 md:flex">
      <Separator orientation="vertical" className="mr-1 h-4" />
      <BreadcrumbList className="min-w-0 flex-nowrap gap-0.5 sm:gap-0.5">
        {trail.parts.map((part, index) => (
          <Fragment key={index}>
            {index > 0 ? (
              <BreadcrumbSeparator className="text-muted-foreground opacity-60">
                <ChevronRight />
              </BreadcrumbSeparator>
            ) : null}
            {index === last ? (
              <BreadcrumbItem className="min-w-0">
                {part.label === null ? (
                  <CrumbSkeleton />
                ) : (
                  <BreadcrumbPage className="min-w-0 truncate px-1.5 py-1 font-medium text-foreground">
                    {part.label}
                  </BreadcrumbPage>
                )}
              </BreadcrumbItem>
            ) : (
              <BreadcrumbItem className="shrink-0">
                {part.label === null ? (
                  <CrumbSkeleton />
                ) : part.href ? (
                  <BreadcrumbLink asChild className={CRUMB_LINK}>
                    <Link href={part.href}>{part.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <span className="whitespace-nowrap px-1.5 py-1">{part.label}</span>
                )}
              </BreadcrumbItem>
            )}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/** A name still on its way: a text-height bar, at a word's width. */
function CrumbSkeleton() {
  return <Skeleton aria-hidden className="mx-1.5 my-1 h-3.5 w-24 rounded-full" />;
}
