'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

import { extractApiError } from '@/lib/utils/api-error';
import type { SpaceConversation, SpaceFile, SpaceFolder } from '@/types/collab';
import { collabAccessState } from '@/v2/features/collab/model';
import { ConversationRow } from '@/v2/features/conversations/list/ConversationRow';
import { folderRow } from '@/v2/features/folders/folder-row-model';
import { FolderRow } from '@/v2/features/folders/list/FolderRow';
import { useV2Session } from '@/v2/runtime/session-context';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { spaceChatByline, uniqueRowsById } from '../../model';
import { spacesQueries } from '../../queries';
import { SpaceFileRow } from './SpaceFileRow';
import {
  SpaceContentEmptyState,
  SpaceContentErrorState,
  SpaceContentMoreErrorState,
  SpaceContentNextPageSkeleton,
  SpaceContentSkeleton,
  type SpaceContentTab,
} from './states';

/**
 * SpaceContentPanel — the body of a space's Chats, Folders or Files tab
 * (Spaces F2, 11 October 2026). Read-only lists of what members have put in
 * the space, for every member, Viewer included. Adding, moving and removing
 * arrive in F3 and F4.
 *
 * ── EACH TAB IS ITS OWN QUERY, MOUNTED ONLY WHILE IT IS SHOWING ────────────
 * A reader who never opens Files never pays for it, and each list keeps its
 * own 30-minute cache entry (`spacesQueries`), so going back to a tab already
 * seen paints its rows at once and refreshes behind them.
 *
 * ── THE ROWS ARE THE SOURCE LISTS' OWN ─────────────────────────────────────
 * A chat in a space is the same object as a chat in `/conversations`, and a
 * folder the same as one in `/folders`, so they wear the same rows (with no
 * actions menu, and a chat says whose it is). Files get `SpaceFileRow`, the
 * channel library's row anatomy without the channel (see that file for why).
 *
 * ── THE PANE IS THE SCROLLER ───────────────────────────────────────────────
 * Inside a space the collab frame's pane scrolls, not the shell (`CollabFrame`
 * marks it `data-v2-scroller`). The next-page sentinel is measured against
 * that pane, found from this panel's own element, so the 320px early-load band
 * holds; against the viewport it would be clipped away by the pane and the
 * next page would load only at the exact bottom (`useShellScrollRoot`'s
 * finding, for the same reason one container in).
 */
export function SpaceContentPanel({
  tab,
  spaceUuid,
}: {
  tab: SpaceContentTab;
  spaceUuid: string;
}) {
  switch (tab) {
    case 'chats':
      return <SpaceChatsList spaceUuid={spaceUuid} />;
    case 'folders':
      return <SpaceFoldersList spaceUuid={spaceUuid} />;
    case 'files':
      return <SpaceFilesList spaceUuid={spaceUuid} />;
  }
}

/** Stable empty rows, so a pending list does not mint a new array per render. */
const NO_CHATS: readonly SpaceConversation[] = [];
const NO_FOLDERS: readonly SpaceFolder[] = [];
const NO_FILES: readonly SpaceFile[] = [];

/** Module-level (so referentially stable) row identities: the React keys. */
const chatId = (row: SpaceConversation): string => row.id;
const folderUuid = (row: SpaceFolder): string => row.uuid;
const fileId = (row: SpaceFile): number => row.id;

/**
 * The gate every content read shares: the collab door (signed in, verified
 * where the backend requires it). The space itself has already loaded when a
 * tab mounts (`SpaceScreen` renders tabs only then), so a non-member, whom the
 * server refuses the space, never reaches a content request.
 */
function useContentReadGate() {
  const session = useV2Session();
  return {
    viewerId: session.userId,
    enabled: collabAccessState(session) === 'eligible',
  };
}

