'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { Pause, Play, X } from 'lucide-react';

import { wrappedApi } from '@/lib/api/wrapped';
import { characterFor } from '@/lib/wrapped26/characters';
import { EASE_IN_OUT, EASE_OUT, MOTION } from '@/lib/wrapped26/motion';
import { createWrapped26Tracker } from '@/lib/wrapped26/progress';
import type { CardFonts } from '@/lib/wrapped26/share-card';
import {
  HOLD_MS,
  WRAPPED26_SLIDES,
  cardNumber,
  initialStory,
  segmentFill,
  slidesToPlay,
  stageScale,
  storyReducer,
  tapSide,
  type Wrapped26StoryAction,
  type Wrapped26StoryState,
} from '@/lib/wrapped26/story';
import type { Wrapped26Record, Wrapped26SlideId } from '@/lib/wrapped26/types';
import { ShareSlide } from './ShareSlide';
import { WheelSlide } from './WheelSlide';
import {
  BusiestDaySlide,
  CastingSlide,
  ColdOpenSlide,
  FirstSearchSlide,
  GlowUpSlide,
  GuessSlide,
  IntroSlide,
  ObsessionSlide,
  PeersSlide,
  PhysicalSlide,
  RevealSlide,
  StarSlide,
} from './slides';

/**
 * The Wrapped 2026 story (the kit's BUILD_SPEC §4 and prototype). A 1080×1920
 * stage scaled to the screen; tap the right 70% for next and the left 30% for
 * back, hold for 220 ms to pause everything, arrows and space on a computer,
 * Esc to leave. Taps during a transition wait their turn (one step). The
 * slides come from the record's `slides`, where the server has already
 * skipped what has no data. lib/wrapped26/story.ts holds the rules.
 */

