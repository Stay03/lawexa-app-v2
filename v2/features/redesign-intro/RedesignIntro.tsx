'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { authApi } from '@/lib/api/auth';
import { cn } from '@/lib/utils';
import { isAccountRole } from '@/v2/runtime/account';
import { useScreenHeld } from '@/v2/runtime/screen-hold';
import { useIntroImages } from './intro-images';
import { slideAt, slideOffset } from './carousel';
import { useV2Session } from '@/v2/runtime/session-context';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { LogoMark } from '@/v2/shell/Logo';
import {
  REDESIGN_INTRO_IMAGES,
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
  // The pictures load first, and only for a reader the pop-up is for.
  const images = useIntroImages(REDESIGN_INTRO_IMAGES, account && !seenOnServer && !seenHere);

  if (!account || userId === null || seenOnServer) return null;

  const open = introShouldOpen({ account, userId, seenOnServer, seenHere, mounted: settled, screenHeld, showing, images });
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
        className="flex flex-col gap-0 overflow-hidden p-0 outline-none sm:max-w-xl"
      >
        <div className="relative shrink-0">
          <IntroPictures />
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

          {/* One button (Stay, 26 October 2026): it closes the pop-up and marks it seen. */}
          <Button className="w-full sm:w-auto sm:self-end" onClick={close}>
            Take a look
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The pictures (already loaded, intro-images.ts), sliding one after another:
 * a swipe or a scroll moves between them, each stops in place, and the dots
 * under them say which one shows and jump to one (Stay picked A, 26 October
 * 2026). Arrow keys move too once the strip has focus. Greys only: the dots
 * are not gold. One picture: no dots. None: a neutral band of the same shape.
 */
function IntroPictures() {
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const count = REDESIGN_INTRO_IMAGES.length;

  if (count === 0) {
    return (
      <div aria-hidden className="flex aspect-[1200/630] w-full items-center justify-center bg-secondary">
        <LogoMark alt="" className="size-12 opacity-40 grayscale" />
      </div>
    );
  }

  const go = (next: number) => {
    const track = trackRef.current;
    if (!track) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollTo({ left: slideOffset(next, track.clientWidth, count), behavior: reduced ? 'auto' : 'smooth' });
  };

  return (
    <div>
      <div
        ref={trackRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="What is new"
        tabIndex={count > 1 ? 0 : -1}
        onScroll={(event) => setIndex(slideAt(event.currentTarget.scrollLeft, event.currentTarget.clientWidth, count))}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') go(index + 1);
          if (event.key === 'ArrowLeft') go(index - 1);
        }}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {REDESIGN_INTRO_IMAGES.map((image, position) => (
          // eslint-disable-next-line @next/next/no-img-element -- fixed 1200x630 pictures in public/, loaded before the card opens: next/image would add a wrapper and lazy loading to a card that is already on screen.
          <img
            key={image.src}
            src={image.src}
            alt={image.alt}
            width={1200}
            height={630}
            aria-roledescription="slide"
            aria-label={`${position + 1} of ${count}`}
            className="aspect-[1200/630] w-full shrink-0 snap-center object-cover"
          />
        ))}
      </div>
      {count > 1 ? (
        <div className="flex justify-center gap-2 pt-3">
          {REDESIGN_INTRO_IMAGES.map((image, position) => (
            <button
              key={image.src}
              type="button"
              aria-label={`Picture ${position + 1} of ${count}`}
              aria-current={position === index ? 'true' : undefined}
              onClick={() => go(position)}
              className={cn(
                'v2-interactive size-2 rounded-full transition-colors',
                position === index ? 'bg-foreground/70' : 'bg-foreground/20 hover:bg-foreground/40',
                FOCUS_RING,
              )}
            />
          ))}
        </div>
      ) : null}
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
