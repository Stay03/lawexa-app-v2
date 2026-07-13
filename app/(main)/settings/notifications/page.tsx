'use client';

import { Bell, Share, Volume2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBrowserNotifications } from '@/lib/hooks/useBrowserNotifications';
import { usePushNotifications } from '@/lib/hooks/usePushNotifications';

export default function NotificationsSettingsPage() {
  const { enableSounds, setEnableSounds } = useBrowserNotifications();
  const {
    permission,
    enableNotifications,
    isRegistered,
    supported,
    requiresInstall,
    iosBrowser,
    enable,
    setPushEnabled,
  } = usePushNotifications();

  const badgeLabel =
    permission === 'granted'
      ? isRegistered
        ? 'On for this device'
        : 'Allowed'
      : permission === 'denied'
        ? 'Blocked'
        : 'Not set';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Control how you receive alerts when Lawexa needs your attention.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </Label>
            <p className="text-sm text-muted-foreground">
              Get alerts for mentions, invites, and updates — on your desktop and
              even when Lawexa is fully closed.
            </p>
            {supported && (
              <Badge
                variant={permission === 'granted' ? 'default' : 'secondary'}
                className="mt-1"
              >
                {badgeLabel}
              </Badge>
            )}
          </div>

          <div className="shrink-0">
            {requiresInstall ? null : !supported ? (
              <span className="text-sm text-muted-foreground">Not supported</span>
            ) : permission === 'default' ? (
              <Button variant="outline" size="sm" onClick={() => void enable()}>
                Enable
              </Button>
            ) : (
              <Switch
                checked={enableNotifications && permission === 'granted'}
                disabled={permission === 'denied'}
                onCheckedChange={(value) => void setPushEnabled(value)}
              />
            )}
          </div>
        </div>

        {requiresInstall && (
          <div className="flex items-start gap-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            <Share className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              To get notifications on iPhone or iPad, add Lawexa to your Home
              Screen first
              {iosBrowser === 'safari' || iosBrowser === 'chrome'
                ? ' (tap Share, then “Add to Home Screen”)'
                : ' (open the browser menu, then “Add to Home Screen”)'}
              , then open it from there and enable notifications.
            </p>
          </div>
        )}

        {supported && permission === 'denied' && (
          <p className="text-sm text-muted-foreground">
            Notifications are blocked. Allow them for Lawexa in your browser’s site
            settings, then reload this page.
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Sound
            </Label>
            <p className="text-sm text-muted-foreground">
              Play a notification sound when alerts are triggered.
            </p>
          </div>
          <Switch checked={enableSounds} onCheckedChange={setEnableSounds} />
        </div>
      </CardContent>
    </Card>
  );
}
