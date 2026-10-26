'use client';

import { useState, type MouseEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Flag, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';

import { cn } from '@/lib/utils';
import { feedbackApi } from '@/lib/api/feedback';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getErrorMessage } from '@/v2/runtime/query';
import { useV2Session } from '@/v2/runtime/session-context';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { DetailsField, FeedbackFrame, IssueChecklist } from '@/v2/features/feedback/FeedbackButton';
import { canSendFeedback } from '@/v2/features/feedback/feedback-model';
import {
  QUIZ_FEEDBACK_REASONS,
  QUIZ_FEEDBACK_TEXT_MAX,
  quizFeedbackBody,
  quizFeedbackRefusal,
  type QuizFeedbackReason,
  type QuizFeedbackSnapshot,
  type QuizFeedbackTarget,
} from './question-feedback';

/**
 * QuestionFeedbackButton — a small flag on one quiz question, "Report a
 * problem with this question" (Arthur, 26 October 2026; thread 87b8e449).
 * It shows once the answer is shown and never while a clock runs: the callers
 * place it on the answer's reveal, on each review card, and on a chat quiz
 * card after it is answered.
 *
 * The form is the page feedback's own frame and parts (`FeedbackButton`): a
 * dialog on a wide screen, a sheet on a phone, the reasons to tick and the
 * reader's words. The report goes to `POST /feedback` with the question and
 * what the reader saw (`question-feedback.ts`); the team, and the quiz's
 * author when a member wrote it, read it.
 *
 * Signed-in accounts only (Arthur): a guest pass and a signed-out reader see
 * no flag. The tap stops at the button, so a screen that moves on when tapped
 * (the solo reveal's hold) does not move on; `onOpenChange` lets that screen
 * hold still while the form is open.
 */
export function QuestionFeedbackButton({
  target,
  snapshot,
  onOpenChange,
  className,
}: {
  target: QuizFeedbackTarget;
  snapshot: QuizFeedbackSnapshot;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const session = useV2Session();
  const [open, setOpen] = useState(false);
  if (!canSendFeedback(session)) return null;

  const change = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };
  const press = (event: MouseEvent) => {
    event.stopPropagation();
    change(true);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Report a problem with this question"
            onClick={press}
            onKeyDown={(event) => event.stopPropagation()}
            className={cn(
              'v2-interactive relative inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground after:absolute after:-inset-1.5',
              FOCUS_RING,
              className,
            )}
          >
            <Flag aria-hidden className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Report a problem</TooltipContent>
      </Tooltip>
      {open ? (
        <FeedbackFrame
          title="Report a problem with this question"
          description="Tell us what is wrong with it. The Lawexa team reads every report, and so does the quiz's author."
          onClose={() => change(false)}
        >
          <QuestionFeedbackForm target={target} snapshot={snapshot} onSent={() => change(false)} />
        </FeedbackFrame>
      ) : null}
    </>
  );
}

function QuestionFeedbackForm({
  target,
  snapshot,
  onSent,
}: {
  target: QuizFeedbackTarget;
  snapshot: QuizFeedbackSnapshot;
  onSent: () => void;
}) {
  const [reasons, setReasons] = useState<readonly QuizFeedbackReason[]>([]);
  const [details, setDetails] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () => feedbackApi.submitQuizQuestion(quizFeedbackBody(target, snapshot, reasons, details)),
    // The form is on screen and says what went wrong itself.
    meta: { silentError: true },
  });

  const toggle = (id: string, on: boolean) => {
    setProblem(null);
    const reason = id as QuizFeedbackReason;
    setReasons((current) => (on ? [...current, reason] : current.filter((value) => value !== reason)));
  };

  const submit = () => {
    if (send.isPending) return;
    const refusal = quizFeedbackRefusal(reasons, details);
    if (refusal) {
      setProblem(refusal);
      return;
    }
    setProblem(null);
    send.mutate(undefined, {
      onSuccess: () => {
        toast.success('Report sent', { description: 'Thank you. We will look at this question.' });
        onSent();
      },
      onError: (error) =>
        setProblem(
          isAxiosError(error) && !error.response
            ? "Couldn't reach Lawexa, so nothing was sent. Your report is still here: try again."
            : getErrorMessage(error),
        ),
    });
  };

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <p className="line-clamp-3 rounded-lg bg-secondary/60 px-3 py-2 text-sm text-foreground">{snapshot.questionText}</p>
      <IssueChecklist legend="What is wrong?" categories={QUIZ_FEEDBACK_REASONS} ticked={reasons} onToggle={toggle} />
      <DetailsField
        value={details}
        max={QUIZ_FEEDBACK_TEXT_MAX}
        placeholder="What should the answer be, or what is unclear?"
        onChange={(next) => {
          setProblem(null);
          setDetails(next);
        }}
      />
      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={send.isPending} className="w-full sm:w-auto sm:self-end">
          {send.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          Send report
        </Button>
        {problem ? (
          <p role="alert" className="text-sm text-destructive sm:text-right">
            {problem}
          </p>
        ) : null}
      </div>
    </form>
  );
}
