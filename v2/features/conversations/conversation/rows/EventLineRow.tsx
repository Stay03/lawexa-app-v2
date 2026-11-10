'use client';

import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, PenLine, Trophy } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { BackgroundJobEvent, DraftEditEvent, EventMessage, QuizGameEvent } from '@/types/chat';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useV2Session } from '@/v2/runtime/session-context';
import { notesQueries } from '@/v2/features/notes/queries';
import { useLiveQuizRoom } from '@/v2/features/channels/quiz/live-quiz-room-context';
import { QuizGameCard } from '@/v2/features/channels/quiz/QuizGameCard';
import { useV2ChatContext } from '../chat-context';
import { useSidePanel } from '../side-panel/SidePanelContext';
import { clockTime } from '../day-label';
import { draftOrdinalForLine } from './event-line';
import { backgroundReturnLine } from '../background-jobs/model';

/** EventLineRow — a line in the chat beside the turns, drawn by its kind. */
export const EventLineRow = memo(function EventLineRow({ line }: { line: EventMessage }) {
  switch (line.eventType) {
    case 'background_job_result':
    case 'background_job_unanswered':
      return <BackgroundJobLine line={line} />;
    case 'quiz_game_live':
    case 'quiz_game_finished':
      return <QuizGameLineRow line={line} />;
    default:
      return <DraftEditLine line={line} />;
  }
});

/**
 * Background work the reader started has ended (Backend's shapes 063d9cc3):
 * "File reading finished. Lawexa is continuing." where Lawexa came back, its
 * answer following under it; Lawexa's own sentence where it could not ("…
 * Ask about it to continue."). A quiet centred note, never a bubble: the
 * server stores these as turns, but nobody typed them. The return's words
 * come from the jobs it names, never its content, which is written for
 * Lawexa.
 */
function BackgroundJobLine({ line }: { line: BackgroundJobEvent }) {
  const returned = line.eventType === 'background_job_result';
  const words = returned ? backgroundReturnLine(line.jobs) : line.content;
  return (
    // One run of text, the icon and the time inline with it: the give-up
    // sentence is long, and as flex items its words, dot and time wrapped
    // into separate columns (fixture pictures, 11 November 2026).
    <p role="note" className="px-4 text-center text-xs text-balance text-muted-foreground">
      <History aria-hidden className="mr-1.5 inline size-3.5 -translate-y-px align-middle" />
      {words} <span aria-hidden>·</span>{' '}
      <time dateTime={line.timestamp.toISOString()} className="whitespace-nowrap">
        {clockTime(line.timestamp)}
      </time>
    </p>
  );
}

/**
 * A live quiz put live or finished in the chat's Space (Backend's shapes
 * 7a007a8c): the quiz card the channels draw, with Join, Watch or See results
 * opening the game over the chat. A reader the screen gives no room to (not a
 * member of the Space) gets the sentence alone, as a quiet note: the game's
 * probe and the game are refused to them.
 */
function QuizGameLineRow({ line }: { line: QuizGameEvent }) {
  const quiz = useLiveQuizRoom();
  if (!quiz) {
    return (
      <p
        role="note"
        className="flex items-center justify-center gap-1.5 px-4 text-center text-xs text-muted-foreground"
      >
        <Trophy aria-hidden className="size-3.5 shrink-0" />
        <span className="min-w-0 break-words">{line.content}</span>
      </p>
    );
  }
  return (
    <div className="px-4">
      <QuizGameCard
        line={{
          finished: line.eventType === 'quiz_game_finished',
          gameUuid: line.gameUuid,
          content: line.content,
          createdAt: line.timestamp.toISOString(),
        }}
        room={quiz.room}
        viewerId={quiz.viewerId}
        onOpenGame={quiz.openGame}
      />
    </div>
  );
}

/**
 * A quiet centred line in the chat where a draft was edited:
 * "✎ Stay edited 'Lease agreement' · 5:49 PM", once per editing session (Stay,
 * 30 October 2026, 02:16Z, thread 1e44eb39; design 9b43f942). No bubble, no
 * avatar, no actions, no reply: it is a note about the chat, not a turn.
 *
 * The title opens that draft in the side panel, as its card does, found in
 * the chat's draft list by its note's id (event-line.ts); a draft the list
 * does not hold leaves the title as plain text. The list is read from the cache the draft
 * cards fill, so the line sends no request of its own.
 */
function DraftEditLine({ line }: { line: DraftEditEvent }) {
  const chat = useV2ChatContext();
  const panel = useSidePanel();
  const { userId: viewerId } = useV2Session();
  const drafts = useQuery({
    ...notesQueries.draftNotes({ conversationId: chat?.conversationId ?? '', viewerId }),
    enabled: false,
  });
  const ordinal = panel ? draftOrdinalForLine(drafts.data?.data.documents, line.noteId) : null;
  const at = clockTime(line.editedAt);
  const title = `'${line.draftTitle}'`;

  return (
    <p
      role="note"
      className="flex items-center justify-center gap-1.5 px-4 text-center text-xs text-muted-foreground"
    >
      <PenLine aria-hidden className="size-3.5 shrink-0" />
      <span className="min-w-0 break-words">
        {line.editorName} edited{' '}
        {panel && ordinal !== null ? (
          <button
            type="button"
            onClick={() => panel.open({ kind: 'draft', ordinal })}
            className={cn(
              'v2-interactive rounded-sm font-medium text-foreground/80 underline-offset-2 transition-colors hover:text-foreground hover:underline',
              FOCUS_RING,
            )}
          >
            {title}
          </button>
        ) : (
          <span className="font-medium">{title}</span>
        )}{' '}
        · <time dateTime={line.editedAt.toISOString()}>{at}</time>
      </span>
    </p>
  );
}
