'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { extractApiError } from '@/lib/utils/api-error';
import { useV2Session } from '@/v2/runtime/session-context';
import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import {
  errorStatus,
  isVerificationBlocked,
  needsEmailVerification,
} from '../model';
import { useEndQuizSession, useSubmitQuizAnswer } from '../mutations';
import { quizQueries } from '../queries';
import { QuizErrorState } from '../ui/states';
import { VerifyEmailState } from '../ui/VerifyEmailState';
import { ProgressHeader } from './ProgressHeader';
import { QuestionCard } from './QuestionCard';
import {
  ColdStartState,
  PLAYER_COLUMN,
  PlayerSkeleton,
  SessionEndedState,
} from './states';

/**
 * PlayerScreen — `/quiz/[sessionUuid]`, the play loop.
 *
 * ── SELECTION IS KEYED TO THE SEQUENCE, SO IT CLEARS ITSELF ─────────────────
 * The chosen option is stored WITH the sequence it belongs to, and read back
 * only when the two still match. When the answer resolves and the next question
 * arrives on a new sequence, the selection is simply no longer current — no
 * reset effect, no cleanup, and no window in which the new question renders
 * with the previous question's answer ticked. (Ported from v1, which got this
 * exactly right.)
 *
 * ── NO CLIENT TIMER, ON PURPOSE ─────────────────────────────────────────────
 * Think-time is measured server-side and reported per question in the results.
 * A countdown here would be a second clock that disagrees with the recorded one,
 * and a visible one would turn a practice tool into a test.
 *
 * ── THE TWO LIFECYCLE ERRORS ARE NAVIGATIONS, NOT TOASTS ────────────────────
 *   409 on answer  the session ended underneath us (another tab, or the ~24h
 *                  auto-abandon) → the reader's answers still exist, so we take
 *                  them to the results rather than reporting a failure.
 *   403 anywhere   an unverified email — the one gate the backend enforces —
 *                  which renders as its own designed panel.
 * Everything else is a real failure and says so. The submit mutation opts out
 * of the global error toast (`meta.silentError`) precisely so these two can be
 * handled without double-reporting; that makes reporting the REST a duty of
 * this screen, not an option.
 *
 * ── ROUTE SHAPE ────────────────────────────────────────────────────────────
 * v1 played at `/quiz/play?s=<uuid>` and bounced to `/quiz` when the param was
 * missing — a query string doing a path's job, plus a redirect for a URL that
 * simply should not have existed. v2 plays at `/quiz/{uuid}`: the session is
 * part of the path, an absent one cannot be constructed, and a session's play
 * page and its results page are now parent and child.
 */
