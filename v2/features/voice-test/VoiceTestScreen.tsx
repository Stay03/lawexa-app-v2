'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Copy, Loader2, Mic, MicOff, Phone, PhoneOff } from 'lucide-react';

import { useV2Session } from '@/v2/runtime/session-context';
import { cn } from '@/lib/utils';
import type { VoiceTestMode } from '@/types/voice-test';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { OutOfMessagesNotice } from '@/v2/features/subscription/OutOfMessagesNotice';
import { VoiceTestController, type VoiceTestState } from './voice-controller';
import { callClock, delayCsv, delayRows, researchRows, secondsLabel, type DelayRow } from './voice-model';

/**
 * `/labs/voice`: the staff live-voice test page (thread ac47b1df). Talk to
 * Lawexa, switch between the two ways of answering, pick a voice, and read how
 * long each answer took to start, in the browser and on the server. Staff only
 * (`user.can_record`); hidden from every menu.
 */

const MODES: { mode: VoiceTestMode; label: string; detail: string }[] = [
  { mode: 'a', label: 'Lawexa voice', detail: 'A quick voice talks with you while Lawexa researches in the background, then reads you Lawexa’s answer.' },
  { mode: 'c', label: 'Lawexa thinks', detail: 'Lawexa writes every answer. ElevenLabs only hears and speaks.' },
  { mode: 'b', label: 'ElevenLabs thinks', detail: 'ElevenLabs’ own model answers, using Lawexa’s case search.' },
];

function Segmented<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex self-start rounded-full bg-muted p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'v2-interactive rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed',
              selected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground disabled:hover:text-muted-foreground',
              FOCUS_RING,
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * After the call: the call as a chat (Backend c21b513c). A `c` call's chat
 * exists from the start; a `b` call's is saved 15 to 30 seconds after it
 * ends, so the page says so until the link arrives. Questions that went
 * unpaid show the same out-of-messages notice as typed chat.
 */
function SavedCall({ state }: { state: VoiceTestState }) {
  if (state.phase !== 'ended') return null;
  return (
    <div className="flex flex-col gap-3">
      {state.conversationUuid ? (
        <Link
          href={`/c/${state.conversationUuid}`}
          className={cn('v2-interactive inline-flex w-fit items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary', FOCUS_RING)}
        >
          Open this call as a chat <ArrowRight aria-hidden className="size-4" />
        </Link>
      ) : state.saving ? (
        <p role="status" className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />
          Saving this call as a chat…
        </p>
      ) : state.savingLate ? (
        <p role="status" className="text-[13px] text-muted-foreground">
          The chat will appear in your chats shortly.
        </p>
      ) : null}
      {state.outOfMessages ? <OutOfMessagesNotice tight /> : null}
    </div>
  );
}

function CallBar({ state, controller }: { state: VoiceTestState; controller: VoiceTestController }) {
  const { phase } = state;
  const live = phase === 'live';
  const busy = phase === 'starting' || phase === 'ending';
  const speaking = live && state.log.speaking;
  const status =
    phase === 'starting'
      ? 'Connecting…'
      : phase === 'ending'
        ? 'Ending the call…'
        : live
          ? speaking
            ? 'Lawexa is speaking'
            : state.muted
              ? 'Muted'
              : 'Listening'
          : phase === 'ended'
            ? `Call ended, ${callClock(state.elapsed)}`
            : 'Not in a call';
  return (
    <div className="flex flex-wrap items-center gap-3">
      {live || phase === 'ending' ? (
        <button
          type="button"
          onClick={() => void controller.end()}
          disabled={phase === 'ending'}
          className={cn('v2-interactive inline-flex h-11 items-center gap-2 rounded-full bg-destructive px-5 text-sm font-medium text-white disabled:opacity-60', FOCUS_RING)}
        >
          <PhoneOff aria-hidden className="size-4" />
          End
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void controller.start()}
          disabled={busy}
          className={cn('v2-interactive inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60', FOCUS_RING)}
        >
          {phase === 'starting' ? <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : <Phone aria-hidden className="size-4" />}
          Call
        </button>
      )}
      <button
        type="button"
        onClick={controller.toggleMute}
        disabled={!live}
        aria-pressed={state.muted}
        aria-label={state.muted ? 'Unmute' : 'Mute'}
        className={cn(
          'v2-interactive flex size-11 items-center justify-center rounded-full border border-border text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40',
          state.muted && 'bg-secondary',
          FOCUS_RING,
        )}
      >
        {state.muted ? <MicOff aria-hidden className="size-4" /> : <Mic aria-hidden className="size-4" />}
      </button>
      <span className="flex items-center gap-2 text-[13px] text-muted-foreground" aria-live="polite">
        <span
          aria-hidden
          className={cn(
            'size-2 rounded-full',
            speaking ? 'bg-primary motion-safe:animate-pulse' : live ? 'bg-emerald-500' : 'bg-muted-foreground/40',
          )}
        />
        {status}
        {live ? <span className="tabular-nums">{callClock(state.elapsed)}</span> : null}
      </span>
    </div>
  );
}

