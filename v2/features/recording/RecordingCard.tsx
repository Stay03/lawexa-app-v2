'use client';

import { useRef, useState } from 'react';
import { FileText, Loader2, Mic, Pause, Play } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatFileSize } from '@/lib/utils/format-bytes';
import type { RecordingMessageMeta } from '@/types/recording';
import { useOpenFileInNewTab } from '@/v2/features/channels/feed/use-file-url';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { clock } from './recording-model';
import { useHeldItemsSource } from '@/v2/features/conversations/conversation/held-items-source';

/**
 * A recording where it was posted (thread ac47b1df; the card in the design
 * Stay OK'd on 20 November 2026): the player, then the transcript as a Word
 * document with how many speakers. The audio's address is signed for ten
 * minutes, so it is read when the person presses play, not when the card shows.
 */
export function RecordingCard({ recording }: { recording: RecordingMessageMeta }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const openInTab = useOpenFileInNewTab();
  const duration = recording.duration_seconds ?? 0;
  const title = (recording.audio_file?.name ?? 'Recording').replace(/\.[a-z0-9]+$/i, '');

  // The owner's route, or the admin view's read of a recording its chat holds (held-items-source.ts).
  const held = useHeldItemsSource();
  const play = async () => {
    setProblem(null);
    const element = audio.current;
    if (!element) return;
    if (playing) {
      element.pause();
      return;
    }
    if (!element.src) {
      setLoading(true);
      try {
        const answer = await held.recording(recording.recording_uuid);
        const url = answer.data?.audio_url;
        if (!url) throw new Error('no address');
        element.src = url;
      } catch {
        setProblem('The recording could not be loaded. Try again.');
        setLoading(false);
        return;
      }
    }
    try {
      await element.play();
    } catch {
      setProblem('The recording could not be played. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const transcript = recording.transcript_file;
  const speakers = recording.speaker_count;

  return (
    <div className="w-[min(22rem,100%)] overflow-hidden rounded-2xl border border-border/80 bg-card text-left shadow-[0_4px_14px_-10px_rgba(0,0,0,0.35)]">
      <div className="flex items-center gap-3 px-3.5 pt-3.5 pb-3">
        <button
          type="button"
          aria-label={`${playing ? 'Pause' : 'Play'} ${title}`}
          onClick={() => void play()}
          disabled={loading || !recording.audio_file}
          className={cn('v2-interactive flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm disabled:opacity-60', FOCUS_RING)}
        >
          {loading ? (
            <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
          ) : playing ? (
            <Pause aria-hidden className="size-4 fill-current" />
          ) : (
            <Play aria-hidden className="size-4 translate-x-px fill-current" />
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
            <Mic aria-hidden className="size-3.5 shrink-0 text-primary" />
            <span className="truncate">{title}</span>
          </span>
          <input
            type="range"
            aria-label="Position"
            min={0}
            max={Math.max(1, duration)}
            step={1}
            value={Math.min(position, Math.max(1, duration))}
            onChange={(event) => {
              const next = Number(event.target.value);
              setPosition(next);
              if (audio.current?.src) audio.current.currentTime = next;
            }}
            className="h-1.5 w-full cursor-pointer accent-primary"
          />
          <span className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
            <span>{clock(position)}</span>
            <span>{clock(duration)}</span>
          </span>
        </div>
        <audio
          ref={audio}
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setPosition(0);
          }}
          onTimeUpdate={(event) => setPosition(Math.floor(event.currentTarget.currentTime))}
        />
      </div>
      {problem ? <p className="px-3.5 pb-2.5 text-xs text-destructive">{problem}</p> : null}
      {transcript ? (
        <button
          type="button"
          onClick={() => (openInTab.ready ? openInTab.save() : openInTab.open(transcript.id, { name: transcript.name }))}
          disabled={openInTab.opening}
          className={cn(
            'v2-interactive flex w-full items-center gap-2.5 border-t border-border/70 bg-muted/40 px-3.5 py-2.5 text-left transition-colors hover:bg-muted',
            FOCUS_RING,
          )}
        >
          <FileText aria-hidden className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium text-foreground">Transcript</span>
            <span className="block text-[11px] text-muted-foreground">
              {speakers ? `${speakers} ${speakers === 1 ? 'speaker' : 'speakers'} · ` : ''}Word document · {formatFileSize(transcript.size)}
            </span>
          </span>
          <span className="text-xs font-medium text-primary">
            {openInTab.opening ? 'Opening…' : openInTab.ready ? 'Save' : 'Open'}
          </span>
        </button>
      ) : null}
    </div>
  );
}