function SpaceChatsList({ spaceUuid }: { spaceUuid: string }) {
  const { viewerId, enabled } = useContentReadGate();
  const query = useInfiniteQuery({
    ...spacesQueries.conversations(spaceUuid, { viewerId }),
    enabled,
  });
  const pages = query.data?.pages;
  // Each chat once across pages (`uniqueRowsById`: offset paging under other
  // members' writes can repeat a row).
  const rows = useMemo(
    () => (pages ? uniqueRowsById(pages, chatId) : NO_CHATS),
    [pages],
  );
  // Captured once, so no clock read runs in render (React Compiler purity).
  const [now] = useState(() => Date.now());
  // Rows fade in only on a first load; a list that mounts from cache shows
  // them in place (the conversations list's rule, 8 October 2026).
  const [reveal] = useState(() => query.isPending);

  return (
    <PagedContent tab="chats" query={query} count={rows.length}>
      <ul className="flex flex-col">
        {rows.map((conversation, index) => (
          <ConversationRow
            key={conversation.id}
            conversation={conversation}
            now={now}
            index={index}
            exiting={false}
            reveal={reveal}
            byline={spaceChatByline(conversation.author, viewerId)}
          />
        ))}
      </ul>
    </PagedContent>
  );
}

function SpaceFoldersList({ spaceUuid }: { spaceUuid: string }) {
  const { viewerId, enabled } = useContentReadGate();
  const query = useInfiniteQuery({
    ...spacesQueries.folders(spaceUuid, { viewerId }),
    enabled,
  });
  const pages = query.data?.pages;
  const records = useMemo(
    () => (pages ? uniqueRowsById(pages, folderUuid) : NO_FOLDERS),
    [pages],
  );
  // One row model per folder, the mapping the folders list itself runs.
  const rows = useMemo(() => records.map(folderRow), [records]);
  const [now] = useState(() => Date.now());

  return (
    <PagedContent tab="folders" query={query} count={rows.length}>
      <ul className="flex flex-col">
        {rows.map((row, index) => (
          <FolderRow key={row.uuid} row={row} index={index} now={now} />
        ))}
      </ul>
    </PagedContent>
  );
}

function SpaceFilesList({ spaceUuid }: { spaceUuid: string }) {
  const { viewerId, enabled } = useContentReadGate();
  const query = useInfiniteQuery({
    ...spacesQueries.files(spaceUuid, { viewerId }),
    enabled,
  });
  const pages = query.data?.pages;
  const rows = useMemo(
    () => (pages ? uniqueRowsById(pages, fileId) : NO_FILES),
    [pages],
  );

  return (
    <PagedContent tab="files" query={query} count={rows.length}>
      <ul className="flex flex-col">
        {rows.map((file, index) => (
          <SpaceFileRow key={file.id} file={file} index={index} />
        ))}
      </ul>
    </PagedContent>
  );
}

/** What the shared body reads off an infinite query: its states and pager. */
interface PagedQuery {
  isPending: boolean;
  isError: boolean;
  isFetchNextPageError: boolean;
  error: unknown;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
  refetch: () => unknown;
}

/**
 * The one body all three tabs share, so their four states cannot drift:
 * skeleton on a first load, the failure panel when nothing loaded, the empty
 * state, or the rows with the next-page sentinel under them.
 */
function PagedContent({
  tab,
  query,
  count,
  children,
}: {
  tab: SpaceContentTab;
  query: PagedQuery;
  /** How many rows are loaded: every state decision reads this. */
  count: number;
  children: React.ReactNode;
}) {
  // The pane this panel scrolls in, found from the panel's own element. Set in
  // an effect declared BEFORE the sentinel's, so it is in place when that
  // observer is first built (`useShellScrollRoot`'s ordering rule).
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const paneRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    // `data-v2-scroller` is the attribute `CollabFrame` puts on its pane for
    // `ScrollMemory`; it names the scroller of the route.
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

  // A refusal the server explained (403) is worth its own sentence; anything
  // else, a network drop or a 5xx, gets the designed one.
  const apiError = query.error ? extractApiError(query.error) : null;
  const message = apiError?.status === 403 ? apiError.message : undefined;

  return (
    <div ref={anchorRef}>
      {query.isPending ? (
        <SpaceContentSkeleton tab={tab} />
      ) : query.isError && count === 0 ? (
        <SpaceContentErrorState
          tab={tab}
          message={message}
          onRetry={() => void refetch()}
        />
      ) : count === 0 ? (
        <SpaceContentEmptyState tab={tab} />
      ) : (
        <>
          {children}
          <div ref={sentinelRef} className="pt-1">
            {query.isFetchingNextPage ? (
              <SpaceContentNextPageSkeleton tab={tab} />
            ) : null}
          </div>
          {query.isError ? (
            <SpaceContentMoreErrorState
              onRetry={() =>
                void (query.isFetchNextPageError ? fetchNextPage() : refetch())
              }
            />
          ) : null}
        </>
      )}
    </div>
  );
}
