'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pause, Play, RefreshCw } from 'lucide-react';

interface ActivityFeedLiveToggleProps {
  live: boolean;
  onToggle: () => void;
  lastUpdated: number | null;
  isRefetching: boolean;
  onRefresh: () => void;
}

function formatAge(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 2) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

export function ActivityFeedLiveToggle({
  live,
  onToggle,
  lastUpdated,
  isRefetching,
  onRefresh,
}: ActivityFeedLiveToggleProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const age = lastUpdated ? now - lastUpdated : null;

  return (
    <div className="flex items-center gap-2 text-xs">
      <div
        className={`flex items-center gap-1.5 rounded-full px-2 py-1 ${
          live
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            live ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'
          }`}
        />
        {live ? 'Live' : 'Paused'}
      </div>
      {age !== null && (
        <span className="text-muted-foreground">Updated {formatAge(age)}</span>
      )}
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1"
        onClick={onRefresh}
        disabled={isRefetching}
      >
        <RefreshCw
          className={`h-3 w-3 ${isRefetching ? 'animate-spin' : ''}`}
        />
      </Button>
      <Button size="sm" variant="outline" className="h-7 gap-1" onClick={onToggle}>
        {live ? (
          <>
            <Pause className="h-3 w-3" /> Pause
          </>
        ) : (
          <>
            <Play className="h-3 w-3" /> Resume
          </>
        )}
      </Button>
    </div>
  );
}
