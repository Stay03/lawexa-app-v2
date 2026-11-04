'use client';

import { useCallback, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, X } from 'lucide-react';

import { WRAPPED_COLOURS as C } from '@/lib/wrapped/theme';
import { useHasWrapped } from './queries';

/**
 * The home's Lawexa Wrapped banner (thread f833c285, live 8 November 2026):
 * shown to a student who has a Wrapped, until 31 December, and gone for good
 * on this device once closed. The menu's "Your Wrapped" stays for coming back.
 * Cream, ink and gold, as the campaign is, from lib/wrapped/theme.ts (the one
 * file Arthur's design system values replace).
 */
const DISMISSED_KEY = 'lawexa-wrapped-banner-closed';
const listeners = new Set<() => void>();

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function WrappedHomeBanner() {
  const hasWrapped = useHasWrapped();
  // Closed on the server's first paint is unknown: it shows after the device answers.
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => true);
  const close = useCallback(() => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Storage refused: it closes for this visit only.
    }
    listeners.forEach((listener) => listener());
  }, []);

  if (!hasWrapped || dismissed) return null;

  return (
    <div className="mx-auto mb-4 w-full max-w-2xl px-4 pt-3 md:px-0">
      <div
        className="relative flex items-center gap-3 rounded-2xl border-2 p-3 pr-11 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1"
        style={{ borderColor: C.ink, background: C.cream, color: C.ink, boxShadow: `4px 5px 0 ${C.ink}` }}
      >
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: C.gold }}>
          <Sparkles className="size-5" />
        </span>
        <Link href="/wrapped" className="min-w-0 flex-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-current">
          <span className="block text-sm font-bold">Your Bar Finals Wrapped is here</span>
          <span className="block text-xs" style={{ color: C.inkSoft }}>Eight cards of your year on Lawexa, and one to post.</span>
        </Link>
        <Link
          href="/wrapped"
          className="hidden shrink-0 items-center gap-1 rounded-full px-3 py-2 text-xs font-bold sm:inline-flex"
          style={{ background: C.ink, color: C.cream }}
          tabIndex={-1}
          aria-hidden
        >
          Open <ArrowRight className="size-3.5" />
        </Link>
        <button
          type="button"
          onClick={close}
          aria-label="Close the Wrapped banner"
          className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full hover:bg-black/5"
          style={{ color: C.inkSoft }}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
