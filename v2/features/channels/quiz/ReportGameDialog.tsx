'use client';

import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { feedbackApi } from '@/lib/api/feedback';
import { COLLAB_DIALOG_SURFACE } from '@/v2/features/collab/kit/dialog-surface';
import { RaisedButton } from '@/v2/features/quiz/solo/ui';
import '@/v2/features/quiz/solo/solo-quiz.css';

/** How long a report may be: the feedback list's own limit. */
export const REPORT_MAX = 2000;

/**
 * ReportGameDialog — a player's report of an open live quiz game (Stay,
 * thread 12341975: reports go through the feedback the app already has). The
 * report names the game and says what is wrong in the reader's own words; it
 * lands in the feedback list, where only an admin may end the game. The same
 * dialog surface and raised buttons as the game's other dialogs.
 */
export function ReportGameDialog({ gameUuid, onOpenChange }: { gameUuid: string; onOpenChange: (open: boolean) => void }) {
  const [text, setText] = useState('');
  const report = useMutation({
    mutationFn: (feedbackText: string) =>
      feedbackApi.submitQuizGameReport({ content_type: 'channel_quiz_game', content_uuid: gameUuid, feedback_text: feedbackText }),
    meta: { silentError: true },
  });
  const trimmed = text.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (trimmed === '' || report.isPending) return;
    report.mutate(trimmed);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className={cn('v2-solo sm:max-w-md', COLLAB_DIALOG_SURFACE)}>
        <DialogHeader>
          <DialogTitle className="text-lg leading-tight font-bold tracking-tight">
            {report.isSuccess ? 'Thanks for telling us' : 'Report this game'}
          </DialogTitle>
          <DialogDescription>
            {report.isSuccess
              ? 'An admin will look at it. If the game breaks the rules, they can end it.'
              : 'Say what’s wrong with this game. An admin reads every report.'}
          </DialogDescription>
        </DialogHeader>

        {report.isSuccess ? (
          <DialogFooter className="pb-1">
            <RaisedButton type="button" className={REPORT_BUTTON} onClick={() => onOpenChange(false)}>
              Done
            </RaisedButton>
          </DialogFooter>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={REPORT_MAX}
              rows={4}
              aria-label="What’s wrong with this game"
              placeholder="For example: the questions are offensive"
              className="resize-none rounded-xl border-2"
            />
            {report.isError ? (
              <p role="alert" className="text-sm text-destructive">
                Couldn&rsquo;t send the report. Try again.
              </p>
            ) : null}
            <DialogFooter className="gap-3 pb-1">
              <RaisedButton type="button" tone="quiet" className={REPORT_BUTTON} onClick={() => onOpenChange(false)}>
                Cancel
              </RaisedButton>
              <RaisedButton type="submit" className={REPORT_BUTTON} disabled={trimmed === '' || report.isPending}>
                {report.isPending ? <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" /> : null}
                Send report
              </RaisedButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The footer's pair, as in the game's invite dialogs (48px raised buttons). */
const REPORT_BUTTON = 'h-12 px-5 text-[15px]';
