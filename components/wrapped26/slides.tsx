'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

import type { Wrapped26Character } from '@/lib/wrapped26/characters';
import { EASE_BACK, EASE_IN_OUT, FADE, RISE, SLAM, SlideMotion } from '@/lib/wrapped26/motion';
import type { Wrapped26Record } from '@/lib/wrapped26/types';

/**
 * Wrapped 2026's story slides, 00 to 09d (the kit's screens/01-story-flow and
 * prototype). Every string comes from the record; the layout and the one
 * hero moment per slide come from the kit. The wheel (09b) and the share
 * slide (10) live in their own files.
 */

export interface SlideProps {
  record: Wrapped26Record;
  character: Wrapped26Character | null;
  /** The slide is on screen and settled: its entrance runs. */
  active: boolean;
  reduced: boolean;
}

type Enter = (root: HTMLElement, motion: SlideMotion, record: Wrapped26Record) => void;

/** Runs a slide's entrance once it is active, and stops it when the slide leaves. */
function useEnter<T extends HTMLElement>(enter: Enter, { active, reduced, record }: Pick<SlideProps, 'active' | 'reduced' | 'record'>) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    const motion = new SlideMotion(reduced);
    enter(root, motion, record);
    return () => motion.stop();
  }, [active, enter, reduced, record]);
  return ref;
}

const one = (root: HTMLElement, name: string) => root.querySelector(`[data-a="${name}"]`);
const all = (root: HTMLElement, name: string) => root.querySelectorAll(`[data-a="${name}"]`);

export const accentVar = (character: Wrapped26Character | null) => `var(--w26-${character?.accent ?? 'gold'})`;

function Content({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="w26-content" style={style}>
      {children}
    </div>
  );
}

/** The person as the star: their photo, else their initial, ringed in the character's accent. */
export function Avatar({ record, character, size }: { record: Wrapped26Record; character: Wrapped26Character | null; size: number }) {
  const ring = accentVar(character);
  const width = Math.max(4, size / 45);
  return (
    <div
      className="w26-avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.45,
        border: `${Math.max(6, size / 28)}px solid ${ring}`,
        boxShadow: `0 0 0 ${width}px var(--w26-ink), ${size / 20}px ${size / 20}px 0 ${width}px ${ring}`,
      }}
    >
      {record.user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- the person's own photo URL from the API, any host.
        <img src={record.user.avatarUrl} alt="" />
      ) : (
        record.user.firstName.slice(0, 1).toUpperCase()
      )}
    </div>
  );
}

// ── 00 intro ────────────────────────────────────────────────────────────────

