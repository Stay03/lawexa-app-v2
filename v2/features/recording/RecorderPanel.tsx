'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, CloudUpload, Loader2, Mic, Pause, Play, RotateCw, ShieldCheck, Smartphone, Square, X } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import type { RecorderController, RecorderState } from './recorder-controller';
import {
  clock,
  finalSteps,
  liveTranscriptNote,
  savedUpToLine,
  startProblemLine,
  type LiveLine,
} from './recording-model';

/**
 * The recorder (thread ac47b1df; the design Stay OK'd on 20 November 2026):
 * opened by the microphone beside Send. On a computer it takes the message
 * box's place; on a phone it fills the screen, since the phone sits on the
 * table through the meeting. Staff only at first (`user.can_record`).
 */

/** The line said before every recording, and where it is saved. */
export function RecordingConsent({
  state,
  recorder,
  inSpace,
}: {
  state: RecorderState;
  recorder: RecorderController;
  inSpace: boolean;
}) {
  const open = state.phase === 'consent' || state.phase === 'starting' || state.phase === 'problem';
  const starting = state.phase === 'starting';
  return (
    <AlertDialog open={open} onOpenChange={(next) => (next ? undefined : recorder.cancel())}>
      <AlertDialogContent size="sm" className="gap-5 data-[size=sm]:max-w-[380px]">
        <AlertDialogHeader>
          <span className="relative mb-1 flex size-14 items-center justify-center">
            <span aria-hidden className="absolute inset-0 rounded-full bg-primary/10" />
            <span aria-hidden className="absolute inset-2 rounded-full bg-primary/15" />
            <Mic aria-hidden className="relative size-6 text-primary" />
          </span>
          <AlertDialogTitle className="text-lg">Record this meeting</AlertDialogTitle>
          <AlertDialogDescription className="text-[15px] leading-relaxed">
            Tell everyone present that you&rsquo;re recording. Lawexa will transcribe it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {state.problem ? (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-[13px] leading-snug text-destructive">
            <AlertTriangle aria-hidden className="mt-px size-4 shrink-0" />
            {startProblemLine(state.problem.kind, state.problem.message)}
          </p>
        ) : (
          <p className="flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-[13px] leading-snug text-muted-foreground">
            <ShieldCheck aria-hidden className="mt-px size-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
            {inSpace
              ? 'The audio and transcript are saved to this thread and your Files. Members of this Space can see them.'
              : 'The audio and transcript are saved to this chat and your Files. Only people in this chat can see them.'}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={recorder.cancel} disabled={starting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={starting}
            onClick={(event) => {
              // The dialog stays open while the recording starts; it closes as the recorder opens.
              event.preventDefault();
              if (state.phase === 'problem') recorder.ask();
              else void recorder.start();
            }}
          >
            {starting ? (
              <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <span aria-hidden className="size-2 rounded-full bg-red-500" />
            )}
            {starting ? 'Starting' : state.phase === 'problem' ? 'Try again' : 'Start recording'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** The live sound level: thin bars following the microphone, the newest on the right. */
function LevelMeter({ levels: history, bars, tall = false, className }: { levels: number[]; bars: number; tall?: boolean; className?: string }) {
  // The newest readings, right-aligned; empty bars before the first ones arrive.
  const recent = history.slice(-bars);
  const levels = Array.from({ length: bars }, (_, index) => recent[index - (bars - recent.length)] ?? 0);
  return (
    <span aria-hidden className={cn('flex items-center gap-[3px]', tall ? 'h-14' : 'h-5', className)}>
      {levels.map((value, index) => (
        <span
          key={index}
          className={cn('rounded-full bg-primary transition-[height] duration-150', tall ? 'w-[4px]' : 'w-[2.5px]')}
          style={{ height: `${Math.max(12, Math.round(value * 100))}%`, opacity: 0.35 + value * 0.65 }}
        />
      ))}
    </span>
  );
}

function Line({ line, hearing = false, speakerLabels }: { line: LiveLine; hearing?: boolean; speakerLabels: boolean }) {
  return (
    <li className="flex flex-col gap-0.5">
      <p className="flex items-baseline gap-2 text-xs text-muted-foreground">
        {speakerLabels && line.speaker ? <span className="font-medium text-foreground">{line.speaker}</span> : null}
        <span className="tabular-nums">{clock(line.at)}</span>
      </p>
      <p className={cn('text-[14px] leading-relaxed', hearing ? 'text-muted-foreground/60' : 'text-foreground/90')}>
        {line.text}
        {hearing ? <span aria-hidden className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] bg-primary/70 motion-safe:animate-pulse" /> : null}
      </p>
    </li>
  );
}

/** The live text as it arrives, kept scrolled to the newest line. */
function Transcript({ state, className }: { state: RecorderState; className?: string }) {
  const list = useRef<HTMLOListElement>(null);
  const { lines, hearing } = state.transcript;
  useEffect(() => {
    const node = list.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [lines.length, hearing?.text]);
  const empty = lines.length === 0 && !hearing;
  return (
    <ol
      ref={list}
      aria-live="polite"
      className={cn('flex flex-col gap-4 overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,transparent,black_28px)]', className)}
    >
      <li aria-hidden className="h-3 shrink-0" />
      {empty ? (
        <li className="py-2 text-[13px] text-muted-foreground">
          {state.liveDown ? 'The live text is unavailable. The recording goes on, and the final transcript comes after Stop.' : 'Listening…'}
        </li>
      ) : null}
      {lines.map((line) => (
        <Line key={line.id} line={line} speakerLabels={state.speakerLabels} />
      ))}
      {hearing ? <Line line={hearing} hearing speakerLabels={state.speakerLabels} /> : null}
    </ol>
  );
}

function OnAir({ paused }: { paused: boolean }) {
  return (
    <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
      <span aria-hidden className="relative flex size-2">
        {paused ? null : <span className="absolute inline-flex size-full rounded-full bg-red-500/60 motion-safe:animate-ping" />}
        <span className={cn('relative inline-flex size-2 rounded-full', paused ? 'bg-muted-foreground' : 'bg-red-500')} />
      </span>
      {paused ? 'Paused' : 'Recording'}
    </span>
  );
}

/** Round controls: Pause (or Resume) beside a red Stop. Labels sit under them on a phone. */
function Controls({ state, recorder, large = false }: { state: RecorderState; recorder: RecorderController; large?: boolean }) {
  const busy = state.phase !== 'live';
  const ring = cn('v2-interactive flex items-center justify-center rounded-full transition-colors disabled:opacity-40', FOCUS_RING);
  const control = (label: string, button: React.ReactNode) =>
    large ? (
      <span className="flex flex-col items-center gap-2">
        {button}
        <span className="text-xs text-muted-foreground">{label}</span>
      </span>
    ) : (
      button
    );
  return (
    <div className={cn('flex', large ? 'items-end justify-center gap-12' : 'items-center gap-2')}>
      {control(
        state.paused ? 'Resume' : 'Pause',
        <button
          type="button"
          aria-label={state.paused ? 'Resume' : 'Pause'}
          disabled={busy}
          onClick={state.paused ? recorder.resume : recorder.pause}
          className={cn(ring, 'border border-border bg-background text-foreground hover:bg-secondary', large ? 'size-14' : 'size-9')}
        >
          {state.paused ? (
            <Play aria-hidden className={cn('fill-current', large ? 'size-5' : 'size-3.5')} />
          ) : (
            <Pause aria-hidden className={cn('fill-current', large ? 'size-5' : 'size-3.5')} />
          )}
        </button>,
      )}
      {control(
        'Stop',
        <button
          type="button"
          aria-label="Stop and save"
          disabled={busy}
          onClick={() => void recorder.stop()}
          className={cn(ring, 'bg-red-600 text-white shadow-[0_6px_18px_-6px_rgba(220,38,38,0.6)] hover:bg-red-600/90', large ? 'size-[72px]' : 'size-9')}
        >
          {state.phase === 'stopping' ? (
            <Loader2 aria-hidden className={cn('animate-spin motion-reduce:animate-none', large ? 'size-6' : 'size-3.5')} />
          ) : (
            <Square aria-hidden className={cn('fill-current', large ? 'size-6 rounded-[3px]' : 'size-3.5 rounded-[2px]')} />
          )}
        </button>,
      )}
    </div>
  );
}

/** After Stop: what is done and what is still being written, in order. */
function FinalSteps({ state, recorder, className }: { state: RecorderState; recorder: RecorderController; className?: string }) {
  const failed = state.stage === 'failed';
  const steps = finalSteps(failed ? 'uploading' : (state.stage ?? 'uploading'), state.elapsed);
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <ol className="flex flex-col gap-2.5">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center gap-2.5 text-[13px]">
            {step.state === 'done' ? (
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check aria-hidden className="size-3" strokeWidth={3} />
              </span>
            ) : step.state === 'now' && !failed ? (
              <Loader2 aria-hidden className="size-5 animate-spin text-primary motion-reduce:animate-none" />
            ) : (
              <span aria-hidden className="size-5 rounded-full border border-dashed border-border" />
            )}
            <span className={cn(step.state === 'next' ? 'text-muted-foreground' : 'font-medium text-foreground')}>{step.label}</span>
          </li>
        ))}
      </ol>
      {failed ? (
        <div role="alert" className="flex flex-col gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive">
          <p>{state.stageError || 'Finishing the recording failed. The audio is saved.'}</p>
          <Button type="button" size="sm" variant="outline" className="w-fit gap-1.5 bg-background" onClick={() => void recorder.retry()}>
            <RotateCw aria-hidden className="size-3.5" />
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SavedNote({ state }: { state: RecorderState }) {
  const line = savedUpToLine(state.savedPieces);
  if (!line) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <CloudUpload aria-hidden className="size-3.5" />
      {line}
    </span>
  );
}

export function RecordingPanel({ state, recorder, title }: { state: RecorderState; recorder: RecorderController; title: string }) {
  const { phase } = state;
  if (phase !== 'live' && phase !== 'stopping' && phase !== 'finalising') return null;
  const finalising = phase === 'finalising';
  const doneLine =
    state.stage === 'done'
      ? 'Done. The recording, its transcript and Lawexa’s summary are in the chat.'
      : 'You can leave. The recording, its transcript and Lawexa’s summary appear in the chat when they’re ready.';
  const header = finalising ? (
    <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
      {state.stage === 'done' ? (
        <Check aria-hidden className="size-3.5 text-primary" />
      ) : state.stage === 'failed' ? (
        <AlertTriangle aria-hidden className="size-3.5 text-destructive" />
      ) : (
        <Loader2 aria-hidden className="size-3.5 animate-spin text-primary motion-reduce:animate-none" />
      )}
      {state.stage === 'done' ? 'Recording saved' : state.stage === 'failed' ? 'Finishing failed' : 'Finalising transcript'}
    </span>
  ) : phase === 'stopping' ? (
    <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
      <Loader2 aria-hidden className="size-3.5 animate-spin text-primary motion-reduce:animate-none" />
      Saving the last minute
    </span>
  ) : (
    <OnAir paused={state.paused} />
  );
  const closeButton = finalising ? (
    <button
      type="button"
      aria-label="Close"
      onClick={recorder.close}
      className={cn('v2-interactive ml-auto flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary', FOCUS_RING)}
    >
      <X aria-hidden className="size-4" />
    </button>
  ) : null;

  return (
    <>
      <section
        aria-label="Recording"
        className="hidden overflow-hidden rounded-[28px] border border-border/80 bg-background shadow-[0_12px_32px_-14px_rgba(0,0,0,0.3)] md:block"
      >
        <header className="flex items-center gap-3 border-b border-border/70 px-5 py-3">
          {header}
          <span className="text-[13px] tabular-nums text-muted-foreground">{clock(state.elapsed)}</span>
          {finalising ? closeButton : <LevelMeter levels={state.levels} bars={28} className="ml-auto" />}
        </header>
        {finalising ? (
          <div className="flex flex-col gap-4 px-5 py-5">
            <FinalSteps state={state} recorder={recorder} />
            <p className="text-xs leading-relaxed text-muted-foreground">{doneLine}</p>
          </div>
        ) : (
          <>
            <Transcript state={state} className="max-h-60 px-5 pb-1" />
            <footer className="flex items-center gap-3 border-t border-border/70 px-5 py-3">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-xs text-muted-foreground">{liveTranscriptNote(state.speakerLabels)}</span>
                <SavedNote state={state} />
              </span>
              <Controls state={state} recorder={recorder} />
            </footer>
          </>
        )}
      </section>

      {typeof document !== 'undefined'
        ? createPortal(
            <section
              aria-label="Recording"
              className="fixed inset-0 z-50 flex flex-col bg-background px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] md:hidden"
            >
              <header className="flex min-h-10 items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-center text-[13px] font-medium text-muted-foreground">{title}</p>
                {closeButton}
              </header>

              <div className="flex flex-col items-center gap-3 pt-6 pb-5">
                {header}
                <span className="text-[52px] leading-none font-extralight tracking-tight tabular-nums text-foreground">{clock(state.elapsed)}</span>
                {finalising ? null : <LevelMeter levels={state.levels} bars={36} tall className="mt-2" />}
              </div>

              {finalising ? (
                <div className="flex flex-col gap-5 rounded-3xl bg-muted/50 px-5 py-6">
                  <FinalSteps state={state} recorder={recorder} />
                  <p className="text-[13px] leading-relaxed text-muted-foreground">{doneLine}</p>
                </div>
              ) : (
                <div className="min-h-0 flex-1 rounded-3xl bg-muted/50 px-4">
                  <Transcript state={state} className="h-full pb-4" />
                </div>
              )}

              {finalising ? null : (
                <>
                  <div className="mt-4 flex flex-col items-center gap-1.5">
                    <p className="flex items-center gap-1.5 rounded-full bg-muted/70 px-3 py-1 text-xs text-muted-foreground">
                      <Smartphone aria-hidden className="size-3.5" />
                      Keep this screen open while you record
                    </p>
                    <SavedNote state={state} />
                  </div>
                  <div className="mt-5">
                    <Controls state={state} recorder={recorder} large />
                  </div>
                </>
              )}
            </section>,
            document.body,
          )
        : null}
    </>
  );
}
