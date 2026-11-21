'use client';

import { useEffect, useMemo, useRef } from 'react';

import { castFor } from '@/lib/wrapped26/characters';
import { EASE_BACK, EASE_SPIN, FADE, MOTION, SLAM, SlideMotion } from '@/lib/wrapped26/motion';
import type { SlideProps } from './slides';

/**
 * 09b the spin, ending as 09c locked in (BUILD_SPEC §5). The server decided
 * the character before the spin; the wheel is theatre. It holds the track's
 * 14 characters, turns four times plus the offset that stops the person's
 * segment under the pointer over 4.2 s, flicks the pointer on every segment
 * boundary, then locks in: the headline turns gold, the rest dim, a gold
 * ring pulses twice. With reduced motion it shows the locked state at once.
 */

const SIZE = 900;
const R = SIZE / 2;

export function WheelSlide({ record, active, reduced }: SlideProps) {
  const cast = useMemo(() => castFor(record.track), [record.track]);
  const target = Math.max(0, cast.findIndex((character) => character.name === record.character.name));
  const seg = 360 / Math.max(1, cast.length);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!active || !el) return;
    const m = new SlideMotion(reduced);
    const wheel = el.querySelector<SVGSVGElement>('[data-a="wheel"]');
    const pointer = el.querySelector('[data-a="pointer"]');
    const headline = el.querySelector<HTMLElement>('[data-a="headline"]');
    const sub = el.querySelector<HTMLElement>('[data-a="sub"]');
    const ring = el.querySelector('[data-a="ring"]');
    const final = -target * seg + 360 * 4;
    let ticking = !reduced;

    const lockIn = () => {
      ticking = false;
      if (headline) {
        headline.textContent = 'Locked in.';
        headline.style.color = 'var(--w26-gold)';
        m.animate(headline, SLAM, { duration: 450, easing: EASE_BACK });
      }
      el.querySelectorAll('[data-a="seg"]:not([data-win])').forEach((s) => m.animate(s, [{ opacity: 1 }, { opacity: 0.25 }], { duration: 500 }));
      m.animate(ring, [{ boxShadow: '0 0 0 0 rgba(211,175,55,.7)' }, { boxShadow: '0 0 0 60px rgba(211,175,55,0)' }], { duration: 900, iterations: 2, fill: 'none' });
      if (sub) sub.textContent = 'You’ve been cast. Tap to meet your character.';
      m.haptic([30, 50, 30]);
    };

    m.animate(headline, FADE, { duration: 400 });
    if (!wheel) return () => m.stop();
    const spin = reduced
      ? wheel.animate([{ transform: `rotate(${final}deg)` }, { transform: `rotate(${final}deg)` }], { duration: 1, fill: 'forwards' })
      : wheel.animate(
          [
            { transform: 'rotate(0deg)', filter: 'blur(0)' },
            { transform: `rotate(${final * 0.35}deg)`, filter: 'blur(5px)', offset: 0.25 },
            { transform: `rotate(${final}deg)`, filter: 'blur(0)' },
          ],
          { duration: MOTION.spin, easing: EASE_SPIN, fill: 'forwards' },
        );

    // The pointer flicks each time a segment edge passes it, read from the wheel's live angle.
    let last = 0;
    let frame = 0;
    const tick = () => {
      if (!ticking) return;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(wheel).transform);
      const angle = ((Math.atan2(matrix.b, matrix.a) * 180) / Math.PI + 360) % 360;
      const index = Math.floor(((angle + seg / 2) % 360) / seg);
      if (index !== last) {
        last = index;
        pointer?.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-14deg)' }, { transform: 'rotate(0)' }], { duration: 120 });
        m.haptic(4);
      }
      frame = requestAnimationFrame(tick);
    };
    if (ticking) frame = requestAnimationFrame(tick);
    spin.finished.then(lockIn, () => {});

    return () => {
      ticking = false;
      cancelAnimationFrame(frame);
      spin.cancel();
      m.stop();
    };
  }, [active, reduced, seg, target]);

  return (
    <div ref={root} style={{ position: 'absolute', inset: 0 }}>
      <div className="w26-content" style={{ top: 230, alignItems: 'center', textAlign: 'center' }}>
        <div data-a="headline" className="w26-d" style={{ fontSize: 96, letterSpacing: -2 }} aria-live="polite">
          Finding your role…
        </div>
        <div style={{ marginTop: 120, position: 'relative', width: SIZE, height: SIZE }} aria-hidden>
          <svg data-a="wheel" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transformOrigin: '50% 50%' }}>
            {cast.map((character, i) => {
              const a0 = ((i * seg - 90 - seg / 2) * Math.PI) / 180;
              const a1 = (((i + 1) * seg - 90 - seg / 2) * Math.PI) / 180;
              const mid = i * seg - 90;
              const tx = R + R * 0.56 * Math.cos((mid * Math.PI) / 180);
              const ty = R + R * 0.56 * Math.sin((mid * Math.PI) / 180);
              return (
                <g key={character.name} data-a="seg" data-win={i === target ? 'true' : undefined}>
                  <path
                    d={`M${R},${R} L${R + R * Math.cos(a0)},${R + R * Math.sin(a0)} A${R},${R} 0 0 1 ${R + R * Math.cos(a1)},${R + R * Math.sin(a1)} Z`}
                    fill={`var(--w26-${character.accent})`}
                    stroke="var(--w26-ink)"
                    strokeWidth={4}
                  />
                  <text
                    x={tx}
                    y={ty}
                    transform={`rotate(${mid} ${tx} ${ty})`}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontFamily="var(--w26-display)"
                    fontWeight={900}
                    fontSize={character.name.length > 14 ? 23 : 26}
                    fill="var(--w26-ink)"
                  >
                    {character.name}
                  </text>
                </g>
              );
            })}
          </svg>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ position: 'absolute', inset: 0 }}>
            <circle cx={R} cy={R} r={R * 0.17} fill="var(--w26-ink)" stroke="var(--w26-cream)" strokeWidth={6} />
            <text x={R} y={R} textAnchor="middle" dominantBaseline="central" fontFamily="var(--w26-display)" fontWeight={900} fontSize={34} fill="var(--w26-cream)">
              2026
            </text>
          </svg>
          <svg data-a="pointer" width={80} height={96} viewBox="0 0 80 96" style={{ position: 'absolute', left: SIZE / 2 - 40, top: -52, transformOrigin: '40px 10px' }}>
            <path d="M6,6 L74,6 L40,88 Z" fill="var(--w26-cream)" stroke="var(--w26-ink)" strokeWidth={8} strokeLinejoin="round" />
          </svg>
          <div data-a="ring" style={{ position: 'absolute', inset: -14, borderRadius: '50%', border: '8px solid var(--line)' }} />
        </div>
        <p data-a="sub" className="w26-body" style={{ fontSize: 42, marginTop: 'auto', maxWidth: 860 }}>
          Based on everything you did on Lawexa this year.
        </p>
      </div>
    </div>
  );
}
