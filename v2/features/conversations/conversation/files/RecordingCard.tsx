'use client';

import Link from 'next/link';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { ToolMessage } from '@/types/chat';
import { MediaPlayer } from '@/v2/features/files/MediaPlayer';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useToolResult } from '../tools/use-tool-result';
import { FileMark } from './FileMark';
import { chatRecording } from './chat-recording';

/**
 * RecordingCard — a call Lawexa recorded on its machine, after the step chain
 * (call recordings, Techlead's go, 13 November 2026), as the file list card
 * sits there. The recording's mark, name and length, and the player.
 *
 * THE PLAYER PLAYS BY THE FILE'S ID (`MediaPlayer`), which asks for a fresh
 * link when it mounts and again if one fails, so the card plays a day later.
 * The 60-minute link in the step's result is never used. Nothing plays until
 * Play is pressed. A recording that will not play here says where it is.
 *
 * A chat loaded with lazy results carries no result data until it is asked
 * for, so the card asks (`useToolResult`), as the file list card does.
 */
export function RecordingCard({ message }: { message: ToolMessage }) {
  const loaded = useToolResult(message, message.toolStatus === 'complete');
  const recording = chatRecording(loaded.message);

  if (loaded.status === 'loading') {
    return (
      <div aria-hidden className="my-2 space-y-3 rounded-2xl border border-border/60 p-3.5">
        <Skeleton className="h-9 w-2/3 rounded-xl" />
        <Skeleton className="h-12 w-full rounded-full" />
      </div>
    );
  }
  if (!recording) return null;

  return (
    <section
      aria-label={`Call recording: ${recording.name}`}
      className="my-2 overflow-hidden rounded-2xl border border-border bg-card p-3.5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
    >
      <div className="flex items-center gap-3">
        <FileMark kind="Audio" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm leading-snug font-semibold text-foreground">{recording.name}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground tabular-nums">
            {['Recording', recording.length, 'in your Files'].filter(Boolean).join(' · ')}
          </span>
        </span>
      </div>
      <MediaPlayer
        file={{ id: recording.fileId, original_name: recording.name }}
        kind="audio"
        failure={<RecordingFailure />}
        className="mt-3"
      />
    </section>
  );
}

/** Where the recording is, when it will not play here: the reader's Files. */
function RecordingFailure() {
  return (
    <p role="status" className="mt-3 text-[13px] text-muted-foreground">
      This recording didn&rsquo;t play here. It&rsquo;s saved in{' '}
      <Link href="/folders" className={cn('v2-interactive rounded font-semibold text-primary hover:underline', FOCUS_RING)}>
        your Files
      </Link>
      .
    </p>
  );
}
