'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { extractApiError } from '@/lib/utils/api-error';
import { useV2Session } from '@/v2/runtime/session-context';
import { notesQueries } from '../queries';
import { writeNoteEverywhere } from '../mutations';
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
 */
export function EditNoteScreen({ slug }: { slug: string }) {
  const { signedIn, userId: viewerId, role } = useV2Session();
  const queryClient = useQueryClient();
  const mayWrite = signedIn && role !== 'guest';

  const note = useQuery({
    ...notesQueries.detail({ slug, viewerId }),
    enabled: mayWrite,
  });
  const envelope = note.data;

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

  if (note.isPending) {
    return (
      <div className={NOTE_PAPER_COLUMN}>
        <NoteEditorSkeleton />
      </div>
    );
  }

  if (note.isError) {
    const { status } = extractApiError(note.error);
    // 403/404 are settled ANSWERS about this note, not failures of ours.
    const settled = status === 403 || status === 404;
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

  const record = note.data.data;

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
