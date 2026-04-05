'use client';

import { Bell, Volume2 } from 'lucide-react';
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

export default function NotificationsSettingsPage() {
  const {
    enableNotifications,
    enableSounds,
    setEnableNotifications,
    setEnableSounds,
    permission,
    requestPermission,
  } = useBrowserNotifications();

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
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Browser Notifications
            </Label>
            <p className="text-sm text-muted-foreground">
              Show desktop notifications when the tab is in the background.
            </p>
            <Badge
              variant={permission === 'granted' ? 'default' : 'secondary'}
              className="mt-1"
            >
              {permission === 'granted'
                ? 'Allowed'
                : permission === 'denied'
                  ? 'Blocked'
                  : 'Not set'}
            </Badge>
          </div>
          {permission === 'default' ? (
            <Button variant="outline" size="sm" onClick={requestPermission}>
              Enable
            </Button>
          ) : (
            <Switch
              checked={enableNotifications && permission === 'granted'}
              disabled={permission === 'denied'}
              onCheckedChange={setEnableNotifications}
            />
          )}
        </div>

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
          <Switch
            checked={enableSounds}
            onCheckedChange={setEnableSounds}
          />
        </div>
      </CardContent>
    </Card>
  );
}
