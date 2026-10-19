'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import { useV2Session } from '@/v2/runtime/session-context';
import { notesQueries } from '../queries';
import { writeNoteEverywhere } from '../mutations';
import { NoteDocument } from '../reader/NoteDocument';
import { NoteEditorScreen } from './NoteEditorScreen';
import {
  NOTE_PAPER_COLUMN,
  NoteEditorErrorState,
  NoteEditorGuestState,
  NoteEditorNotFoundState,
  NoteEditorSignedOutState,
  NoteEditorSkeleton,
  NoteNotYoursState,
} from './states';

/**
 * EditNoteScreen — `/notes/{slug}/edit`.
 *
 * ── ENTER BY SLUG, WORK BY ID ───────────────────────────────────────────────
 * The URL is the note's public ADDRESS, so the entry fetch is by slug. From
 * there everything is by id: the saves are `PUT /notes/{id}`, and the fresh
 * envelope is written into `notesQueries.byId` as well as the slug entry, so the
 * editor's canonical cache is never the one a rename could invalidate. The
 * `byId` entry is SEEDED from this fetch rather than fetched again — the same
 * note under two keys is one request, not two.
 *
 * ── FIVE HONEST ANSWERS, NO CRASH ───────────────────────────────────────────
 * Signed out, guest, still loading, not available (deleted / someone else's
 * private note / never existed), or a genuine load failure with a real retry.
 * The sixth case — a note that loads but belongs to someone else — is the one
 * v1 never handled: it rendered the form, let the reader type, and only failed
 * at the save. Here the ownership check runs before the editor exists and the
 * answer offers the thing they can actually do, which is read it.
 *
 * ── THE EDITOR OPENS ONLY ON THE SERVER'S LATEST COPY ──────────────────────
 * The note is kept on the device (`persist: 'gated'`) and the editor reads its
 * subject once, at mount, so whatever the cache held at open became what the
 * reader typed on, and the first save wrote that older copy over newer text
 * saved elsewhere (Tester Claude, 19 October 2026, note 1968: line P saved on a
 * computer, then lost to a phone that opened its cached copy). So the read is
 * made again on every open, and the editor waits for it: until a copy fetched
 * during THIS open arrives it shows the skeleton. If that fetch fails with a
 * cached copy in hand, the copy is shown READ-ONLY with a line saying the
 * latest could not be loaded, never as an editor.
 *
 * The open read is `notesQueries.editorOpen`, which the device persister never
 * answers: on the reader's kept leaf a fresh load's fetch came back from
 * IndexedDB, and the editor opened on that (Tester Claude, 19 October 2026,
 * 20:51Z). The kept copy is read only for the read-only fallback.
 */
export function EditNoteScreen({ slug }: { slug: string }) {
  const { signedIn, userId: viewerId, role } = useV2Session();
  const queryClient = useQueryClient();
  const mayWrite = signedIn && role !== 'guest';

  const note = useQuery({
    ...notesQueries.editorOpen({ slug, viewerId }),
    enabled: mayWrite,
    // Every open asks the server, whatever the cache holds (see the header).
    refetchOnMount: 'always',
  });
  const openStatus = note.isError ? extractApiError(note.error).status : 0;
  // The copy kept on this device, for reading when the latest cannot load.
  // Asked for only then, so it never stands in for the server's answer.
  const kept = useQuery({
    ...notesQueries.detail({ slug, viewerId }),
    enabled: mayWrite && note.isError && openStatus !== 403 && openStatus !== 404,
  });
  // A copy fetched from the server during this open, and only that.
  const fresh = note.isFetchedAfterMount && note.isSuccess;
  const envelope = fresh ? note.data : undefined;

  // Seed the editor's canonical key from the fetch we already made. An effect
  // with a cache write and no state — the editor below reads its subject from
  // props, so nothing here can repaint it.
  useEffect(() => {
    if (!envelope) return;
    writeNoteEverywhere(queryClient, viewerId, envelope);
  }, [envelope, queryClient, viewerId]);

  if (!signedIn) {
    return (
      <div className={NOTE_PAPER_COLUMN}>
        <NoteEditorSignedOutState />
      </div>
    );
  }

  if (role === 'guest') {
    return (
      <div className={NOTE_PAPER_COLUMN}>
        <NoteEditorGuestState />
      </div>
    );
  }

  if (note.isError) {
    // 403/404 are settled ANSWERS about this note, not failures of ours.
    const settled = openStatus === 403 || openStatus === 404;
    // The latest could not be loaded, but this device has a copy: show it to
    // read, never to edit (see the header).
    if (!settled && kept.data) {
      return (
        <div className={NOTE_PAPER_COLUMN}>
          <p role="status" className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            Can&apos;t load the latest copy. This is the copy saved on this device, to
            read only.
            <Button type="button" size="sm" variant="outline" onClick={() => void note.refetch()}>
              Try again
            </Button>
          </p>
          <NoteDocument note={kept.data.data} editHref={null} />
        </div>
      );
    }
    return (
      <div className={NOTE_PAPER_COLUMN}>
        {settled ? (
          <NoteEditorNotFoundState />
        ) : (
          <NoteEditorErrorState onRetry={() => void note.refetch()} />
        )}
      </div>
    );
  }

  // Still waiting for this open's copy: a cached one is never edited.
  if (!envelope) {
    return (
      <div className={NOTE_PAPER_COLUMN}>
        <NoteEditorSkeleton />
      </div>
    );
  }

  const record = envelope.data;

  if (viewerId === null || record.user.id !== viewerId) {
    return (
      <div className={NOTE_PAPER_COLUMN}>
        <NoteNotYoursState slug={record.slug} />
      </div>
    );
  }

  // Keyed by id so the editor is one instance for one note. A later refetch of
  // the same note re-renders this component but must never rebuild the editor
  // under the reader — `NoteEditorScreen` reads `initialRecord` at mount only.
  return <NoteEditorScreen key={record.id} initialRecord={record} />;
}
