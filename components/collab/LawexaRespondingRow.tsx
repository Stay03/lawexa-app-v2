'use client';

import { Eye, EyeOff, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';

interface LawexaRespondingRowProps {
  summonerName: string;
  watching: boolean;
  onToggleWatch: () => void;
}

/**
 * Inline "Lawexa is responding…" row rendered in the message feed, directly
 * under the message that summoned Lawexa. Deliberately quiet and left-indented
 * to line up with the message bubbles (mirroring {@link MessageGroup}'s avatar
 * gutter), with a small Watch/Hide toggle that drops down the live peek.
 */
export function LawexaRespondingRow({
  summonerName,
  watching,
  onToggleWatch,
}: LawexaRespondingRowProps) {
  const ToggleIcon = watching ? EyeOff : Eye;

  return (
    <div className="px-1">
      <div className="flex items-center gap-2 pl-11 text-xs text-muted-foreground">
        <Sparkles className="size-3 shrink-0 animate-pulse text-primary" />
        <span className="min-w-0 truncate">
          Lawexa is responding to{' '}
          <span className="font-medium text-foreground">{summonerName}</span>…
        </span>
        <button
          type="button"
          onClick={onToggleWatch}
          className={cn(
            'ml-auto inline-flex shrink-0 items-center gap-1 font-medium text-primary',
            'transition-opacity hover:opacity-80'
          )}
        >
          <ToggleIcon className="size-3" />
          {watching ? 'Hide' : 'Watch'}
        </button>
      </div>
    </div>
  );
}
