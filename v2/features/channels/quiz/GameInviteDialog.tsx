'use client';

import { useEffect } from 'react';
import { Check, Loader2, Share2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
import { useShareAction } from '@/v2/features/sharing/use-share-action';
import { GameLinkQr } from './GameLinkQr';
import { gameLinkNote, gameLinkRefusal } from './model';
import { useGameInviteLink } from './mutations';

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
 * Hosts mount this only while it is open, so every open asks again.
 */
export function GameInviteDialog({
  gameUuid,
  quizTitle,
  onOpenChange,
}: {
  gameUuid: string;
  quizTitle: string;
  onOpenChange: (open: boolean) => void;
}) {
  const link = useGameInviteLink(gameUuid);
  const { mutate } = link;
  useEffect(() => {
    mutate();
  }, [mutate]);

  const made = link.data?.data ?? null;
  const share = useShareAction({
    exactUrl: made?.url,
    title: quizTitle,
    text: `Join my live quiz “${quizTitle}” on Lawexa.`,
  });
  const refusal = link.isError ? gameLinkRefusal(extractApiError(link.error).status) : null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className={cn('sm:max-w-md', COLLAB_DIALOG_SURFACE)}>
        <DialogHeader>
          <DialogTitle>Invite people to this game</DialogTitle>
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
              className="text-center"
            />
            <GameLinkQr url={made.url} />
          </div>
        ) : refusal ? (
          <div role="alert" className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">{refusal.message}</p>
            {refusal.retry ? (
              <Button type="button" variant="outline" size="sm" onClick={() => mutate()}>
                Try again
              </Button>
            ) : null}
          </div>
        ) : (
          <Skeleton aria-hidden className="h-9 w-full rounded-4xl" />
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" disabled={!made} onClick={() => void share.share()}>
            {link.isPending ? (
              <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
            ) : share.copied ? (
              <Check aria-hidden className="size-4" />
            ) : (
              <Share2 aria-hidden className="size-4" />
            )}
            <span aria-live="polite">{share.copied ? 'Link copied' : 'Share link'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
