'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Check, Download, MoreHorizontal, Plus, Share, X } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';
import { usePwaInstall } from '@/lib/hooks/usePwaInstall';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { IosBrowser } from '@/lib/utils/pwa';

type Step = { icon: React.ComponentType<{ className?: string }>; text: React.ReactNode };

function getIosSteps(browser: IosBrowser): Step[] {
  // Safari and Chrome on iOS expose Share directly in the toolbar; Edge/Firefox/others
  // tuck "Add to Home Screen" inside the browser menu.
  if (browser === 'safari' || browser === 'chrome') {
    return [
      { icon: Share, text: <>Tap the <strong>Share</strong> button in the toolbar.</> },
      { icon: Plus, text: <>Choose <strong>Add to Home Screen</strong>.</> },
      { icon: Check, text: <>Tap <strong>Add</strong> to finish.</> },
    ];
  }
  return [
    { icon: MoreHorizontal, text: <>Open the browser <strong>menu</strong>.</> },
    { icon: Plus, text: <>Choose <strong>Add to Home Screen</strong> (you may need <strong>Share</strong> first).</> },
    { icon: Check, text: <>Tap <strong>Add</strong> to finish.</> },
  ];
}

/**
 * Dismissible install affordance, shown only to signed-up, onboarded users who are
 * not already running the installed app and have not recently dismissed it. On
 * Chromium it triggers the real one-tap install; on iOS it opens manual instructions.
 * Mounted in the authenticated (main) shell.
 */
export function InstallAppCard() {
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const onboardingComplete = useAuthStore((state) => state.onboardingComplete);
  const isGuest = useAuthStore((state) => state.isGuest);

  const {
    mounted,
    isStandalone,
    isInstalled,
    isDismissed,
    canPromptNative,
    isIosManual,
    iosBrowser,
    promptInstall,
    dismiss,
  } = usePwaInstall();

  const [iosOpen, setIosOpen] = useState(false);

  // Post-signup gate: real, onboarded users only — never guests or mid-onboarding.
  const eligibleUser = isAuthenticated && onboardingComplete && !isGuest;
  // Avoid clashing with the chat composer, which is pinned to the bottom on /c/ routes.
  const onChatRoute = pathname?.startsWith('/c/') ?? false;

  const canShow =
    mounted &&
    eligibleUser &&
    !onChatRoute &&
    !isStandalone &&
    !isInstalled &&
    !isDismissed &&
    (canPromptNative || isIosManual);

  if (!canShow) return null;

  const handleInstall = async () => {
    if (isIosManual) {
      setIosOpen(true);
      return;
    }
    await promptInstall();
  };

  return (
    <>
      <div
        role="dialog"
        aria-label="Install Lawexa"
        className="animate-in fade-in slide-in-from-bottom-4 fixed bottom-4 left-4 right-4 z-50 rounded-2xl bg-card p-4 text-card-foreground shadow-lg ring-1 ring-foreground/10 duration-300 sm:left-auto sm:right-4 sm:w-96"
      >
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Dismiss"
          className="absolute right-2 top-2"
          onClick={() => dismiss()}
        >
          <X />
        </Button>

        <div className="flex items-start gap-3 pr-6">
          {/* App icon (mark only) — the full logo includes the wordmark and looks cramped at this size. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/android-chrome-192x192.png" alt="" className="size-10 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <p className="font-medium">Install Lawexa</p>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Add Lawexa to your home screen for faster access and a full-screen experience.
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => dismiss()}>
            Not now
          </Button>
          <Button size="sm" onClick={handleInstall}>
            {isIosManual ? <Share /> : <Download />}
            {isIosManual ? 'How to install' : 'Install app'}
          </Button>
        </div>
      </div>

      {isIosManual && (
        <Sheet open={iosOpen} onOpenChange={setIosOpen}>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Add Lawexa to your Home Screen</SheetTitle>
              <SheetDescription>
                Lawexa installs straight from your browser — no App Store needed.
              </SheetDescription>
            </SheetHeader>
            <ol className="space-y-4 px-6 pb-8">
              {getIosSteps(iosBrowser).map((step, index) => {
                const StepIcon = step.icon;
                return (
                  <li key={index} className="flex items-center gap-3">
                    <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium">
                      {index + 1}
                    </span>
                    <StepIcon className="text-muted-foreground size-4 shrink-0" />
                    <span className="text-sm">{step.text}</span>
                  </li>
                );
              })}
            </ol>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
