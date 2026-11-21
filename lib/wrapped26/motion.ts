/**
 * Wrapped 2026's motion (the kit's docs/MOTION_SPEC.md and design/tokens.json),
 * as Web Animations on the slide's own elements. Each slide has one hero
 * moment; everything else is quiet. With reduced motion every animation
 * jumps to its end state, counts show their final value, and haptics still
 * fire (MOTION_SPEC, Reduced motion).
 */

export const EASE_OUT = 'cubic-bezier(.22,1,.36,1)';
export const EASE_IN_OUT = 'cubic-bezier(.65,0,.35,1)';
export const EASE_BACK = 'cubic-bezier(.34,1.56,.64,1)';
export const EASE_SPIN = 'cubic-bezier(.12,.6,.12,1)';

export const MOTION = { push: 560, wipe: 720, spotlight: 1100, stagger: 70, count: 1300, spin: 4200 } as const;

export const RISE: Keyframe[] = [
  { opacity: 0, transform: 'translateY(40px)' },
  { opacity: 1, transform: 'none' },
];
export const FADE: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];
export const SLAM: Keyframe[] = [
  { opacity: 0, transform: 'scale(1.35)' },
  { opacity: 1, transform: 'scale(1)' },
];

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * One slide's animations, started together and stopped together: the player
 * pauses them on a hold and cancels them when the slide leaves.
 */
export class SlideMotion {
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly frames = new Set<number>();
  private stopped = false;

  constructor(readonly reduced: boolean) {}

  /** An animation on `el`, holding its first frame before its delay (`fill: both`). */
  animate(el: Element | null | undefined, keyframes: Keyframe[], options: KeyframeAnimationOptions = {}): Animation | null {
    if (!el || this.stopped) return null;
    if (this.reduced) {
      const end = keyframes[keyframes.length - 1];
      return el.animate([end, end], { duration: 1, fill: 'both' });
    }
    return el.animate(keyframes, { fill: 'both', easing: EASE_OUT, ...options });
  }

  /** The same animation on each element, `gap` ms apart. */
  stagger(els: Iterable<Element>, keyframes: Keyframe[], options: KeyframeAnimationOptions = {}, gap: number = MOTION.stagger) {
    const delay = Number(options.delay ?? 0);
    let i = 0;
    for (const el of els) {
      this.animate(el, keyframes, { duration: 600, ...options, delay: delay + i * gap });
      i += 1;
    }
  }

  /** `run` after `ms` (at once with reduced motion), unless the slide has gone. */
  after(ms: number, run: () => void) {
    if (this.stopped) return;
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (!this.stopped) run();
    }, this.reduced ? 0 : ms);
    this.timers.add(timer);
  }

  /** A number counting up (exponential ease-out), written into `el` as it goes. */
  countUp(el: Element | null | undefined, to: number, duration: number = MOTION.count, format: (n: number) => string = formatCount, from = 0) {
    if (!el || this.stopped) return;
    if (this.reduced) {
      el.textContent = format(to);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      if (this.stopped) return;
      const p = Math.min(1, (now - start) / duration);
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = format(from + (to - from) * eased);
      if (p < 1) this.frames.add(requestAnimationFrame(step));
    };
    this.frames.add(requestAnimationFrame(step));
  }

  /** A light vibration where the phone has one; never fails. */
  haptic(pattern: number | number[]) {
    if (this.stopped) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      // No vibration on this device.
    }
  }

  stop() {
    this.stopped = true;
    for (const timer of this.timers) clearTimeout(timer);
    for (const frame of this.frames) cancelAnimationFrame(frame);
    this.timers.clear();
    this.frames.clear();
  }
}

/** Big numbers, Nigerian grouping: 11,480. */
export function formatCount(n: number): string {
  return Math.round(n).toLocaleString('en-NG');
}