function Transcript({ state }: { state: VoiceTestState }) {
  const list = useRef<HTMLOListElement>(null);
  const count = state.log.lines.length;
  useEffect(() => {
    const node = list.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [count]);
  if (count === 0) {
    return (
      <p className="py-6 text-center text-[13px] text-muted-foreground">
        {state.phase === 'live' ? 'Say something. Your words and Lawexa’s show here.' : 'The conversation shows here once you call.'}
      </p>
    );
  }
  return (
    <ol ref={list} aria-live="polite" className="flex max-h-80 flex-col gap-3 overflow-y-auto overscroll-y-contain py-1">
      {state.log.lines.map((line) => (
        <li key={line.id} className={cn('flex flex-col gap-0.5', line.who === 'you' ? 'items-end text-right' : 'items-start')}>
          <span className="text-xs font-medium text-muted-foreground">{line.who === 'you' ? 'You' : 'Lawexa'}</span>
          <p
            className={cn(
              'max-w-[85%] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed',
              line.who === 'you' ? 'bg-secondary text-foreground' : 'bg-primary/10 text-foreground',
            )}
          >
            {line.text}
          </p>
        </li>
      ))}
    </ol>
  );
}

function CopyCsv({ rows, state }: { rows: DelayRow[]; state: VoiceTestState }) {
  const [copied, setCopied] = useState(false);
  const voice = state.voices.find((option) => option.id === state.voiceId)?.name ?? state.voiceId;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(delayCsv(rows, state.mode, voice));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      disabled={rows.length === 0}
      className={cn(
        'v2-interactive inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40',
        FOCUS_RING,
      )}
    >
      {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
      {copied ? 'Copied' : 'Copy as CSV'}
    </button>
  );
}

function DelayTable({ state }: { state: VoiceTestState }) {
  const rows = delayRows(state.log.turns, state.serverTurns);
  const serverColumns = state.mode === 'c';
  return (
    <section aria-labelledby="voice-delays" className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 id="voice-delays" className="text-[15px] font-semibold text-foreground">
          How long each answer took
        </h2>
        <span className="ml-auto">
          <CopyCsv rows={rows} state={state} />
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Timed in this browser, from the end of your question to Lawexa’s first sound.
        {serverColumns
          ? ' The server columns show how much of that was Lawexa’s own thinking.'
          : state.mode === 'a'
            ? ' The quick voice answers first; Lawexa’s research is timed in its own table below.'
            : ' ElevenLabs answers this kind of call, so there are no server columns.'}
      </p>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
          Each question you ask adds a row.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">You said</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">First sound</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Research answer</th>
                {serverColumns ? (
                  <>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Server, first text</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Server, research</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((row) => (
                <tr key={row.number}>
                  <td className="max-w-[240px] px-3 py-2.5">
                    <span className="line-clamp-2 text-foreground">{row.youSaid}</span>
                    {row.research ? <span className="mt-0.5 block text-xs text-muted-foreground">First sound was the holding line</span> : null}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{secondsLabel(row.firstSound)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{row.research ? secondsLabel(row.answerSound) : '–'}</td>
                  {serverColumns ? (
                    <>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{secondsLabel(row.serverFirstText)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{row.research ? secondsLabel(row.serverResearch) : '–'}</td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {state.mode === 'a' ? <ResearchTable state={state} /> : null}
    </section>
  );
}

/**
 * A Lawexa voice call's research (Backend, 22 November 2026): one row per
 * research Lawexa ran in the background, its time on the server, and how soon
 * the voice read the answer once the page passed it in.
 */
function ResearchTable({ state }: { state: VoiceTestState }) {
  const rows = researchRows(state.serverTurns, state.log.deliveries);
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[14px] font-semibold text-foreground">Lawexa’s research</h3>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
          Each question Lawexa researches adds a row.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full min-w-[480px] text-left text-[13px]">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Question</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Research</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Read out after</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((row) => (
                <tr key={row.number}>
                  <td className="max-w-[260px] px-3 py-2.5">
                    <span className="line-clamp-2 text-foreground">{row.question}</span>
                    {row.queued ? <span className="mt-0.5 block text-xs text-muted-foreground">Waiting behind another question</span> : null}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{secondsLabel(row.research)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{secondsLabel(row.spokenAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function VoiceTestScreen() {
  const { canRecord } = useV2Session();
  const [controller] = useState(() => new VoiceTestController());
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);

  // Leaving the page hangs up and tells the server, so the call's cost is recorded.
  useEffect(() => {
    const leave = () => controller.dispose();
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      controller.dispose();
    };
  }, [controller]);

  if (!canRecord) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <h1 className="text-xl font-semibold text-foreground">Voice test</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">This page is for Lawexa staff with recording switched on.</p>
      </div>
    );
  }

  const locked = state.phase === 'starting' || state.phase === 'live' || state.phase === 'ending';
  const mode = MODES.find((option) => option.mode === state.mode) ?? MODES[0];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground md:text-2xl">Voice test</h1>
        <p className="text-[14px] text-muted-foreground">Staff only. Talk to Lawexa and see how long each answer takes to start.</p>
      </header>


      <section aria-label="Call" className="flex flex-col gap-5 rounded-3xl border border-border/80 bg-background p-5 shadow-[0_12px_32px_-18px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Who thinks</span>
          <Segmented
            label="Who thinks"
            value={state.mode}
            options={MODES.map((option) => ({ value: option.mode, label: option.label }))}
            disabled={locked}
            onChange={controller.setMode}
          />
          <p className="text-[13px] text-muted-foreground">{mode.detail}</p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Voice</span>
          <Segmented
            label="Voice"
            value={state.voiceId}
            options={state.voices.map((voice) => ({ value: voice.id, label: voice.name }))}
            disabled={locked}
            onChange={controller.setVoice}
          />
        </div>
        <CallBar state={state} controller={controller} />
        {state.problem ? <p className="text-[13px] text-destructive">{state.problem}</p> : null}
        {state.blocked ? <OutOfMessagesNotice tight blocked={state.blocked} /> : null}
        <SavedCall state={state} />
        <div className="border-t border-border/70 pt-4">
          <Transcript state={state} />
        </div>
      </section>

      <DelayTable state={state} />
    </div>
  );
}