export function PlayerScreen({ sessionUuid }: { sessionUuid: string }) {
  const router = useRouter();
  const session = useV2Session();
  const { userId: viewerId } = session;

  const [selection, setSelection] = useState<{
    sequence: number;
    optionId: number;
  } | null>(null);
  const [endOpen, setEndOpen] = useState(false);

  useEffect(() => {
    setHeaderContext({ title: 'Practice session', confidential: false });
    return () => clearHeaderContext();
  }, []);

  // Never send a request the snapshot already knows will 403 — see the hub.
  const snapshotUnverified = needsEmailVerification(session);

  const sessionQuery = useQuery({
    ...quizQueries.session(sessionUuid, { viewerId }),
    enabled: !snapshotUnverified,
  });
  const submitAnswer = useSubmitQuizAnswer(sessionUuid);
  const endSession = useEndQuizSession(sessionUuid);

  const data = sessionQuery.data?.data;
  const quizSession = data?.session;
  const served = data?.question ?? null;

  const verificationBlocked =
    snapshotUnverified ||
    isVerificationBlocked(sessionQuery.error) ||
    isVerificationBlocked(submitAnswer.error);

  const handleSelect = (optionId: number) => {
    if (!served || submitAnswer.isPending) return;

    setSelection({ sequence: served.sequence, optionId });
    submitAnswer.mutate(
      { option_id: optionId },
      {
        onError: (error) => {
          setSelection(null);
          const status = errorStatus(error);

          // The session closed underneath us — their answers are safe, so send
          // them where the answers are.
          //
          // UNLESS WE ARE ALREADY GOING THERE. If the reader ended the session
          // while this answer was still on the wire, the 409 is not news: the
          // End they just confirmed caused it, and that handler is already
          // navigating to the same URL. Reporting it would be a spurious toast
          // over a second, duplicate navigation. (The End control is also
          // disabled while a submit is in flight, so this is the belt to that
          // brace — it still covers the ~24h auto-abandon and a second tab.)
          if (status === 409) {
            if (endSession.isPending || endSession.isSuccess) return;
            toast.message('This session has already ended', {
              description: 'Taking you to your answers.',
            });
            router.replace(`/quiz/${sessionUuid}/results`);
            return;
          }
          // 403 flips `verificationBlocked` above and the panel takes over.
          if (status === 403) return;
          // 422 = the option no longer belongs to the current question; the
          // question on screen is unchanged, so the reader can simply retry.
          toast.error("Couldn't record your answer", {
            description: extractApiError(error).message,
          });
        },
      },
    );
  };

  const handleEnd = () => {
    endSession.mutate(undefined, {
      onSuccess: () => {
        // The dialog deliberately outlives its request (see EndSessionDialog),
        // so closing it is the caller's job — here, on the success path only.
        setEndOpen(false);
        router.push(`/quiz/${sessionUuid}/results`);
      },
    });
  };

  if (verificationBlocked) {
    return (
      <div className={LIST_COLUMN}>
        <VerifyEmailState />
      </div>
    );
  }

  if (sessionQuery.isPending) {
    return (
      <div className={PLAYER_COLUMN}>
        <div className="pt-5 sm:pt-6">
          <PlayerSkeleton />
        </div>
      </div>
    );
  }

  if (sessionQuery.isError || !quizSession) {
    const notFound = errorStatus(sessionQuery.error) === 404;
    return (
      <div className={LIST_COLUMN}>
        <QuizErrorState
          title={
            notFound ? "We couldn't find this session" : "Couldn't load this session"
          }
          description={
            notFound
              ? 'The link may be wrong, or the session may belong to another account.'
              : 'Something went wrong fetching your question. Please try again.'
          }
          onRetry={() => void sessionQuery.refetch()}
        />
      </div>
    );
  }

  // Resumed a session that has already ended, or auto-abandoned after ~24h.
  if (quizSession.status !== 'active') {
    return (
      <div className={LIST_COLUMN}>
        <SessionEndedState sessionUuid={sessionUuid} />
      </div>
    );
  }

  // Active, but the bank had nothing to serve — cold start, not an error.
  if (!served) {
    return (
      <div className={LIST_COLUMN}>
        <ColdStartState />
      </div>
    );
  }

  const question = served.question;
  // Sequence-keyed: current only while it still belongs to THIS question.
  const selectedId =
    selection?.sequence === served.sequence ? selection.optionId : null;

  return (
    <div className={PLAYER_COLUMN}>
      <ProgressHeader
        sequence={served.sequence}
        difficulty={question.difficulty}
        difficultyLabel={question.difficulty_label}
        session={quizSession}
        endOpen={endOpen}
        onEndOpenChange={setEndOpen}
        onEnd={handleEnd}
        ending={endSession.isPending}
        // Ending while an answer is on the wire races two writes against one
        // session: the answer 409s because the session just closed, and the
        // reader gets a failure toast for an answer they did submit in time.
        // The submit is one round trip — blocking End for its duration costs
        // nothing and removes the race at the source.
        endDisabled={submitAnswer.isPending}
        // Announce the score only after an answer has actually been recorded
        // IN THIS MOUNT. Resuming a session with prior answers would otherwise
        // greet a screen-reader user with "Answer recorded" for an answer they
        // gave yesterday.
        announceScore={submitAnswer.isSuccess}
      />
      <div className="pt-6">
        <QuestionCard
          question={question}
          sequence={served.sequence}
          selectedId={selectedId}
          pending={submitAnswer.isPending}
          onSelect={handleSelect}
        />
      </div>
    </div>
  );
}
