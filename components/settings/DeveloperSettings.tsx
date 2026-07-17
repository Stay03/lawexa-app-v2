'use client';

import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { V2_COOKIE_CLEAR, V2_COOKIE_SET, hasV2Cookie } from '@/v2/cookie';

export function DeveloperSettings() {
  // Lazy initializer reads the cookie once, on mount — never in an effect
  // (the repo's React Compiler lint forbids setState-in-effect). Guarded for
  // SSR, where `document` is undefined.
  const [previewEnabled] = useState(
    () => typeof document !== 'undefined' && hasV2Cookie(document.cookie)
  );

  function handleToggle(next: boolean) {
    document.cookie = next ? V2_COOKIE_SET : V2_COOKIE_CLEAR;
    // Hard navigation (not a router transition): a client push would keep stale
    // prefetched RSC payloads from the other variant. A full load re-runs the
    // proxy with the new cookie so the whole app switches cleanly.
    window.location.assign('/');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5" />
          Developer
        </CardTitle>
        <CardDescription>
          Preview builds and experimental flags. These only affect your own
          browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="v2-preview" className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              v2 interface preview
            </Label>
            <p className="text-sm text-muted-foreground">
              Opt in to the in-progress v2 experience. Toggling reloads the app;
              pages not yet migrated still use the current interface.
            </p>
          </div>
          <Switch
            id="v2-preview"
            checked={previewEnabled}
            onCheckedChange={handleToggle}
          />
        </div>
      </CardContent>
    </Card>
  );
}
