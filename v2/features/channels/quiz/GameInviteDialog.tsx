'use client';

import { useEffect } from 'react';
import { Check, Loader2, Share2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { extractApiError } from '@/lib/utils/api-error';
import { COLLAB_DIALOG_SURFACE } from '@/v2/features/collab/kit/dialog-surface';
import { QuizTile } from '@/v2/features/quiz/solo/QuizTile';
import { RaisedButton } from '@/v2/features/quiz/solo/ui';
import { useShareAction } from '@/v2/features/sharing/use-share-action';
import { GameLinkQr } from './GameLinkQr';
import { GAME_LINK_EXPIRED, gameLinkNote, gameLinkRefusal } from './model';
import { useGameInviteLink } from './mutations';
import { COMPACT_RAISED } from './ui';
import '@/v2/features/quiz/solo/solo-quiz.css';

/** The refusal's `errors.code` (`game_ended`, `link_revoked`), when it carries one. */
function errorCode(errors: unknown): string | null {
  const code = (errors as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

/**
 * GameInviteDialog — the game's link into its Space, for the host and
 * whoever else may host there (Arthur's decisions c and d, 93142269; Backend's
 * shapes 7a007a8c). Whoever opens it joins the Space as a Contributor, with no
 * approval, and lands in the game.
 *
 * The link is asked for as the dialog opens: the server makes it the first
 * time and returns the same one after, so asking again costs nothing and
 * never shows a link that has since lapsed. The address is shown whole, so it
 * can be read out or typed; Share hands it to the phone's sheet or copies it,
 * exactly as the server gave it. Its QR code sits under it (`GameLinkQr`).
 *
 * In the quiz's own look (Stay and Arthur, 11 November 2026): the quiz's
 * letter tile beside a bold heading, and Share as the solo quiz's gold raised
 * button. `v2-solo` sits on the content, which portals out of the game.
 *
 * Hosts mount this only while it is open, so every open asks again.
 */
export function GameInviteDialog({
  gameUuid,
  quizUuid,
  quizTitle,
  onOpenChange,
}: {
  gameUuid: string;
  /** The quiz's uuid, for its tile; null while the game has not been read. */
  quizUuid: string | null;
  quizTitle: string;
  onOpenChange: (open: boolean) => void;
}) {
  const link = useGameInviteLink(gameUuid);
  const { mutate } = link;
  useEffect(() => {
    mutate();
  }, [mutate]);

  const answered = link.data?.data ?? null;
  // A link past its 24 hours comes back with `is_usable` false: say so, and
  // neither show nor share an address that no longer lets anyone in.
  const expired = answered !== null && !answered.is_usable;
  const made = expired ? null : answered;
  const share = useShareAction({
    exactUrl: made?.url,
    title: quizTitle,
    text: `Join my live quiz “${quizTitle}” on Lawexa.`,
  });
  const failure = link.isError ? extractApiError(link.error) : null;
  const refusal = failure ? gameLinkRefusal(failure.status, errorCode(failure.errors)) : null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className={cn('v2-solo sm:max-w-md', COLLAB_DIALOG_SURFACE)}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            {quizUuid ? <QuizTile uuid={quizUuid} title={quizTitle} size="sm" /> : null}
            <DialogTitle className="text-lg leading-tight font-bold tracking-tight">Invite people to this game</DialogTitle>
          </div>
          <DialogDescription>
            {made ? gameLinkNote(made) : 'Anyone with the link joins the Space and goes straight into the game.'}
          </DialogDescription>
        </DialogHeader>

        {made ? (
          <div className="flex flex-col items-center gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
            <Input
              readOnly
              value={made.url}
              aria-label="Game link"
              onFocus={(event) => event.currentTarget.select()}
              className="h-11 rounded-xl border-2 text-center"
            />
            <GameLinkQr url={made.url} />
          </div>
        ) : expired ? (
          <p role="alert" className="text-sm text-muted-foreground">
            {GAME_LINK_EXPIRED}
          </p>
        ) : refusal ? (
          <div role="alert" className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">{refusal.message}</p>
            {refusal.retry ? (
              <RaisedButton type="button" tone="quiet" className={COMPACT_RAISED} onClick={() => mutate()}>
                Try again
              </RaisedButton>
            ) : null}
          </div>
        ) : (
          <Skeleton aria-hidden className="h-11 w-full rounded-xl" />
        )}

        <DialogFooter className="gap-3 pb-1">
          <RaisedButton type="button" tone="quiet" className={INVITE_BUTTON} onClick={() => onOpenChange(false)}>
            Close
          </RaisedButton>
          <RaisedButton type="button" className={INVITE_BUTTON} disabled={!made} onClick={() => void share.share()}>
            {link.isPending ? (
              <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
            ) : share.copied ? (
              <Check aria-hidden className="size-4" />
            ) : (
              <Share2 aria-hidden className="size-4" />
            )}
            <span aria-live="polite">{share.copied ? 'Link copied' : 'Share link'}</span>
          </RaisedButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The footer's pair: the quiz front's raised buttons (`FRONT_BUTTON`'s 48px). */
const INVITE_BUTTON = 'h-12 px-5 text-[15px]';
