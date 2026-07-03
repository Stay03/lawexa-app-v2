'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useAmbassadorPopup } from '@/lib/hooks/useAmbassadorPopup';
import { useAmbassadorPopupStore } from '@/lib/stores/ambassadorPopupStore';
import { useMyAmbassadorApplication } from '@/lib/hooks/useAmbassadorApplication';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Tracks whether the persisted auth store has finished rehydrating. On a cold
 * load the session is restored from storage asynchronously; deciding student
 * eligibility before that finishes would flash the popup (or wrongly hide it).
 * `useSyncExternalStore` keeps this SSR-safe and React-Compiler clean, and never
 * touches `.persist` during the server prerender (server snapshot is `false`).
 */
function useAuthHydrated(): boolean {
  return useSyncExternalStore(
    (onStoreChange) =>
      useAuthStore.persist?.onFinishHydration(onStoreChange) ?? (() => {}),
    () => useAuthStore.persist?.hasHydrated() ?? false,
    () => false,
  );
}

/**
 * Info popup promoting the Lawexa Campus Ambassador Program. Shown to STUDENTS
 * only (profile.profession === 'student'), on the home page, once auth has
 * settled — and never to students who have already applied. Closing lightly
 * (X / Esc / overlay / "Remind me later") snoozes it for a few days; "Don't show
 * again" and "Apply now" dismiss it permanently. Mirrors the dismissal pattern
 * of components/pwa/InstallAppCard.tsx.
 */
export function AmbassadorProgramPopup() {
  const user = useAuthStore((s) => s.user);
  const isGuest = useAuthStore((s) => s.isGuest);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthHydrated();

  const { mounted, isDismissed, remindLater, dismissForever } = useAmbassadorPopup();
  const expireRemindIfPast = useAmbassadorPopupStore((s) => s.expireRemindIfPast);

  // Clear an elapsed "remind me later" cooldown once on mount so a snooze that has
  // run its course lets the popup reappear — the clock read lives here, not render.
  useEffect(() => {
    expireRemindIfPast();
  }, [expireRemindIfPast]);

  const isStudent = user?.profile?.profession === 'student';
  const eligible =
    mounted && hydrated && isAuthenticated && !isGuest && isStudent && !isDismissed;

  // Only ask the backend once the user is an eligible, undismissed student.
  const { data: application, isPending: appPending } = useMyAmbassadorApplication(eligible);
  const hasApplied = application?.data != null;

  // Wait for the application check before showing so an existing applicant never
  // sees a flash-then-hide.
  const open = eligible && !appPending && !hasApplied;

  // Any lightweight close (X / Esc / overlay) snoozes rather than dismisses forever
  // — only the explicit actions below are permanent.
  const handleOpenChange = (next: boolean) => {
    if (!next) remindLater();
  };

  if (!open) return null;

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        {/* Hero */}
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ambassadors/og-image.png"
            alt="Lawexa campus ambassadors"
            className="w-full object-cover"
          />
          <button
            type="button"
            onClick={() => remindLater()}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-2">
            <DialogTitle className="text-xl font-semibold leading-snug">
              Become a Lawexa campus ambassador
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Lead the future of legal education on your campus. Represent Africa&apos;s leading
              legal learning platform at your university — and build real experience in
              leadership, community and legal tech.
            </DialogDescription>
          </div>

          {/* Actions */}
          <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="h-auto justify-start p-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
              onClick={() => dismissForever()}
            >
              Don&apos;t show again
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" size="sm" onClick={() => remindLater()}>
                Remind me later
              </Button>
              <Button asChild size="sm">
                {/* Full navigation — /ambassadors is a static page served from public/. */}
                <a href="/ambassadors" onClick={() => dismissForever()}>
                  Apply now
                </a>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
