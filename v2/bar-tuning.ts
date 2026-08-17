'use client';

import { useSyncExternalStore } from 'react';

/**
 * The top bar's three adjustable numbers, and the store both apps read.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * The owner has been deciding between the blur and the fade for two days. He
 * could not: the only way to switch was a constant in `AppShell.tsx`, so every
 * comparison cost him a deploy and a wait, and the two were never on his own
 * screen minutes apart. On 17 August 2026 he asked for the switch to live in
 * developer settings — "and any other kind of settings you think I'll need to
 * play with on that particular header thing before I decide", then named two:
 * "opacity level, blur level".
 *
 * So this is a THINKING TOOL, not a feature. It exists to end an argument about
 * taste with a decision, and it comes out with the losing treatment.
 *
 * ── IT IS localStorage, DELIBERATELY, AND IT IS NOT A USER SETTING ─────────
 * The panel that writes it is v1 (`components/settings/DeveloperSettings.tsx`,
 * beside the v2 preview toggle, which is where he already goes). The thing that
 * reads it is v2. `localStorage` is the one channel both halves share without
 * either importing the other — the same route the v2 preview cookie and the
 * theme already take.
 *
 * It is scoped to the people who can already see the v2 preview, it changes
 * nothing on the server, and an account that never touches it renders exactly
 * what ships. That is why it is not gated any harder: the worst a stranger who
 * sets it by hand can do is make their own top bar ugly.
 *
 * ── `useSyncExternalStore`, NOT `useState` IN AN EFFECT ────────────────────
 * There is no server answer for a value that lives in the browser, so the
 * server snapshot is the SHIPPED default and the client subscribes. Reading
 * `localStorage` during render would diverge at hydration; setting state in an
 * effect would paint the default first and then jump. This does neither.
 *
 * It listens for `storage` (another tab) AND a same-tab event of its own,
 * because `storage` does not fire in the tab that wrote it — which is the only
 * tab that matters when somebody is dragging a slider.
 */

export const BAR_TUNING_KEY = 'lawexa-v2-bar';
/** Fired in the writing tab, since `storage` only reaches the others. */
export const BAR_TUNING_EVENT = 'lawexa-v2-bar-change';

export type BarTreatment = 'blur' | 'fade' | 'none';

export interface BarTuning {
  treatment: BarTreatment;
  /** Backdrop blur radius in px. Only the blur treatment reads it. */
  blur: number;
  /** How much of the page colour sits over the strip, in percent. */
  tint: number;
}

/**
 * What ships today, and therefore what an untouched account renders.
 *
 * THESE NUMBERS ARE STATED TWICE — here, and as the fallbacks in `shell.css`
 * (`var(--v2-bar-blur, 1.5px)`, `var(--v2-bar-tint, 12%)`). CSS cannot import a
 * TypeScript constant, and nothing checks the two against each other, so if one
 * moves the other must be moved by hand. They are kept identical on purpose:
 * the CSS fallback is what renders before this store has said anything, and a
 * disagreement would show as the bar changing appearance a frame after load.
 */
export const BAR_DEFAULTS: Readonly<Record<BarTreatment, BarTuning>> = {
  blur: { treatment: 'blur', blur: 1.5, tint: 12 },
  fade: { treatment: 'fade', blur: 0, tint: 22 },
  none: { treatment: 'none', blur: 0, tint: 0 },
};

/** The treatment that ships when nobody has chosen. */
export const SHIPPED_TREATMENT: BarTreatment = 'blur';

const SHIPPED: BarTuning = BAR_DEFAULTS[SHIPPED_TREATMENT];

/** Refuses anything it did not write. A hand-edited value must not break a bar. */
function parse(raw: string | null): BarTuning {
  if (!raw) return SHIPPED;
  try {
    const value = JSON.parse(raw) as Partial<BarTuning>;
    const treatment =
      value.treatment === 'blur' ||
      value.treatment === 'fade' ||
      value.treatment === 'none'
        ? value.treatment
        : SHIPPED_TREATMENT;
    const fallback = BAR_DEFAULTS[treatment];
    return {
      treatment,
      blur: clamp(value.blur, 0, 24, fallback.blur),
      tint: clamp(value.tint, 0, 100, fallback.tint),
    };
  } catch {
    return SHIPPED;
  }
}

function clamp(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

/** Cached so `getSnapshot` returns a STABLE reference between reads — a fresh
 *  object every call is the classic infinite loop in `useSyncExternalStore`. */
let cachedRaw: string | null = null;
let cached: BarTuning = SHIPPED;

function getSnapshot(): BarTuning {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(BAR_TUNING_KEY);
  } catch {
    return SHIPPED;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parse(raw);
  }
  return cached;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(BAR_TUNING_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(BAR_TUNING_EVENT, onChange);
  };
}

/** What the bar should look like right now. */
export function useBarTuning(): BarTuning {
  return useSyncExternalStore(subscribe, getSnapshot, () => SHIPPED);
}

/** Read once, outside React — for the panel that edits it. */
export function readBarTuning(): BarTuning {
  if (typeof window === 'undefined') return SHIPPED;
  return getSnapshot();
}

/** Write, and tell this tab as well as the others. */
export function writeBarTuning(next: BarTuning | null): void {
  try {
    if (next === null) window.localStorage.removeItem(BAR_TUNING_KEY);
    else window.localStorage.setItem(BAR_TUNING_KEY, JSON.stringify(next));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(BAR_TUNING_EVENT));
}

/** The custom properties for a tuning, ready to spread onto a style prop. */
export function barTuningStyle(tuning: BarTuning): React.CSSProperties {
  return {
    '--v2-bar-blur': `${tuning.blur}px`,
    '--v2-bar-tint': `${tuning.tint}%`,
  } as React.CSSProperties;
}
