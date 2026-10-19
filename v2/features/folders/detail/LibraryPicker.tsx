'use client';

import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Landmark, Loader2, NotebookPen, Scale, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { browseRow } from '@/v2/features/cases/case-row-model';
import { casesQueries } from '@/v2/features/cases/queries';
import { noteRow } from '@/v2/features/notes/note-row-model';
import { notesQueries } from '@/v2/features/notes/queries';
import { statuteRow } from '@/v2/features/statutes/statute-row-model';
import { statutesQueries } from '@/v2/features/statutes/queries';
import { useServerSearch } from '@/v2/features/spaces/use-server-search';
import { useV2Session } from '@/v2/runtime/session-context';
import { SearchField } from '@/v2/shell/SearchField';
import { TabRow } from '@/v2/shell/TabRow';
import { AddChoiceRow } from './FolderAdd';

/**
 * LibraryPicker — cases, statutes and notes into a folder, from the folder
 * itself (Arthur, 17 October 2026, item 8: the "+" should offer "Lawexa
 * content"; the second push of items 7-9).
 *
 * Three tabs over the libraries v2 already reads, each searched by the server
 * (300ms after the last keystroke, `useServerSearch`): the cases list, the
 * statutes list, and the reader's own notes. Each row has its own Add
 * (`AddChoiceRow`, the same row "Files from this space" uses), which files it
 * with its numeric id; one the folder already holds reads as done.
 *
 * In a space folder a note goes in as the SPACE'S COPY (Stay, 18 October
 * 2026: "adding a note from my notes to space creates a copy of that note so
 * my original one remains as is"), and the My notes tab says so before the
 * tap.
 */

type LibraryTab = 'case' | 'statute' | 'note';

const TABS: readonly { id: LibraryTab; label: string }[] = [
  { id: 'case', label: 'Cases' },
  { id: 'statute', label: 'Statutes' },
  { id: 'note', label: 'My notes' },
];

const PLACEHOLDER: Readonly<Record<LibraryTab, string>> = {
  case: 'Search cases',
  statute: 'Search statutes',
  note: 'Search your notes',
};

const PANEL_ID = 'folder-library-panel';

/** The pill strip a space's list uses, so the two pickers read alike. */
const PILLS_CLASS =
  'inline-flex max-w-full shrink-0 items-center gap-0.5 self-start overflow-x-auto overscroll-x-contain rounded-full bg-secondary/60 p-0.5';
const pillClass = (selected: boolean): string =>
  cn(
    'v2-interactive min-h-8 shrink-0 rounded-full px-3.5 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none',
    selected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
  );

