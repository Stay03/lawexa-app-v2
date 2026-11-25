'use client';

import { useEffect, useRef } from 'react';
import { ArrowUp, Loader2, Mic, Pause, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DictationController, DictationState } from './dictation-controller';
import { dictationHint, SEND_UNDO_MS, timerLabel } from './dictation-model';
import './dictation.css';

/**
 * Dictation in the message box, design A2 (Arthur, 25 November 2026): the
 * words fill the box, and the controls sit on their own row under them:
 * X (cancel and clear), the red dot and the clock, the sound bar, Pause and
 * Send. No "Listening" word. A spoken "send" puts "Sending in 2… Undo" above
 * the box ({@link DictationCountdown}); the quiet line under it is
 * {@link DictationHint}.
 */

const ROUND =
  'v2-interactive focus-visible:ring-ring flex size-8 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50';

export function DictationPanel({
  state,
  dictation,
  canSend,
  isSending,
}: {
  state: DictationState;
  dictation: DictationController;
  /** Whether Send may go now (no upload running, no turn holding it). */
  canSend: boolean;
  /** The words and the voice are on their way. */
  isSending: boolean;
}) {
  const wordsRef = useRef<HTMLDivElement>(null);
  const paused = state.phase === 'paused';
  const hearing = state.phase === 'listening';

  // The newest words stay in view as they arrive.
  useEffect(() => {
    const words = wordsRef.current;
    if (words) words.scrollTop = words.scrollHeight;
  }, [state.text, state.partial]);

  const hasAnyWords = state.text.trim() !== '' || state.partial.trim() !== '';

  return (
    <div className="flex flex-col" onClick={(event) => event.stopPropagation()}>
      {paused ? (
        <textarea
          aria-label="Dictated message"
          value={state.text}
          onChange={(event) => dictation.setText(event.target.value)}
          rows={2}
          autoFocus
          className="text-foreground max-h-[150px] min-h-12 w-full resize-none bg-transparent px-3 pt-2 pb-1 text-base leading-relaxed [field-sizing:content] focus:outline-none md:text-[15px]"
        />
      ) : (
        <div
          ref={wordsRef}
          aria-live="polite"
          aria-label="Dictated message"
          className="text-foreground max-h-[150px] min-h-12 overflow-y-auto px-3 pt-2 pb-1 text-base leading-relaxed md:text-[15px]"
        >
          {state.text}
          {state.partial ? <span className="text-muted-foreground"> {state.partial}</span> : null}
          {hearing ? (
            <span aria-hidden className="bg-primary ml-0.5 inline-block h-4 w-0.5 translate-y-[3px] animate-pulse rounded-full" />
          ) : null}
          {!hasAnyWords && state.phase === 'starting' ? (
            <span className="text-muted-foreground">Starting the microphone…</span>
          ) : null}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button type="button" aria-label="Cancel dictation" onClick={() => void dictation.cancel()} className={cn(ROUND, 'bg-secondary text-foreground hover:bg-secondary/80')}>
          <X aria-hidden className="size-4" />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            aria-hidden
            className={cn(
              'size-2 shrink-0 rounded-full transition-colors',
              hearing ? 'bg-red-600 shadow-[0_0_0_4px_rgba(220,38,38,0.14)] dark:bg-red-500' : 'bg-muted-foreground/50',
            )}
          />
          <span className="text-muted-foreground text-[13px] tabular-nums" aria-label="Time dictated">
            {timerLabel(state.elapsedMs)}
          </span>
          <SoundBar levels={state.levels} quiet={!hearing} />
        </div>

        {paused ? (
          <button
            type="button"
            aria-label="Go on dictating"
            onClick={dictation.resume}
            disabled={state.atLimit}
            className={cn(ROUND, 'border-border text-foreground hover:bg-secondary border')}
          >
            <Mic aria-hidden className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Pause"
            onClick={dictation.pause}
            disabled={state.phase === 'starting'}
            className={cn(ROUND, 'border-border text-foreground hover:bg-secondary border')}
          >
            <Pause aria-hidden className="size-4 fill-current" />
          </button>
        )}

        <button
          type="button"
          aria-label="Send"
          onClick={() => void dictation.send()}
          disabled={!canSend || !hasAnyWords || isSending || state.phase === 'starting'}
          className={cn(ROUND, 'bg-primary text-primary-foreground hover:bg-primary/90')}
        >
          {isSending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ArrowUp aria-hidden className="size-4" />}
        </button>
      </div>
    </div>
  );
}

/** The last loudness readings as bars, newest on the right; faint while not hearing. */
function SoundBar({ levels, quiet }: { levels: number[]; quiet: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-[22px] min-w-0 flex-1 items-center justify-end gap-[2.5px] overflow-hidden transition-opacity [mask-image:linear-gradient(to_right,transparent,#000_18%,#000_82%,transparent)]',
        quiet && 'opacity-35',
      )}
    >
      {levels.map((level, index) => (
        <i
          // The bars shift left as readings arrive; the position is the identity.
          key={index}
          className="bg-primary/80 block w-[3px] shrink-0 rounded-full"
          style={{ height: `${4 + Math.round(level * 18)}px` }}
        />
      ))}
    </span>
  );
}

/** "Sending in 2… Undo": a spoken "send" waits here before it goes. */
export function DictationCountdown({ state, dictation }: { state: DictationState; dictation: DictationController }) {
  if (state.phase !== 'countdown' || state.sendIn === null) return null;
  return (
    <div className="mb-2 flex justify-center" role="status">
      <span className="bg-foreground text-background inline-flex items-center gap-2.5 rounded-full py-1.5 pr-1.5 pl-3.5 text-[13px] shadow-[0_6px_18px_-8px_rgba(0,0,0,0.4)]">
        <svg aria-hidden viewBox="0 0 16 16" className="size-4 -rotate-90">
          <circle cx="8" cy="8" r="6" fill="none" strokeWidth="3" className="stroke-background/25" />
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            strokeWidth="3"
            pathLength={100}
            strokeDasharray="100"
            className="stroke-primary motion-safe:animate-[dictation-ring_linear_forwards]"
            style={{ animationDuration: `${SEND_UNDO_MS}ms` }}
          />
        </svg>
        Sending in {state.sendIn}…
        <button
          type="button"
          onClick={dictation.undo}
          className="v2-interactive bg-background text-foreground focus-visible:ring-ring rounded-full px-3 py-1.5 text-[12.5px] leading-none font-semibold focus-visible:outline-none focus-visible:ring-2"
        >
          Undo
        </button>
      </span>
    </div>
  );
}

/** The quiet line under the box while dictating. */
export function DictationHint({ state }: { state: DictationState }) {
  const hint = dictationHint(state);
  if (!hint) return null;
  return <p className="text-muted-foreground mt-1.5 text-center text-xs">{hint}</p>;
}