const enterIntro: Enter = (root, m) => {
  m.animate(one(root, 'title'), [{ opacity: 0, transform: 'translateY(60px)', filter: 'blur(12px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 900 });
  m.stagger([one(root, 'sub'), one(root, 'track'), one(root, 'go')].filter((el): el is Element => Boolean(el)), RISE, { delay: 350 }, 120);
  m.animate(one(root, 'go-pulse'), [{ transform: 'scale(1)' }, { transform: 'scale(1.03)' }, { transform: 'scale(1)' }], { duration: 1600, delay: 1400, iterations: Infinity, easing: EASE_IN_OUT });
};

export function IntroSlide(props: SlideProps & { onStart: () => void }) {
  const { record, onStart } = props;
  const ref = useEnter<HTMLDivElement>(enterIntro, props);
  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      <Content style={{ justifyContent: 'center', gap: 64 }}>
        <h1 data-a="title" className="w26-d" style={{ fontSize: 150, lineHeight: 0.92 }}>
          Your 2026, wrapped.
        </h1>
        <p data-a="sub" className="w26-body">
          Hi {record.user.firstName}. We looked back at your year on Lawexa so you don’t have to.
        </p>
        <div data-a="track" style={{ border: '4px solid var(--line)', borderRadius: 8, padding: 40 }}>
          <div className="w26-label">You’re here as</div>
          <div className="w26-d7" style={{ fontSize: 56, marginTop: 8 }}>
            {record.track === 'undergraduates' ? 'a student' : 'a lawyer'}
          </div>
        </div>
        <div data-a="go">
          <div data-a="go-pulse">
            <button
              type="button"
              className="w26-btn"
              style={{ background: 'var(--w26-gold)', color: 'var(--w26-ink)', borderColor: 'var(--w26-ink)' }}
              onPointerUp={(event) => event.stopPropagation()}
              onClick={onStart}
            >
              Start my Wrapped
            </button>
          </div>
        </div>
      </Content>
    </div>
  );
}

// ── 01 cold open ────────────────────────────────────────────────────────────

const enterColdOpen: Enter = (root, m) => {
  m.animate(one(root, 'date'), FADE, { duration: 500 });
  m.stagger(all(root, 'digit'), [{ opacity: 0, transform: 'translateY(-80px) rotateX(90deg)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 200 }, 110);
  m.animate(one(root, 'ampm'), SLAM, { duration: 420, delay: 850, easing: EASE_BACK });
  m.animate(one(root, 'big-date'), RISE, { duration: 800, delay: 200 });
  m.after(850, () => m.haptic(12));
  m.animate(one(root, 'line'), RISE, { duration: 700, delay: 1400 });
};

export function ColdOpenSlide(props: SlideProps) {
  const ref = useEnter<HTMLDivElement>(enterColdOpen, props);
  const open = props.record.coldOpen;
  if (!open) return null;
  const night = open.kind === 'night' && open.time;
  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      <Content style={{ justifyContent: 'center' }}>
        {night ? (
          <>
            <div data-a="date" className="w26-label" style={{ marginBottom: 32 }}>
              {open.date}
            </div>
            <div className="w26-d" style={{ fontSize: 300, whiteSpace: 'nowrap', perspective: 800 }} aria-label={`${open.time} ${open.ampm ?? ''}`}>
              {[...(open.time ?? '')].map((c, i) => (
                <span key={i} data-a="digit" style={{ display: 'inline-block' }} aria-hidden>
                  {c}
                </span>
              ))}
            </div>
            {open.ampm ? (
              <div data-a="ampm" className="w26-d" style={{ fontSize: 160, color: 'var(--w26-coral)' }} aria-hidden>
                {open.ampm}
              </div>
            ) : null}
          </>
        ) : (
          <div data-a="big-date" className="w26-d" style={{ fontSize: 140, lineHeight: 0.95 }}>
            {open.date}
          </div>
        )}
        <p data-a="line" className="w26-body" style={{ marginTop: 72, maxWidth: 820, fontSize: 56 }}>
          {open.line}
        </p>
      </Content>
    </div>
  );
}

// ── 02a guess ───────────────────────────────────────────────────────────────

const enterGuess: Enter = (root, m) => {
  m.animate(one(root, 'q'), RISE, { duration: 700 });
  m.stagger(all(root, 'opt'), [{ opacity: 0, transform: 'translateX(-60px)' }, { opacity: 1, transform: 'none' }], { delay: 300, easing: EASE_BACK }, 110);
  m.animate(one(root, 'hint'), FADE, { delay: 800 });
};

export function GuessSlide(props: SlideProps & { chosen: number | null; onGuess: (option: number) => void }) {
  const { record, chosen, onGuess, reduced } = props;
  const ref = useEnter<HTMLDivElement>(enterGuess, props);
  const guess = record.guess;
  if (!guess) return null;
  const choose = (option: number, el: HTMLElement) => {
    if (chosen !== null) return;
    if (!reduced) el.animate([{ transform: 'scale(1)' }, { transform: 'scale(.96)' }, { transform: 'scale(1.02)' }, { transform: 'scale(1)' }], { duration: 380 });
    onGuess(option);
  };
  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      <Content style={{ justifyContent: 'center', gap: 64 }}>
        <h2 data-a="q" className="w26-d" style={{ fontSize: 96, lineHeight: 1.02, letterSpacing: -2 }}>
          {guess.question}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }} role="group" aria-label="Your guess">
          {guess.options.map((option, i) => (
            <div key={option} data-a="opt">
              <button
                type="button"
                className="w26-option w26-pill"
                aria-pressed={chosen === i}
                style={{
                  background: chosen === i ? 'var(--w26-lilac)' : 'transparent',
                  borderColor: chosen === i ? 'var(--w26-ink)' : undefined,
                  color: chosen === i ? 'var(--w26-ink)' : undefined,
                  opacity: chosen !== null && chosen !== i ? 0.3 : 1,
                  transition: 'opacity .3s, background .2s',
                }}
                onPointerUp={(event) => event.stopPropagation()}
                onClick={(event) => choose(i, event.currentTarget)}
              >
                {option}
              </button>
            </div>
          ))}
        </div>
        <div data-a="hint" className="w26-label">
          Tap your guess
        </div>
      </Content>
    </div>
  );
}

// ── 02b guess reveal ────────────────────────────────────────────────────────

const enterReveal: Enter = (root, m, record) => {
  m.animate(one(root, 'guessed'), FADE, { duration: 400 });
  m.animate(one(root, 'strike'), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 400, delay: 350 });
  const n = one(root, 'n');
  m.animate(n, [{ transform: 'scale(.7)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 500, delay: 300, easing: EASE_BACK });
  m.after(300, () => m.countUp(n, record.guess?.actual ?? 0, 1400));
  m.after(1700, () => m.haptic([8, 40, 14]));
  m.animate(one(root, 'line'), RISE, { duration: 700, delay: 1700 });
};

export function RevealSlide(props: SlideProps & { chosen: number | null }) {
  const { record, chosen } = props;
  const ref = useEnter<HTMLDivElement>(enterReveal, props);
  const guess = record.guess;
  if (!guess) return null;
  const guessed = guess.options[chosen ?? 1] ?? guess.options[0];
  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      <Content style={{ justifyContent: 'center' }}>
        <div data-a="guessed" className="w26-label" style={{ marginBottom: 24 }}>
          You guessed{' '}
          <span style={{ position: 'relative' }}>
            {guessed}
            <i data-a="strike" style={{ position: 'absolute', left: -4, right: -4, top: '52%', height: 4, background: 'var(--w26-coral)', transformOrigin: 'left' }} />
          </span>
        </div>
        <div data-a="n" className="w26-d" style={{ fontSize: 400, color: 'var(--w26-lilac)' }} aria-label={String(guess.actual)}>
          0
        </div>
        <p data-a="line" className="w26-body" style={{ marginTop: 56, maxWidth: 860, fontSize: 56 }}>
          {guess.revealLine}
        </p>
      </Content>
    </div>
  );
}

// ── 03 make it physical ─────────────────────────────────────────────────────

const BOOK_ACCENTS = ['gold', 'lilac', 'coral', 'lime'] as const;

const enterPhysical: Enter = (root, m, record) => {
  m.countUp(one(root, 'n'), record.physical?.pages ?? 0, 1800);
  const books = all(root, 'book');
  const gap = Math.min(140, 1600 / Math.max(1, books.length));
  books.forEach((book, i) =>
    m.animate(book, [{ transform: 'translateY(-900px)', opacity: 0 }, { transform: 'translateY(8px)', opacity: 1, offset: 0.8 }, { transform: 'none', opacity: 1 }], {
      duration: 520,
      delay: 150 + i * gap,
      easing: 'cubic-bezier(.3,0,.5,1)',
    }),
  );
  m.animate(one(root, 'line'), RISE, { duration: 700, delay: 1900 });
};

export function PhysicalSlide(props: SlideProps) {
  const ref = useEnter<HTMLDivElement>(enterPhysical, props);
  const physical = props.record.physical;
  if (!physical) return null;
  const count = Math.max(1, Math.min(40, physical.stackCount));
  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      <Content style={{ flexDirection: 'row', gap: 56, alignItems: 'flex-end', paddingBottom: 40 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div data-a="n" className="w26-d" style={{ fontSize: 180 }} aria-label={String(physical.pages)}>
            0
          </div>
          <p data-a="line" className="w26-body" style={{ marginTop: 40, fontSize: 48 }}>
            {physical.line}
          </p>
        </div>
        <div style={{ width: 110, flex: 'none', display: 'flex', flexDirection: 'column-reverse', gap: 6 }} aria-hidden>
          {Array.from({ length: count }, (_, i) => (
            <div
              key={i}
              data-a="book"
              style={{ height: Math.max(14, Math.floor(520 / count)), marginLeft: (i % 3) * 8, marginRight: ((i + 1) % 3) * 8, background: `var(--w26-${BOOK_ACCENTS[i % 4]})`, border: '4px solid var(--w26-ink)' }}
            />
          ))}
        </div>
      </Content>
    </div>
  );
}

// ── 04 where it began ───────────────────────────────────────────────────────

const enterFirstSearch: Enter = (root, m) => {
  m.animate(one(root, 'card'), [{ transform: 'translateY(-1400px) rotate(18deg)' }, { transform: 'translateY(20px) rotate(-6deg)', offset: 0.75 }, { transform: 'rotate(-4deg)' }], {
    duration: 900,
    easing: 'cubic-bezier(.3,.7,.4,1)',
  });
  m.after(680, () => m.haptic(14));
  m.animate(one(root, 'photo'), [{ filter: 'brightness(4) saturate(0) blur(6px)' }, { filter: 'none' }], { duration: 1600, delay: 700, easing: EASE_IN_OUT });
  m.animate(one(root, 'line'), RISE, { duration: 700, delay: 1900 });
};

export function FirstSearchSlide(props: SlideProps) {
  const ref = useEnter<HTMLDivElement>(enterFirstSearch, props);
  const first = props.record.firstSearch;
  if (!first) return null;
  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      <Content style={{ justifyContent: 'center', alignItems: 'center', gap: 72 }}>
        <div
          data-a="card"
          style={{ transform: 'rotate(-4deg)', background: 'var(--w26-white)', color: 'var(--w26-ink)', border: '4px solid var(--w26-ink)', padding: '40px 40px 56px', width: 780, boxShadow: '16px 16px 0 var(--w26-gold)' }}
        >
          <div data-a="photo" style={{ background: 'var(--w26-ink)', color: 'var(--w26-cream)', padding: '64px 48px', height: 520, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div className="w26-eyebrow" style={{ color: 'var(--w26-gold)' }}>
              First search
            </div>
            <div className="w26-d" style={{ fontSize: 68, lineHeight: 1.02, letterSpacing: -1.5 }}>
              {first.topic}
            </div>
          </div>
          <div className="w26-d7" style={{ fontSize: 40, marginTop: 36 }}>
            {first.date}
          </div>
        </div>
        <p data-a="line" className="w26-body" style={{ textAlign: 'center', maxWidth: 820 }}>
          {first.line}
        </p>
      </Content>
    </div>
  );
}

// ── 05 the obsession ────────────────────────────────────────────────────────

const enterObsession: Enter = (root, m, record) => {
  const n = one(root, 'n');
  m.animate(n, SLAM, { duration: 450, delay: 400, easing: EASE_BACK });
  m.after(500, () => m.countUp(n, record.obsession?.count ?? 0, 900));
  m.animate(one(root, 'times'), FADE, { delay: 900 });
  m.animate(one(root, 'line'), RISE, { duration: 700, delay: 1500 });
};

export function ObsessionSlide(props: SlideProps) {
  const ref = useEnter<HTMLDivElement>(enterObsession, props);
  const obsession = props.record.obsession;
  if (!obsession) return null;
  const topic = obsession.topic;
  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      {topic ? (
        <div style={{ position: 'absolute', top: 300, left: 0, right: 0, overflow: 'hidden' }} aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w26-d w26-marquee"
              style={{
                fontSize: 150,
                whiteSpace: 'nowrap',
                opacity: i === 2 ? 1 : 0.14,
                animation: `${i % 2 ? 'w26-marquee-right' : 'w26-marquee-left'} ${i === 2 ? 9 : 14}s linear infinite`,
              }}
            >
              {`${topic}  `.repeat(6)}
            </div>
          ))}
        </div>
      ) : null}
      <Content style={{ justifyContent: topic ? 'flex-end' : 'center' }}>
        {topic ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 }}>
            <div data-a="n" className="w26-d" style={{ fontSize: 280, color: 'var(--w26-coral)' }} aria-label={`${topic}, ${obsession.count} times`}>
              0
            </div>
            <div data-a="times" className="w26-d7" style={{ fontSize: 60 }} aria-hidden>
              times
            </div>
          </div>
        ) : null}
        <p data-a="line" className={topic ? 'w26-body' : 'w26-d'} style={topic ? { marginTop: 32 } : { fontSize: 104, lineHeight: 1, letterSpacing: -2 }}>
          {obsession.line}
        </p>
      </Content>
    </div>
  );
}

