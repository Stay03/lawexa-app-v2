'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { introSeenKey } from '@/v2/features/redesign-intro/model';
import { useScreenHeld } from '@/v2/runtime/screen-hold';
import { useV2Session } from '@/v2/runtime/session-context';
import {
  launchFor,
  wrappedLaunchShouldOpen,
} from './launch-model';
import { useHasWrapped, useHasWrapped2026 } from './queries';

/** A beat after the first paint before the card may open, as RedesignIntro waits. */
const SETTLE_MS = 1500;

/**
 * The one-time Lawexa Wrapped launch pop-up (the rules are in
 * `launch-model.ts`), on the home only. The card is RedesignIntro's: a fixed
 * 1200 x 630 picture band with the words scrolling under it, so on a short
 * screen the buttons are never cut off.
 */
export function WrappedLaunchPopup({ introSeenOnServer }: { introSeenOnServer: boolean }) {
  const pathname = usePathname();
  const { userId } = useV2Session();
  const launch = launchFor(useHasWrapped2026(), useHasWrapped());
  const hasWrapped = launch !== null;
  const seenKey = launch?.seenKey ?? null;
  const settled = useSettled();
  const seenHere = useSeen(userId, seenKey);
  const introSeenHere = useSeen(userId, introSeenKey);
  const screenHeld = useScreenHeld();
  const [showing, setShowing] = useState(false);
  const onHome = pathname === '/' || pathname === '/v2';
  const image = useImage(launch?.image.src ?? '', onHome && hasWrapped && !seenHere);

  if (!onHome || userId === null || !launch || seenHere) return null;

  const open = wrappedLaunchShouldOpen({
    hasWrapped,
    userId,
    seenHere,
    introSeen: introSeenOnServer || introSeenHere,
    settled,
    screenHeld,
    showing,
    image,
  });
  const close = () => markSeen(userId, launch.seenKey);

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          // Focus goes to the card, not its first button, as in RedesignIntro.
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
          setShowing(true);
        }}
        className="flex flex-col gap-0 overflow-hidden p-0 outline-none sm:max-w-xl"
      >
        {/* No close button on the picture (Arthur, 22 November 2026): Close is below, and Escape or a tap outside also closes it. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed 1200x630 picture in public/, loaded before the card opens. */}
        <img src={launch.image.src} alt={launch.image.alt} width={1200} height={630} className="aspect-[1200/630] w-full shrink-0 object-cover" />

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
          <div className="flex flex-col gap-2">
            <DialogTitle className="text-xl leading-snug font-semibold text-balance">{launch.title}</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">{launch.text}</DialogDescription>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={close}>
              Close
            </Button>
            <Button asChild>
              <Link href="/wrapped" onClick={close}>
                See your Wrapped <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function useSettled(): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return settled;
}

/** The picture, fetched and decoded before the card may open; never a broken card. */
function useImage(src: string, wanted: boolean): 'loading' | 'ready' | 'failed' {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    const element = new Image();
    const done = (next: 'ready' | 'failed') => {
      if (live) setStatus(next);
    };
    element.onload = () => {
      if (typeof element.decode === 'function') element.decode().then(() => done('ready'), () => done('ready'));
      else done('ready');
    };
    element.onerror = () => done('failed');
    element.src = src;
    return () => {
      live = false;
    };
  }, [src, wanted]);
  return status;
}

// ── This browser's marks ─────────────────────────────────────────────────────

const listeners = new Set<() => void>();
/** Closed in this page load, whether or not storage took the mark: the mark's own key. */
const closedThisLoad = new Set<string>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function readSeen(userId: number | null, key: ((id: number) => string) | null): boolean {
  if (userId === null || key === null) return true;
  if (closedThisLoad.has(key(userId))) return true;
  try {
    return window.localStorage.getItem(key(userId)) !== null;
  } catch {
    // Storage refused (a private window): not seen, so it shows once in this page load.
    return false;
  }
}

function markSeen(userId: number, key: (id: number) => string): void {
  closedThisLoad.add(key(userId));
  try {
    window.localStorage.setItem(key(userId), new Date().toISOString());
  } catch {
    // Storage refused: `closedThisLoad` keeps it shut for this page load.
  }
  for (const listener of listeners) listener();
}

function useSeen(userId: number | null, key: ((id: number) => string) | null): boolean {
  // The server snapshot is "seen": nothing is drawn before the client knows.
  return useSyncExternalStore(subscribe, () => readSeen(userId, key), () => true);
}
