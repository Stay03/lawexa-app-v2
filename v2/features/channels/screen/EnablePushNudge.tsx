'use client';

import { Bell, BellOff, Loader2, Share, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { usePushEnablement, type PushNudgeMode } from '@/v2/runtime/push/use-push';

/**
 * EnablePushNudge — the earned moment to ask for notification permission
 * (study A3: v1's nudge bar is KEEP-the-model, REDESIGN; plan W5 item 1).
 *
 * WHY IT LIVES IN A CHANNEL AND NOWHERE ELSE. A permission prompt on page load
 * is the thing browsers punish and users refuse; a person who has just opened
 * a channel they belong to has a reason to want it. So this is the only place
 * v2 asks, it asks once, and the dismissal is permanent on this device.
 *
 * ONE GESTURE. The button requests permission AND registers the FCM device
 * token in the same click (`usePushEnablement().enable`) — there is no second
 * confirmation step and no settings detour.
 *
 * THREE THINGS IT CAN SAY, and the last one is why it is more than an "ask":
 *  - ENABLE  — permission is undecided. The bar asks.
 *  - INSTALL — iOS in a browser tab. Safari grants web push only to an
 *    installed PWA, so the honest move is to say how to install rather than
 *    fire a prompt the platform will refuse.
 *  - BLOCKED — permission was refused. The bar says so plainly and points at
 *    browser settings (audit M4). Rendering nothing here left a person with an
 *    app that silently never notifies and no way to learn why.
 *
 * MOTION IS SYMMETRIC AND THE BAR IS ALWAYS MOUNTED (the NewRowsPill
 * contract): it tweens between `grid-rows-[0fr]` and `[1fr]`, so both the
 * arrival and the dismissal play instead of the row snapping in and out of the
 * channel's layout. Hidden, it is `inert` + `aria-hidden`, so nothing
 * focusable or announceable sits invisibly above the tabs, and it occupies
 * exactly zero height. `motion-reduce` drops the tween.
 */

const COPY: Record<PushNudgeMode, { icon: LucideIcon; text: string }> = {
  enable: {
    icon: Bell,
    text: 'Get notified about mentions and replies, even when Lawexa is closed.',
  },
  install: {
    icon: Share,
    text: 'Add Lawexa to your Home Screen from the Share menu to get notified about mentions when the app is closed.',
  },
  blocked: {
    icon: BellOff,
    text: 'Notifications are blocked for this site — turn them on in your browser settings.',
  },
};

export function EnablePushNudge() {
  const { nudgeMode, isBusy, enable, dismiss } = usePushEnablement();

  // Hold a real mode through the EXIT tween so the copy never empties
  // mid-collapse (the NewRowsPill label rule). `enable` is the safe resting
  // value — it is only ever SHOWN while `nudgeMode` says so.
  const mode = nudgeMode ?? 'enable';
  const { icon: Icon, text } = COPY[mode];
  const visible = nudgeMode !== null;

  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      className={cn(
        'grid shrink-0',
        'transition-[grid-template-rows,opacity] duration-200 ease-out',
        'motion-reduce:transition-none',
        visible ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      )}
    >
      <div className="overflow-hidden">
        <div className="border-b bg-primary/5 px-4 py-2">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
            <Icon
              aria-hidden
              className={cn(
                'size-4 shrink-0',
                mode === 'blocked' ? 'text-muted-foreground' : 'text-primary',
              )}
            />

            <p className="min-w-0 flex-1 text-sm text-muted-foreground">{text}</p>

            {mode === 'enable' && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => void enable()}
                disabled={isBusy}
              >
                {isBusy && <Loader2 aria-hidden className="size-4 animate-spin" />}
                Enable
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label="Dismiss notification message"
              onClick={dismiss}
            >
              <X aria-hidden className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