// ── 06 busiest day ──────────────────────────────────────────────────────────

const enterBusiest: Enter = (root, m) => {
  m.animate(one(root, 'month'), RISE, { duration: 600 });
  all(root, 'cell').forEach((cell, i) =>
    m.animate(cell, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: (cell as HTMLElement).dataset.hot ? 1 : 0.5, transform: 'none' }], { duration: 380, delay: 200 + i * 22 }),
  );
  const hot = one(root, 'hot') as HTMLElement | null;
  m.after(1100, () => {
    if (!hot) return;
    hot.dataset.lit = 'true';
    m.haptic(16);
    m.animate(hot, [{ transform: 'scale(1)' }, { transform: 'scale(1.5) rotate(-6deg)' }, { transform: 'scale(1)' }], { duration: 700, easing: EASE_BACK });
  });
  m.animate(one(root, 'line'), RISE, { duration: 700, delay: 1700 });
};

export function BusiestDaySlide(props: SlideProps) {
  const ref = useEnter<HTMLDivElement>(enterBusiest, props);
  const day = props.record.busiestDay;
  if (!day) return null;
  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      <Content style={{ gap: 56, justifyContent: 'center' }}>
        <div data-a="month" className="w26-d" style={{ fontSize: 120 }}>
          {day.month}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 14 }} aria-hidden>
          {Array.from({ length: day.daysInMonth }, (_, i) => {
            const hot = i + 1 === day.day;
            return (
              <div key={i} data-a="cell" data-hot={hot ? 'true' : undefined} style={{ aspectRatio: '1' }}>
                <div data-a={hot ? 'hot' : undefined} className="w26-cell" style={{ height: '100%', border: '3px solid var(--line)', padding: 10, fontWeight: 700, fontSize: 26 }}>
                  {i + 1}
                </div>
              </div>
            );
          })}
        </div>
        <p data-a="line" className="w26-body" style={{ fontSize: 54 }}>
          {day.line}
        </p>
      </Content>
    </div>
  );
}

