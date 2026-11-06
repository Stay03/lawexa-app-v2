'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Pause, Play, X } from 'lucide-react';

import { wrappedApi } from '@/lib/api/wrapped';
import { createProgressTracker } from '@/lib/wrapped/progress';
import { FRAME_THEMES } from '@/lib/wrapped/theme';
import { HOLD_MS, framesToPlay, initialStory, progressOf, storyReducer, tapSide } from '@/lib/wrapped/story-model';
import type { ShareFonts } from '@/lib/wrapped/share-image';
import type { WrappedRecord } from '@/lib/wrapped/types';
import { StoryFrame } from './frames';
import { ShareFrame } from './ShareFrame';

/**
 * The story viewer (Arthur's spec, 10 October 2026): full screen, tap the right
 * of the screen for the next frame and the left to go back, hold to pause, a
 * progress bar across the top. The arrow keys and the space bar do the same on
 * a computer, except that Space on a focused button or link presses it. It pauses while the tab is in the background, and the share card
 * at the end waits for the student. The frames come from the record's `slides`,
 * where the server has already skipped what has no data.
 */
export function WrappedStory({ record, fonts, onClose }: { record: WrappedRecord; fonts: ShareFonts; onClose: () => void }) {
  const frames = useMemo(() => framesToPlay(record), [record]);
  const count = frames.length;
  const [state, dispatch] = useReducer((current: ReturnType<typeof initialStory>, action: Parameters<typeof storyReducer>[2]) => storyReducer(count, current, action), undefined, initialStory);
  const slide = frames[state.index] ?? 8;

  // The view counts (lib/wrapped/progress.ts): opened, each card shown, the
  // end reached, each share. Fire-and-forget, once per visit, never in the way.
  const [tracker] = useState(() => createProgressTracker(wrappedApi.progress));
  useEffect(() => {
    tracker.open();
  }, [tracker]);
  useEffect(() => {
    tracker.card(slide);
    if (state.index === count - 1) tracker.finish();
  }, [tracker, slide, state.index, count]);
  const ground = FRAME_THEMES[slide].ground;

  // The clock: one animation frame at a time, so a paused or hidden tab costs nothing.
  useEffect(() => {
    let last = performance.now();
    let id = 0;
    const loop = (now: number) => {
      dispatch({ type: 'tick', ms: now - last });
      last = now;
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onVisibility = () => dispatch({ type: document.hidden ? 'pause' : 'resume' });
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Into the dialog on open, so the keyboard starts inside the story and Tab reaches its buttons.
  const pauseButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    pauseButton.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      // A focused field keeps every key; a focused button or link keeps Space, which presses it.
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === ' ' && target?.closest('button, a')) return;
      if (event.key === 'ArrowRight') dispatch({ type: 'next' });
      else if (event.key === 'ArrowLeft') dispatch({ type: 'back' });
      else if (event.key === ' ') {
        event.preventDefault();
        dispatch({ type: 'toggle' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // A press: held past HOLD_MS it pauses until let go; shorter, it is a tap.
  const press = useRef<{ at: number; timer: ReturnType<typeof setTimeout> | null; held: boolean } | null>(null);
  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const timer = setTimeout(() => {
      if (press.current) press.current.held = true;
      dispatch({ type: 'pause' });
    }, HOLD_MS);
    press.current = { at: event.timeStamp, timer, held: false };
  }, []);
  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const current = press.current;
    press.current = null;
    if (!current) return;
    if (current.timer) clearTimeout(current.timer);
    if (current.held) {
      dispatch({ type: 'resume' });
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    dispatch({ type: tapSide(event.clientX - box.left, box.width) === 'back' ? 'back' : 'next' });
  }, []);
  const onPointerCancel = useCallback(() => {
    const current = press.current;
    press.current = null;
    if (current?.timer) clearTimeout(current.timer);
    if (current?.held) dispatch({ type: 'resume' });
  }, []);

  const progress = progressOf(count, state);
  const chromeColour = ground === 'ink' ? 'var(--wr-cream)' : 'var(--wr-ink)';

  return (
    <div className="wr-stage" role="dialog" aria-modal="true" aria-label="Your Lawexa Wrapped">
      <div className="wr-viewport">
        <div className="wr-progress" style={{ color: chromeColour }} aria-hidden>
          {progress.map((share, i) => (
            <span key={frames[i]}>
              <i style={{ transform: `scaleX(${share})` }} />
            </span>
          ))}
        </div>
        <div className="wr-chrome" style={{ color: chromeColour, ['--wr-chrome-ground' as string]: ground === 'ink' ? 'var(--wr-ink)' : 'var(--wr-cream)' }}>
          <span aria-live="polite">
            {state.index + 1} of {count}
          </span>
          <span style={{ display: 'flex', gap: 4 }}>
            <button ref={pauseButton} type="button" onClick={() => dispatch({ type: 'toggle' })} aria-label={state.paused ? 'Play' : 'Pause'}>
              {state.paused ? <Play aria-hidden size={20} /> : <Pause aria-hidden size={20} />}
            </button>
            <button type="button" onClick={onClose} aria-label="Close Wrapped">
              <X aria-hidden size={22} />
            </button>
          </span>
        </div>
        <div
          style={{ position: 'absolute', inset: 0 }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={onPointerCancel}
          onContextMenu={(event) => event.preventDefault()}
        >
          {slide === 8 ? <ShareFrame record={record} fonts={fonts} onShared={tracker.share} /> : <StoryFrame key={slide} slide={slide} record={record} />}
        </div>
      </div>
    </div>
  );
}
