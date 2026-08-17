'use client';

import { useState } from 'react';
import { ArrowUpToLine, FlaskConical, TextCursorInput } from 'lucide-react';
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
import { readStreamStyle, setStreamStyle } from '@/v2/stream-style';
import { readSearchPosition, setSearchPosition } from '@/v2/search-position';
import { BarTuningControls } from './BarTuningControls';

export function DeveloperSettings() {
  // Lazy initializer reads the cookie once, on mount — never in an effect
  // (the repo's React Compiler lint forbids setState-in-effect). Guarded for
  // SSR, where `document` is undefined.
  const [previewEnabled] = useState(
    () => typeof document !== 'undefined' && hasV2Cookie(document.cookie)
  );

  // Same idiom for the streaming style: a lazy initializer reads the persisted
  // value once. This card is the only writer, so local state and the store cannot
  // drift; v2's transcript subscribes to the store and picks the change up live
  // (no reload — the engine re-resolves its smoothers in place).
  const [lineStream, setLineStream] = useState(() => readStreamStyle() === 'line');

  // And again for where a v2 list draws its search box. Bottom is the default,
  // so the SWITCH asks the opposite question — "put it back at the top?" — and
  // an untouched card reads "off", which is the honest picture of a default
  // nobody has changed.
  const [topSearch, setTopSearch] = useState(() => readSearchPosition() === 'top');

  function handleToggle(next: boolean) {
    document.cookie = next ? V2_COOKIE_SET : V2_COOKIE_CLEAR;
    // Hard navigation (not a router transition): a client push would keep stale
    // prefetched RSC payloads from the other variant. A full load re-runs the
    // proxy with the new cookie so the whole app switches cleanly.
    window.location.assign('/');
  }

  function handleStreamStyle(next: boolean) {
    setLineStream(next);
    setStreamStyle(next ? 'line' : 'flow');
  }

  function handleSearchPosition(next: boolean) {
    setTopSearch(next);
    setSearchPosition(next ? 'top' : 'bottom');
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

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="v2-line-stream" className="flex items-center gap-2">
              <TextCursorInput className="h-4 w-4" />
              Line-by-line answers
            </Label>
            <p className="text-sm text-muted-foreground">
              Releases a streamed answer one line at a time instead of the
              continuous word-by-word flow. Applies to the v2 chat only and takes
              effect immediately.
            </p>
          </div>
          <Switch
            id="v2-line-stream"
            checked={lineStream}
            onCheckedChange={handleStreamStyle}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="v2-top-search" className="flex items-center gap-2">
              <ArrowUpToLine className="h-4 w-4" />
              Search box at the top
            </Label>
            <p className="text-sm text-muted-foreground">
              By default the v2 list screens float their search box at the
              bottom, within thumb reach. Turn this on to put it back in the
              flow under the page title. Applies to the v2 lists only and takes
              effect immediately.
            </p>
          </div>
          <Switch
            id="v2-top-search"
            checked={topSearch}
            onCheckedChange={handleSearchPosition}
          />
        </div>
        {/* Its own block rather than a fourth switch row: this one is three
            controls that belong together, and it is expected to be deleted in
            one piece once the owner has chosen a treatment. */}
        <div className="border-t pt-6">
          <BarTuningControls />
        </div>
      </CardContent>
    </Card>
  );
}
