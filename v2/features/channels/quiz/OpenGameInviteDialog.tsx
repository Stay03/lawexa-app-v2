'use client';

import { Check, Share2 } from 'lucide-react';

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
import { getAppUrl } from '@/lib/constants/seo';
import type { QuizGameVisibility } from '@/types/channel-quiz';
import { COLLAB_DIALOG_SURFACE } from '@/v2/features/collab/kit/dialog-surface';
import { QuizTile } from '@/v2/features/quiz/solo/QuizTile';
import { RaisedButton } from '@/v2/features/quiz/solo/ui';
import { useShareAction } from '@/v2/features/sharing/use-share-action';
import { GameLinkQr } from './GameLinkQr';
import { openGameHref, spacedJoinCode, VISIBILITY_WORDS } from './open-game';
import '@/v2/features/quiz/solo/solo-quiz.css';

/**
 * OpenGameInviteDialog — an open game's link, code and QR, for its host (live
 * quiz without a Space, Backend e9c7ac18). The same dialog as a Space game's
 * (`GameInviteDialog`, Arthur's rule that a new screen matches the one it
 * sits beside): the quiz's tile and a bold heading, the link in a read-only
 * field, its QR under it, and Share as the gold raised button. What differs
 * is only what there is to hand out: the game's own page and its 6-character
 * code, both known from the game itself, so nothing is asked of the server.
 */
export function OpenGameInviteDialog({
  gameUuid,
  quizUuid,
  quizTitle,
  joinCode,
  visibility,
  onOpenChange,
}: {
  gameUuid: string;
  quizUuid: string | null;
  quizTitle: string;
  joinCode: string | null;
  visibility: QuizGameVisibility;
  onOpenChange: (open: boolean) => void;
}) {
  const url = `${getAppUrl().replace(/\/$/, '')}${openGameHref(gameUuid)}`;
  const share = useShareAction({
    exactUrl: url,
    title: quizTitle,
    text: joinCode
      ? `Join my live quiz “${quizTitle}” on Lawexa. Code: ${joinCode}`
      : `Join my live quiz “${quizTitle}” on Lawexa.`,
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className={cn('v2-solo sm:max-w-md', COLLAB_DIALOG_SURFACE)}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            {quizUuid ? <QuizTile uuid={quizUuid} title={quizTitle} size="sm" /> : null}
            <DialogTitle className="text-lg leading-tight font-bold tracking-tight">Invite people to this game</DialogTitle>
          </div>
          <DialogDescription>{VISIBILITY_WORDS[visibility].who}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          {joinCode ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Join code</span>
              <span className="font-comfortaa text-3xl font-bold tracking-[0.2em] text-foreground tabular-nums">
                {spacedJoinCode(joinCode)}
              </span>
            </div>
          ) : null}
          <Input
            readOnly
            value={url}
            aria-label="Game link"
            onFocus={(event) => event.currentTarget.select()}
            className="h-11 rounded-xl border-2 text-center"
          />
          <GameLinkQr url={url} />
        </div>

        <DialogFooter className="gap-3 pb-1">
          <RaisedButton type="button" tone="quiet" className={INVITE_BUTTON} onClick={() => onOpenChange(false)}>
            Close
          </RaisedButton>
          <RaisedButton type="button" className={INVITE_BUTTON} onClick={() => void share.share()}>
            {share.copied ? <Check aria-hidden className="size-4" /> : <Share2 aria-hidden className="size-4" />}
            <span aria-live="polite">{share.copied ? 'Link copied' : 'Share link'}</span>
          </RaisedButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The footer's pair, as in `GameInviteDialog`: the quiz front's raised buttons (48px). */
const INVITE_BUTTON = 'h-12 px-5 text-[15px]';
