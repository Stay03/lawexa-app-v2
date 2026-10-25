'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { authApi } from '@/lib/api/auth';
import { cn } from '@/lib/utils';
import { isAccountRole } from '@/v2/runtime/account';
import { useScreenHeld } from '@/v2/runtime/screen-hold';
import { useV2Session } from '@/v2/runtime/session-context';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { LogoMark } from '@/v2/shell/Logo';
import {
  REDESIGN_INTRO_IMAGE,
  REDESIGN_INTRO_TEXT,
  REDESIGN_INTRO_TITLE,
  introSeenKey,
  introShouldOpen,
} from './model';

/**
 * RedesignIntro — "Lawexa, redesigned", once per account (the rules are in
 * `model.ts`). The card is the classic app's AmbassadorProgramPopup in the new
 * design's voice: a 1200 x 630 picture, the title, one line, and two buttons.
 * Greys, with gold only on the main button.
 *
 * The picture is a fixed band and the words scroll under it, as in the
 * classic card, so on a short screen (a phone on its side) the buttons are
 * never cut off.
 *
 * `Dialog` stays rendered while the pop-up could still show and only `open`
 * changes, so closing plays the card's exit instead of vanishing in one frame.
 */
export function RedesignIntro({ seenOnServer }: { seenOnServer: boolean }) {
  const { signedIn, userId, role } = useV2Session();
  const account = signedIn && isAccountRole(role);
  // Mounted, and a beat after the first paint (useSettled below).
  const settled = useSettled();
  const seenHere = useSeenHere(userId);
  const screenHeld = useScreenHeld();
  // Set as the card opens (an event, not an effect): from then on a chat
  // that starts writing under it does not take it down.
  const [showing, setShowing] = useState(false);

  if (!account || userId === null || seenOnServer) return null;

  const open = introShouldOpen({ account, userId, seenOnServer, seenHere, mounted: settled, screenHeld, showing });
  const close = () => {
    markSeenHere(userId);
    // The account's own mark, for every other device. A failed post leaves
    // this browser's mark, so the pop-up still does not come back here.
    void authApi.v2IntroSeen().catch(() => undefined);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          // Focus goes to the card itself, not its first button: the × would
          // open wearing a gold focus ring the reader never asked for. Tab
          // still reaches every button.
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
          setShowing(true);
        }}
        className="flex flex-col gap-0 overflow-hidden p-0 outline-none sm:max-w-md"
      >
        <div className="relative shrink-0">
          <IntroPicture />
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className={cn(
              'v2-interactive absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-sm transition-colors hover:bg-background',
              FOCUS_RING,
            )}
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
          <div className="flex flex-col gap-2">
            <DialogTitle className="text-xl leading-snug font-semibold text-balance">{REDESIGN_INTRO_TITLE}</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">{REDESIGN_INTRO_TEXT}</DialogDescription>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={close}>
              Don&apos;t show again
            </Button>
            <Button size="sm" onClick={close}>
              Take a look
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The chosen picture, or a neutral band of the same shape until Stay picks one. */
function IntroPicture() {
  if (REDESIGN_INTRO_IMAGE) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- one fixed 1200x630 picture in public/: next/image would add a wrapper and lazy loading to a card that is already on screen.
      <img
        src={REDESIGN_INTRO_IMAGE.src}
        alt={REDESIGN_INTRO_IMAGE.alt}
        width={1200}
        height={630}
        className="aspect-[1200/630] w-full object-cover"
      />
    );
  }
  return (
    <div aria-hidden className="flex aspect-[1200/630] w-full items-center justify-center bg-secondary">
      <LogoMark alt="" className="size-12 opacity-40 grayscale" />
    </div>
  );
}

/**
 * A short wait after the first paint before the card may open, so the page is
 * drawn first and a screen that is about to hold (a chat whose answer is
 * still being written picks it up again once its status read answers) has
 * done so.
 */
export const INTRO_SETTLE_MS = 1500;

function useSettled(): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), INTRO_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return settled;
}

// ── This browser's mark ──────────────────────────────────────────────────────

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab closing the pop-up closes it here too.
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** Closed in this page load, whether or not storage took the mark. */
const closedThisLoad = new Set<number>();

function readSeen(userId: number | null): boolean {
  if (userId === null) return true;
  if (closedThisLoad.has(userId)) return true;
  try {
    return window.localStorage.getItem(introSeenKey(userId)) !== null;
  } catch {
    // Storage refused (a private window): not seen, so the pop-up shows once
    // in this page load.
    return false;
  }
}

function markSeenHere(userId: number): void {
  closedThisLoad.add(userId);
  try {
    window.localStorage.setItem(introSeenKey(userId), new Date().toISOString());
  } catch {
    // Storage refused: `closedThisLoad` keeps it shut for this page load.
  }
  for (const listener of listeners) listener();
}

function useSeenHere(userId: number | null): boolean {
  // The server snapshot is "seen": nothing is drawn before the client knows.
  return useSyncExternalStore(subscribe, () => readSeen(userId), () => true);
}
