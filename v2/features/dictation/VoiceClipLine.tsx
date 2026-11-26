'use client';

import { useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VoiceClip } from '@/types/dictation';
import { timerLabel } from './dictation-model';

/**
 * "Sent by voice · 0:19 · Play" under a dictated question (Arthur, 25
 * November 2026: the voice is kept with the message). The clip loads only
 * when Play is pressed; its url is signed and short-lived, so the transcript
 * read after the send brings a fresh one.
 */
export function VoiceClipLine({ clip, align }: { clip: VoiceClip; align: 'start' | 'end' }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  const toggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => setFailed(true));
    else audio.pause();
  };

  return (
    <p
      className={cn(
        'text-muted-foreground mt-1 flex items-center gap-1.5 text-xs',
        align === 'end' ? 'justify-end' : 'justify-start',
      )}
    >
      <span>Sent by voice</span>
      <span aria-hidden>·</span>
      <span className="tabular-nums">{timerLabel(clip.duration_ms)}</span>
      <span aria-hidden>·</span>
      {failed || !clip.url ? (
        <span>The voice can’t play here</span>
      ) : (
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pause the voice' : 'Play the voice'}
          className="v2-interactive text-foreground hover:text-primary focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm font-medium focus-visible:outline-none focus-visible:ring-2"
        >
          {playing ? <Pause aria-hidden className="size-3 fill-current" /> : <Play aria-hidden className="size-3 fill-current" />}
          {playing ? 'Pause' : 'Play'}
        </button>
      )}
      <audio
        ref={audioRef}
        src={clip.url ?? undefined}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setFailed(true)}
        hidden
      />
    </p>
  );
}