const subscribeReduced = (onChange: () => void) => {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
const readReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const subscribeSize = (onChange: () => void) => {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
};
const readScale = () => stageScale(window.innerWidth, window.innerHeight);

export function Wrapped26Story({ record, fonts, onClose }: { record: Wrapped26Record; fonts: CardFonts; onClose: () => void }) {
  const slides = useMemo(() => slidesToPlay(record.slides), [record.slides]);
  const character = useMemo(() => characterFor(record.track, record.character.name), [record.track, record.character.name]);
  const [state, dispatch] = useReducer((current: Wrapped26StoryState, action: Wrapped26StoryAction) => storyReducer(slides, current, action), undefined, () => initialStory());
  const [guess, setGuess] = useState<number | null>(null);
  const reduced = useSyncExternalStore(subscribeReduced, readReduced, () => false);
  const scale = useSyncExternalStore(subscribeSize, readScale, () => 1);

  const current = slides[state.index];
  const outgoing = state.from !== null ? slides[state.from] : undefined;
  const spec = current ? WRAPPED26_SLIDES[current] : null;
  const ground = spec?.theme[record.track] ?? 'ink';

  // View counts (lib/wrapped26/progress.ts): once per visit, never in the way.
  const [tracker] = useState(() => createWrapped26Tracker(wrappedApi.progress2026));
  useEffect(() => tracker.open(), [tracker]);
  useEffect(() => {
    if (!current) return;
    tracker.card(cardNumber(current));
    if (state.index === slides.length - 1) tracker.finish();
  }, [tracker, current, state.index, slides.length]);

  // The clock, one animation frame at a time.
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

  // Hold pauses every animation on the stage, not just the clock.
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    for (const animation of el.getAnimations({ subtree: true })) {
      if (state.paused) animation.pause();
      else if (animation.playState === 'paused') animation.play();
    }
  }, [state.paused]);

  // The transition: the incoming slide over the outgoing one, then `settled`.
  const incomingRef = useRef<HTMLDivElement>(null);
  const outgoingRef = useRef<HTMLDivElement>(null);
  const tapPoint = useRef<[number, number] | null>(null);
  useEffect(() => {
    if (!state.moving || !current) return;
    const incoming = incomingRef.current;
    const old = outgoingRef.current;
    const kind = state.direction < 0 ? 'push' : WRAPPED26_SLIDES[current].transition;
    if (!incoming || !old || reduced) {
      const fade = reduced && incoming ? incoming.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'both' }) : null;
      const done = () => dispatch({ type: 'settled' });
      if (fade) fade.finished.then(done, done);
      else done();
      return () => fade?.cancel();
    }
    const animations: Animation[] = [];
    if (kind === 'wipe') {
      const [x, y] = tapPoint.current ?? [980, 1700];
      animations.push(
        incoming.animate([{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(2300px at ${x}px ${y}px)` }], { duration: MOTION.wipe, easing: EASE_IN_OUT, fill: 'both' }),
        old.animate([{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(.94)', filter: 'brightness(.6)' }], { duration: MOTION.wipe, easing: EASE_IN_OUT, fill: 'both' }),
      );
    } else if (kind === 'spotlight') {
      animations.push(
        old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'both' }),
        incoming.animate(
          [
            { clipPath: 'circle(0px at 50% 30%)', filter: 'brightness(2)' },
            { clipPath: 'circle(60px at 50% 30%)', filter: 'brightness(2)', offset: 0.3 },
            { clipPath: 'circle(2300px at 50% 30%)', filter: 'brightness(1)' },
          ],
          { duration: MOTION.spotlight, easing: EASE_IN_OUT, fill: 'both' },
        ),
      );
    } else {
      const d = state.direction;
      animations.push(
        incoming.animate([{ transform: `translateY(${d * 9}%) scale(1.02)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: MOTION.push, easing: EASE_OUT, fill: 'both' }),
        old.animate([{ transform: 'none', opacity: 1 }, { transform: `translateY(${-d * 6}%) scale(.96)`, opacity: 0 }], { duration: MOTION.push, easing: EASE_OUT, fill: 'both' }),
      );
    }
    tapPoint.current = null;
    let cancelled = false;
    Promise.all(animations.map((a) => a.finished)).then(
      () => {
        if (cancelled) return;
        for (const animation of animations) animation.cancel();
        dispatch({ type: 'settled' });
      },
      () => {},
    );
    return () => {
      cancelled = true;
      for (const animation of animations) animation.cancel();
    };
  }, [state.moving, state.index, state.direction, current, reduced]);

  // Into the dialog on open, so the keyboard starts inside the story.
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
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === ' ' && target?.closest('button, a')) return;
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault();
        dispatch({ type: 'tap-next' });
      } else if (event.key === 'ArrowLeft') dispatch({ type: 'back' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // A press: held past HOLD_MS it pauses until let go; shorter, it is a tap.
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; held: boolean } | null>(null);
  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const timer = setTimeout(() => {
      if (press.current) press.current.held = true;
      dispatch({ type: 'pause' });
    }, HOLD_MS);
    press.current = { timer, held: false };
  }, []);
  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const pressed = press.current;
    press.current = null;
    if (!pressed) return;
    clearTimeout(pressed.timer);
    if (pressed.held) {
      dispatch({ type: 'resume' });
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left;
    if (tapSide(x, box.width) === 'back') {
      dispatch({ type: 'back' });
      return;
    }
    tapPoint.current = [(x / box.width) * 1080, ((event.clientY - box.top) / box.height) * 1920];
    dispatch({ type: 'tap-next' });
  }, []);
  const onPointerCancel = useCallback(() => {
    const pressed = press.current;
    press.current = null;
    if (pressed) clearTimeout(pressed.timer);
    if (pressed?.held) dispatch({ type: 'resume' });
  }, []);

  const onGuess = useCallback(
    (option: number) => {
      setGuess(option);
      tracker.guess(option);
      navigator.vibrate?.(10);
      setTimeout(() => dispatch({ type: 'advance' }), reduced ? 200 : 650);
    },
    [tracker, reduced],
  );

  const renderSlide = (id: Wrapped26SlideId, active: boolean) => {
    const props = { record, character, active, reduced };
    switch (id) {
      case '00':
        return <IntroSlide {...props} onStart={() => dispatch({ type: 'advance' })} />;
      case '01':
        return <ColdOpenSlide {...props} />;
      case '02a':
        return <GuessSlide {...props} chosen={guess} onGuess={onGuess} />;
      case '02b':
        return <RevealSlide {...props} chosen={guess} />;
      case '03':
        return <PhysicalSlide {...props} />;
      case '04':
        return <FirstSearchSlide {...props} />;
      case '05':
        return <ObsessionSlide {...props} />;
      case '06':
        return <BusiestDaySlide {...props} />;
      case '07':
        return <GlowUpSlide {...props} />;
      case '08':
        return <PeersSlide {...props} />;
      case '09a':
        return <CastingSlide {...props} />;
      case '09b':
      case '09c':
        return <WheelSlide {...props} />;
      case '09d':
        return <StarSlide {...props} />;
      case '10':
        return <ShareSlide {...props} fonts={fonts} onShared={tracker.share} />;
    }
  };

  const fill = segmentFill(slides, state.index, state.elapsed);
  const chromeShown = spec !== null && spec.step !== 0;
  const student = record.track === 'undergraduates';

  return (
    <div className="w26" role="dialog" aria-modal="true" aria-label="Your Lawexa Wrapped 2026">
      <div
        ref={stage}
        className="w26-stage"
        style={{ transform: `scale(${scale})` }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerCancel}
        onContextMenu={(event) => event.preventDefault()}
      >
        {outgoing && state.moving ? (
          <div ref={outgoingRef} key={`out-${outgoing}`} className={`w26-slide w26-${WRAPPED26_SLIDES[outgoing].theme[record.track]}`} aria-hidden>
            {renderSlide(outgoing, false)}
          </div>
        ) : null}
        {current ? (
          <div ref={incomingRef} key={`in-${current}`} className={`w26-slide w26-${ground}`} style={{ zIndex: 1 }}>
            {renderSlide(current, !state.moving)}
          </div>
        ) : null}
        <div className="w26-chrome" data-ground={ground} style={{ opacity: chromeShown ? 1 : 0 }}>
          <div className="w26-bars" aria-hidden>
            {fill.map((share, i) => (
              <i key={i}>
                <b style={{ transform: `scaleX(${share})` }} />
              </i>
            ))}
          </div>
          <div className="w26-top">
            <span className="w26-eyebrow">Lawexa Wrapped 2026</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="w26-tag" style={{ background: student ? 'var(--w26-gold)' : 'var(--w26-lilac)' }}>
                {student ? 'Student' : 'Counsel'}
              </span>
              <button
                ref={pauseButton}
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onPointerUp={(event) => event.stopPropagation()}
                onClick={() => dispatch({ type: 'toggle' })}
                aria-label={state.paused ? 'Play' : 'Pause'}
              >
                {state.paused ? <Play aria-hidden size={44} /> : <Pause aria-hidden size={44} />}
              </button>
              <button type="button" onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()} onClick={onClose} aria-label="Close Wrapped">
                <X aria-hidden size={48} />
              </button>
            </span>
          </div>
          <div className="w26-paused" data-on={state.paused ? 'true' : 'false'} aria-live="polite">
            {state.paused ? 'PAUSED' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