export function LibraryPicker({
  open,
  onOpenChange,
  folder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: { uuid: string; name: string; space: { uuid: string; name: string } | null };
}) {
  const [tab, setTab] = useState<LibraryTab>('case');
  const search = useServerSearch();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add from Library</DialogTitle>
          <DialogDescription>
            Cases, statutes and your notes, into {folder.name}. Search, then add.
          </DialogDescription>
        </DialogHeader>
        <TabRow
          tabs={TABS}
          value={tab}
          onChange={(next) => {
            setTab(next);
            search.clear();
          }}
          ariaLabel="What to add"
          panelId={PANEL_ID}
          className={PILLS_CLASS}
          tabClassName={pillClass}
        >
          {(item) => item.label}
        </TabRow>
        <SearchField
          value={search.value}
          onChange={search.setValue}
          onClear={search.clear}
          placeholder={PLACEHOLDER[tab]}
          label={PLACEHOLDER[tab]}
        />
        {tab === 'note' && folder.space ? (
          <p className="text-sm text-muted-foreground">Adds a copy to the space. Your note stays yours.</p>
        ) : null}
        <div
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={`${PANEL_ID}-tab-${tab}`}
          className="-mx-2 max-h-[min(55vh,26rem)] overflow-y-auto overscroll-contain"
        >
          {/* A new tab is a new list: a fresh mount, so no rows of the last
              kind show under this kind's name. */}
          {tab === 'case' ? (
            <CaseResults key="case" term={search.term} folderUuid={folder.uuid} />
          ) : tab === 'statute' ? (
            <StatuteResults key="statute" term={search.term} folderUuid={folder.uuid} />
          ) : (
            <NoteResults key="note" term={search.term} folderUuid={folder.uuid} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ResultRow {
  id: number;
  title: string;
  meta: string;
}

/** One kind's results: its states, its rows, and "More" while pages remain. */
function Results({
  query,
  rows,
  type,
  icon,
  folderUuid,
  empty,
}: {
  query: {
    isPending: boolean;
    isError: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => unknown;
    refetch: () => unknown;
  };
  rows: readonly ResultRow[];
  type: 'case' | 'statute' | 'note';
  icon: LucideIcon;
  folderUuid: string;
  empty: string;
}) {
  if (query.isPending) {
    return (
      <div aria-hidden className="flex flex-col gap-1 px-2">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="h-14 animate-pulse rounded-xl bg-secondary/60" />
        ))}
      </div>
    );
  }
  if (query.isError && rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-2 py-6 text-center text-sm text-muted-foreground">
        <p>Couldn&rsquo;t load these.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (rows.length === 0) {
    return <p className="px-2 py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <>
      <ul className="flex flex-col px-2">
        {rows.map((row) => (
          <AddChoiceRow
            key={row.id}
            target={{ type, contentId: row.id }}
            icon={icon}
            title={row.title}
            meta={row.meta}
            folderUuid={folderUuid}
          />
        ))}
      </ul>
      {query.hasNextPage ? (
        <div className="flex justify-center px-2 pt-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            More
          </Button>
        </div>
      ) : null}
    </>
  );
}

const joinMeta = (parts: readonly (string | number | null | undefined)[]): string =>
  parts.filter((part) => part !== null && part !== undefined && part !== '').join(' · ');

function CaseResults({ term, folderUuid }: { term: string; folderUuid: string }) {
  const { userId: viewerId } = useV2Session();
  const query = useInfiniteQuery(casesQueries.infiniteList({ viewerId, search: term || undefined }));
  const rows = (query.data?.pages ?? []).flatMap((page) =>
    page.data.map((item) => {
      const row = browseRow(item);
      return { id: row.id, title: row.title, meta: joinMeta([row.citation, row.court]) };
    }),
  );
  return (
    <Results
      query={query}
      rows={rows}
      type="case"
      icon={Scale}
      folderUuid={folderUuid}
      empty={term ? `No cases match “${term}”.` : 'No cases to show.'}
    />
  );
}

function StatuteResults({ term, folderUuid }: { term: string; folderUuid: string }) {
  const { userId: viewerId } = useV2Session();
  const query = useInfiniteQuery(statutesQueries.infiniteList({ viewerId, search: term || undefined }));
  const rows = (query.data?.pages ?? []).flatMap((page) =>
    page.data.map((item) => {
      const row = statuteRow(item);
      return { id: row.id, title: row.title, meta: joinMeta([row.shortTitle, row.year, row.countryName]) };
    }),
  );
  return (
    <Results
      query={query}
      rows={rows}
      type="statute"
      icon={Landmark}
      folderUuid={folderUuid}
      empty={term ? `No statutes match “${term}”.` : 'No statutes to show.'}
    />
  );
}

function NoteResults({ term, folderUuid }: { term: string; folderUuid: string }) {
  const { userId: viewerId } = useV2Session();
  const query = useInfiniteQuery(notesQueries.mine({ viewerId, search: term || undefined }));
  const rows = (query.data?.pages ?? []).flatMap((page) =>
    page.data.map((item) => {
      const row = noteRow(item);
      return { id: row.id, title: row.title, meta: row.isDraft ? 'Draft' : (row.preview ?? '') };
    }),
  );
  return (
    <Results
      query={query}
      rows={rows}
      type="note"
      icon={NotebookPen}
      folderUuid={folderUuid}
      empty={term ? `None of your notes match “${term}”.` : 'You have no notes yet.'}
    />
  );
}