// ── 07 glow-up ──────────────────────────────────────────────────────────────

const enterGlowUp: Enter = (root, m, record) => {
  m.animate(one(root, 'from'), RISE, { duration: 600 });
  m.animate(one(root, 'path'), [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1500, delay: 400, easing: EASE_IN_OUT });
  m.animate(one(root, 'dot'), [{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 450, delay: 1850, easing: EASE_BACK });
  const n = one(root, 'n');
  const to = record.glowUp?.december;
  if (to !== null && to !== undefined) {
    m.animate(n, SLAM, { duration: 450, delay: 1900, easing: EASE_BACK });
    m.after(1900, () => {
      m.countUp(n, to, 700);
      m.haptic(12);
    });
  }
  m.animate(one(root, 'end'), RISE, { duration: 600, delay: 2500 });
};

/** The polyline's first point, where the start dot sits. */
function firstPoint(points: string): [number, number] {
  const [x, y] = (points.trim().split(/\s+/)[0] ?? '20,520').split(',').map(Number);
  return [Number.isFinite(x) ? x : 20, Number.isFinite(y) ? y : 520];
}

/** The polyline's last point, where the end dot sits. */
function lastPoint(points: string): [number, number] {
  const pairs = points.trim().split(/\s+/);
  const [x, y] = (pairs[pairs.length - 1] ?? '868,60').split(',').map(Number);
  return [Number.isFinite(x) ? x : 868, Number.isFinite(y) ? y : 60];
}

export function GlowUpSlide(props: SlideProps) {
  const ref = useEnter<HTMLDivElement>(enterGlowUp, props);
  const glow = props.record.glowUp;
  if (!glow) return null;
  const [dotX, dotY] = lastPoint(glow.points);
  const [startX, startY] = firstPoint(glow.points);
  const short = (label: string) => label.slice(0, 3).toUpperCase();
  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      <Content style={{ justifyContent: 'space-between' }}>
        <div data-a="from">
          <div className="w26-d" style={{ fontSize: 200 }}>
            {glow.january}
          </div>
          <p className="w26-body" style={{ fontSize: 44, marginTop: 16, maxWidth: 760 }}>
            {glow.line}
          </p>
        </div>
        <svg viewBox="0 0 888 600" width={888} height={600} style={{ overflow: 'visible' }} aria-hidden>
          <polyline
            data-a="path"
            points={glow.points}
            fill="none"
            stroke="var(--w26-lime)"
            strokeWidth={16}
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1}
          />
          <circle cx={startX} cy={startY} r={18} fill="var(--fg)" stroke="var(--bg)" strokeWidth={6} />
          <circle data-a="dot" cx={dotX} cy={dotY} r={30} fill="var(--w26-lime)" stroke="var(--w26-ink)" strokeWidth={6} opacity={0} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
          <text x={20} y={595} fontFamily="var(--w26-body)" fontWeight={700} fontSize={28} fill="currentColor">
            {short(glow.fromLabel)}
          </text>
          <text x={868} y={595} fontFamily="var(--w26-body)" fontWeight={700} fontSize={28} fill="currentColor" textAnchor="end">
            {short(glow.toLabel)}
          </text>
        </svg>
        <div>
          {glow.december !== null ? (
            <div
              data-a="n"
              className="w26-d"
              style={{ fontSize: 240, display: 'inline-block', background: 'var(--w26-lime)', color: 'var(--w26-ink)', padding: '24px 32px 8px', border: '4px solid var(--w26-ink)' }}
              aria-label={String(glow.december)}
            >
              0
            </div>
          ) : null}
          {glow.endLine ? (
            <p data-a="end" className="w26-body" style={{ marginTop: 24 }}>
              {glow.endLine}
            </p>
          ) : null}
        </div>
      </Content>
    </div>
  );
}

