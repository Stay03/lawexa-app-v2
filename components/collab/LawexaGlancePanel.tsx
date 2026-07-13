'use client';

import { Sparkles, X } from 'lucide-react';

import { useChannelAiStream } from '@/lib/hooks/useChannelAiStream';

interface LawexaGlancePanelProps {
  executionId: string;
  summonerName: string;
  onClose: () => void;
}

/**
 * Live "watch Lawexa type" preview card (Phase 6). Best-effort only — the
 * authoritative reply always lands in the feed as a normal message, so this
 * shows the streaming tokens as plain pre-wrap text (partial markdown renders
 * badly mid-stream) and fails quietly.
 */
export function LawexaGlancePanel({
  executionId,
  summonerName,
  onClose,
}: LawexaGlancePanelProps) {
  const { text, phase } = useChannelAiStream(executionId);

  return (
    <div className="pointer-events-auto w-full max-w-xs rounded-2xl border bg-background/95 shadow-md backdrop-blur sm:max-w-md">
      <div className="flex items-center gap-1.5 border-b px-3 py-2 text-xs text-muted-foreground">
        <Sparkles className="size-3 shrink-0 animate-pulse text-primary" />
        <span className="min-w-0 flex-1 truncate">
          Watching Lawexa respond to{' '}
          <span className="font-medium text-foreground">{summonerName}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Stop watching"
          className="-mr-1 shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="px-3 py-2.5">
        {phase === 'error' ? (
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load the live stream.
          </p>
        ) : phase === 'thinking' && text.length === 0 ? (
          <p className="animate-pulse text-sm text-muted-foreground">
            Lawexa is thinking…
          </p>
        ) : (
          <div className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words text-sm">
            {text}
            {phase === 'streaming' && (
              <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-foreground/70 align-middle" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
