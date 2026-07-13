import { Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { LawexaTurn } from '@/lib/hooks/useChannelRealtime';

interface LawexaRespondingPillProps {
  turns: LawexaTurn[];
  /** When a single turn is active, offer a "Watch"/"Hide" glance affordance. */
  watchable?: boolean;
  watching?: boolean;
  onToggleWatch?: () => void;
}

/** Quiet, branded "Lawexa is responding…" pill shown while a summon is in
 *  flight. Presentational by default; when a single turn is watchable it grows
 *  a subtle trailing "Watch"/"Hide" button to open the live glance panel. */
export function LawexaRespondingPill({
  turns,
  watchable = false,
  watching = false,
  onToggleWatch,
}: LawexaRespondingPillProps) {
  if (turns.length === 0) return null;

  const single = turns.length === 1 ? turns[0] : null;
  const interactive = watchable && !!onToggleWatch;

  return (
    <div
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur',
        interactive && 'pointer-events-auto'
      )}
    >
      <Sparkles className="size-3 shrink-0 animate-pulse text-primary" />
      {single ? (
        <span className="min-w-0 truncate">
          Lawexa is responding to{' '}
          <span className="font-medium text-foreground">
            {single.summoner.name}
          </span>
          …
        </span>
      ) : (
        <span className="min-w-0 truncate">Lawexa is responding…</span>
      )}
      {interactive && (
        <button
          type="button"
          onClick={onToggleWatch}
          className="shrink-0 font-medium text-primary transition-opacity hover:opacity-80"
        >
          {watching ? 'Hide' : 'Watch'}
        </button>
      )}
    </div>
  );
}
