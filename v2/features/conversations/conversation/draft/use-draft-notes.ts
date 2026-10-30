'use client';

import { useEffect, useState } from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import type { DraftNotesEnvelope } from '@/v2/features/notes/types';

import { useV2Session } from '@/v2/runtime/session-context';
import { notesQueries } from '@/v2/features/notes/queries';
import {
  CATCH_UP_LIMIT_MS,
  catchUpClockStart,
  catchUpPoll,
  draftNoteState,
  draftNotesRead,
  type DraftNoteState,
  type DraftNotesRead,
  type DraftPlace,
} from './draft-note-state';

/**
 * The draft panel's state for one draft of a chat (its place and group), from
 * the chat's drafts-as-notes list (draft-note-state.ts), and the list's own
 * refresh. A version the chat holds and the list does not yet counts as the
 * note catching up, so the list is read again as soon as an answer writes one.
 *
 * While the note catches up with Lawexa's newest version, the list is read
 * again every 2 s, for up to 30 s (`catchUpPoll`). Both wait for the answer
 * to end (`answerDone`): the server lists a draft only once the answer that
 * holds it is saved, and saves it before the stream ends, so a read while
 * Lawexa is still writing finds nothing new (Arthur's report, 30 October
 * 2026). The clock starts at the first read after the answer ended
 * (`catchUpClockStart`), and `retry` starts it again. The server brings the
 * note up to date on the read itself, so that read usually ends the wait.
 */
export function useDraftNoteState(conversationId: string, place: DraftPlace, answerDone: boolean) {
  const { userId: viewerId } = useV2Session();
  // When this panel first saw the note behind, or `null`. Set during render
  // (the house's "adjust state during render" pattern), never in an effect.
  const [waitingSince, setWaitingSince] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // The answer as this panel last saw it, and the newest read's time when it saw it end.
  const [seenDone, setSeenDone] = useState(answerDone);
  const [lastReadWhileWriting, setLastReadWhileWriting] = useState<number | null>(null);

  const query = useQuery({
    ...notesQueries.draftNotes({ conversationId, viewerId }),
    refetchInterval: (current) => {
      const data = current.state.data?.data;
      if (!data) return false;
      const state = draftNoteState({ status: 'success', notes: data.notes, documents: data.documents }, place);
      return catchUpPoll(state, waitingSince === null ? 0 : Date.now() - waitingSince, answerDone);
    },
  });

  const read: DraftNotesRead = draftNotesRead(query);
  const state: DraftNoteState = draftNoteState(read, place);

  // The answer ended while this panel was open: reads made before then don't start the wait.
  const answerChanged = answerDone !== seenDone;
  if (answerChanged) {
    setSeenDone(answerDone);
    setLastReadWhileWriting(answerDone ? query.dataUpdatedAt : null);
    setWaitingSince(null);
  }
  // The wait is timed from the first read after the answer ended, not from a clock read here.
  const clockStart = !answerChanged && state.kind === 'catching-up' ? catchUpClockStart(query.dataUpdatedAt, answerDone, lastReadWhileWriting) : null;
  if (clockStart !== null && waitingSince === null) setWaitingSince(clockStart);
  if (state.kind !== 'catching-up' && waitingSince !== null) setWaitingSince(null);
  const waitedMs = state.kind === 'catching-up' && waitingSince !== null ? Math.max(0, now - waitingSince) : 0;

  // The clock the "hasn't caught up yet" line reads, ticking only while it waits.
  const waiting = state.kind === 'catching-up' && waitedMs < CATCH_UP_LIMIT_MS;
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [waiting]);

  const retry = () => {
    const at = Date.now();
    setNow(at);
    setWaitingSince(at);
    void query.refetch();
  };

  return { state, waitedMs, retry, refetching: query.isFetching };
}

/**
 * Whether the reader has edited the newest version of a draft's group, for
 * its card ("Edited"): `edited` from the same list, one request per chat
 * however many cards ask. Only a finished draft asks; a confidential chat's
 * list is empty, so it never says so.
 */
export function useDraftEdited(conversationId: string | undefined, key: string, enabled: boolean): boolean {
  const { userId: viewerId } = useV2Session();
  const query = useQuery({
    ...notesQueries.draftNotes({ conversationId: conversationId ?? '', viewerId }),
    enabled: enabled && Boolean(conversationId),
  });
  // A disabled query still reads the chat's cached list: an older version's card never says Edited.
  if (!enabled) return false;
  return query.data?.data.documents.find((document) => document.key === key)?.edited === true;
}

/** A save of the reader's edits landed: the document reads as edited in the cached list. */
export function markDraftEdited(
  queryClient: QueryClient,
  { conversationId, viewerId }: { conversationId: string; viewerId: number | null },
  key: string,
  edited = true,
): void {
  queryClient.setQueryData<DraftNotesEnvelope>(notesQueries.draftNotes({ conversationId, viewerId }).queryKey, (current) =>
    current
      ? {
          ...current,
          data: {
            ...current.data,
            documents: current.data.documents.map((document) => (document.key === key ? { ...document, edited } : document)),
          },
        }
      : current,
  );
}