// ── 08 among your peers ─────────────────────────────────────────────────────

const enterPeers: Enter = (root, m, record) => {
  const percentile = record.peers?.percentile ?? 100;
  m.after(300, () => m.countUp(one(root, 'n'), percentile, 1500, (n) => String(Math.round(n)), 100));
  Array.from(all(root, 'dot'))
    .slice(0, percentile)
    .forEach((dot, i) =>
      m.after(1500 + i * 120, () => {
        (dot as HTMLElement).dataset.lit = 'true';
        m.animate(dot, [{ transform: 'scale(0)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 400, easing: EASE_BACK });
        m.haptic(6);
      }),
    );
  m.animate(one(root, 'line'), RISE, { duration: 700, delay: 2300 });
};

export function PeersSlide(props: SlideProps) {
  const ref = useEnter<HTMLDivElement>(enterPeers, props);
  const peers = props.record.peers;
  if (!peers) return null;
  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      <Content style={{ justifyContent: 'center', gap: 56 }}>
        <div className="w26-eyebrow" style={{ color: 'var(--muted)' }}>
          Among {peers.group}
        </div>
        <div className="w26-d" style={{ fontSize: 260 }} aria-label={`Top ${peers.percentile}%`}>
          Top <span data-a="n">100</span>%
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 18, width: 640 }} aria-hidden>
          {Array.from({ length: 100 }, (_, i) => (
            <div key={i} data-a="dot" className="w26-dot" />
          ))}
        </div>
        <p data-a="line" className="w26-body" style={{ fontSize: 54 }}>
          {peers.line}
        </p>
      </Content>
    </div>
  );
}

// ── 09a casting call ────────────────────────────────────────────────────────

const enterCasting: Enter = (root, m) => {
  m.animate(one(root, 'eyebrow'), FADE, { duration: 400 });
  m.animate(one(root, 'q'), [{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0 0 0)' }], { duration: 1100, delay: 200, easing: EASE_IN_OUT });
  m.animate(one(root, 'tape'), FADE, { delay: 1300 });
  m.stagger(all(root, 'row'), [{ opacity: 0, transform: 'translateX(80px)' }, { opacity: 1, transform: 'none' }], { delay: 1500, duration: 500 }, 260);
};

export function CastingSlide(props: SlideProps) {
  const ref = useEnter<HTMLDivElement>(enterCasting, props);
  const { casting } = props.record;
  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      <Content style={{ justifyContent: 'center', gap: 56 }}>
        <div data-a="eyebrow" className="w26-eyebrow" style={{ color: 'var(--w26-gold)' }}>
          Casting call
        </div>
        <h2 data-a="q" className="w26-d" style={{ fontSize: 96, lineHeight: 1, letterSpacing: -2 }}>
          {casting.question}
        </h2>
        <p data-a="tape" className="w26-body" style={{ fontSize: 44 }}>
          Your audition tape:
        </p>
        <div style={{ borderBottom: '4px solid var(--line)' }}>
          {casting.audition.map((stat) => (
            <div key={stat.label} data-a="row" style={{ display: 'flex', gap: 28, alignItems: 'baseline', padding: '28px 0', borderTop: '4px solid var(--line)' }}>
              <span className="w26-d" style={{ fontSize: 64, minWidth: 240 }}>
                {stat.value}
              </span>
              <span className="w26-body" style={{ fontSize: 38 }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </Content>
    </div>
  );
}

// ── 09d who you are ─────────────────────────────────────────────────────────

const enterStar: Enter = (root, m) => {
  m.animate(one(root, 'starring'), FADE, { duration: 500, delay: 300 });
  m.animate(one(root, 'avatar'), [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.06)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)', opacity: 1 }], { duration: 900, delay: 500 });
  m.after(900, () => m.haptic([20, 60, 30]));
  m.animate(one(root, 'name'), [{ opacity: 0, letterSpacing: '40px', filter: 'blur(10px)' }, { opacity: 1, letterSpacing: '-3px', filter: 'blur(0)' }], { duration: 1000, delay: 1100 });
  m.animate(one(root, 'as'), RISE, { duration: 700, delay: 1900 });
  m.animate(one(root, 'from'), FADE, { delay: 2300 });
  m.animate(one(root, 'line'), RISE, { duration: 700, delay: 2600 });
  m.animate(one(root, 'credits'), FADE, { duration: 800, delay: 3200 });
};

/** A font size that keeps `text` on one line inside `width` canvas px (the kit's rule of thumb). */
export function fitSize(text: string, width: number, max: number, perChar: number): number {
  return Math.min(max, Math.floor(width / Math.max(1, text.length * perChar)));
}

export function StarSlide(props: SlideProps) {
  const ref = useEnter<HTMLDivElement>(enterStar, props);
  const { record, character } = props;
  const accent = accentVar(character);
  const name = record.character.name;
  const line = character ? (record.track === 'undergraduates' ? character.studentLine : character.line) : null;
  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      <Content style={{ top: 230 }}>
        <div data-a="starring" className="w26-body" style={{ fontSize: 48 }}>
          Starring
        </div>
        <div data-a="avatar" style={{ marginTop: 36 }}>
          <Avatar record={record} character={character} size={520} />
        </div>
        <div data-a="name" className="w26-d" style={{ fontSize: fitSize(record.user.firstName, 888, 230, 0.84), marginTop: 64, whiteSpace: 'nowrap' }}>
          {record.user.firstName}
        </div>
        <div data-a="as" style={{ display: 'flex', alignItems: 'baseline', gap: 22, marginTop: 28 }}>
          <span className="w26-d7" style={{ fontSize: 52, color: accent }}>
            as
          </span>
          <span className="w26-d" style={{ fontSize: fitSize(name, 760, 96, 0.78), letterSpacing: -2, color: accent, whiteSpace: 'nowrap' }}>
            {name}
          </span>
        </div>
        {character ? (
          <div data-a="from" className="w26-billing" style={{ marginTop: 18 }}>
            from <b>{character.show}</b>
          </div>
        ) : null}
        {line ? (
          <p data-a="line" className="w26-body" style={{ marginTop: 44, fontSize: 46 }}>
            {line}
          </p>
        ) : null}
        <div data-a="credits" style={{ marginTop: 'auto', borderTop: '4px solid var(--line)', paddingTop: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="w26-billing">
            Archetype <b>{record.character.archetype}</b>
          </div>
          <div className="w26-billing">
            Rising <b>{record.character.rising}</b>
          </div>
          <div className="w26-label" style={{ marginTop: 8 }}>
            {record.character.evidence}
          </div>
        </div>
      </Content>
    </div>
  );
}
