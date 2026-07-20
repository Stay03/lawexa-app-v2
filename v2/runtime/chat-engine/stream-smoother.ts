'use client';

/**
 * v2 chat-engine — streamed-text smoothing layer.
 *
 * WHY THIS EXISTS
 * ---------------
 * The engine's flush loop used to mirror the NETWORK onto the SCREEN: every ~60ms
 * it copied the per-message accumulator (`liveText`) straight into the published
 * value the row reads. So a provider burst painted as a lump and a stall painted
 * nothing — the "stops and starts, speeds up then slows" jerkiness the owner saw.
 *
 * This module is a pure PRESENTATION layer inserted between arrival and display. It
 * does NOT change the engine's authoritative state one bit: `liveText` stays
 * byte-authoritative and timing-authoritative, and every resilience behaviour
 * (watchdog / heartbeat / IDB / history writes) keeps feeding from ARRIVED text.
 * All this layer decides is *how fast the already-arrived characters are revealed*.
 *
 * THE RATE MODEL (a proportional catch-up controller)
 * ---------------------------------------------------
 * Each cursor keeps a display index `shown` into its authoritative `target`. On a
 * fixed publish cadence (~30fps via rAF) it advances toward `target` at a velocity
 *
 *     velocity = max(baseCharsPerSecond, backlog / catchUpTau)        // chars/sec
 *
 * where `backlog = target.length - shown`. The proportional term makes the display
 * approach the target EXPONENTIALLY: with a steady incoming rate R the steady-state
 * display lag is exactly `catchUpTau` SECONDS of text (Little's-law: backlog = R·τ,
 * velocity = R) regardless of R — so a burst is caught up smoothly (velocity rises
 * with backlog) and lag never grows unbounded. The `baseCharsPerSecond` floor keeps
 * a readable minimum pace and drains the final characters without a Zeno crawl.
 * When `backlog` hits 0 the loop simply stops — the display waits, it never invents
 * a pause mid-burst and never rubber-bands (motion is monotone, decelerating).
 *
 * Reference points that shaped the model (researched 2026-07):
 *  - Vercel AI SDK `smoothStream` — buffer + fixed per-chunk delay, word/line/char
 *    chunking, `Intl.Segmenter` for locale-safe boundaries (ai-sdk.dev). We keep its
 *    grapheme-safety and "smooth is a transform between arrival and render" framing,
 *    but replace its FIXED delay (which lets lag grow unbounded on a fast stream)
 *    with a backlog-proportional controller so display lag stays bounded.
 *  - ChatGPT/Claude web render analyses + flowtoken/Upstash write-ups — decouple the
 *    network from an rAF display loop, release characters at a consistent cadence,
 *    buffer outside React (akashbuilds.com, upstash.com/blog/smooth-streaming).
 *
 * GRAPHEME SAFETY
 * ---------------
 * Release is measured in code units for pacing but always CUT on a grapheme-cluster
 * boundary (`Intl.Segmenter`, granularity 'grapheme'), so an emoji ZWJ sequence, a
 * flag, a skin-tone modifier or a combining diacritic is never split across a frame.
 * Segmentation is windowed to the small slice being released, so cost stays O(chars
 * released) — never a per-frame re-scan of the whole message.
 *
 * TERMINAL CORRECTNESS
 * --------------------
 * This layer only ever exposes a PREFIX of `target` (which is a prefix of the final
 * text). It is authoritative for NOTHING. Terminal paths in the engine write the
 * full text onto the structural message and flip `isStreaming:false`; the row then
 * reads `message.content` and stops reading this layer entirely (see
 * AssistantMessageRow: `text = isStreaming ? live : message.content`). `snap()` is
 * used for replayed/`accumulated_text` content so it appears instantly instead of
 * typewriting. Nothing here can lose, truncate, or keep animating content after a
 * stream ends.
 *
 * No React, no engine imports — a self-contained, unit-testable controller.
 */

// ─── Config ──────────────────────────────────────────────────────────────────

/** Tunable smoothing knobs (all optional; sensible defaults below). */
export interface StreamSmoothingConfig {
  /** Master switch. When false the layer mirrors arrival (snap at publish cadence),
   *  i.e. the pre-smoothing behaviour. Default true. */
  enabled?: boolean;
  /** Floor reveal speed in characters/second — the minimum readable pace and the
   *  rate the tail drains at. Default 120. */
  baseCharsPerSecond?: number;
  /** Catch-up time constant in ms. Steady-state display lag ≈ this many ms of text,
   *  independent of the incoming rate. Larger = smoother but laggier. Default 350. */
  catchUpTauMs?: number;
  /** Min ms between publishes while smoothing (the visual frame rate; also bounds
   *  markdown re-parse frequency). Default 33 (~30fps). */
  publishIntervalMs?: number;
  /** dt clamp in ms — caps how much a single late/returning frame may advance, so a
   *  GC hitch or a background-tab return catches up over a few frames instead of one
   *  jump. Default 100. */
  maxFrameMs?: number;
}

/** Fully-resolved config used internally (also exported for the design record). */
export interface ResolvedSmoothingConfig {
  enabled: boolean;
  baseCharsPerSecond: number;
  catchUpTauMs: number;
  publishIntervalMs: number;
  maxFrameMs: number;
  /** Publish cadence used when disabled — the engine passes its `flushIntervalMs`
   *  so "smoothing off" reproduces the prior arrival-mirroring cadence exactly. */
  disabledIntervalMs: number;
}

export const SMOOTHING_DEFAULTS: Omit<ResolvedSmoothingConfig, 'disabledIntervalMs'> = {
  enabled: true,
  baseCharsPerSecond: 120,
  catchUpTauMs: 350,
  publishIntervalMs: 33,
  maxFrameMs: 100,
};

export interface StreamSmootherOptions {
  /** Notify subscribers of `id` that its published value changed (engine wires this
   *  to notifyText / notifyReasoning). */
  onPublish: (id: string) => void;
  /** Batches a group of per-frame publishes (adapter passes React startTransition;
   *  default is a synchronous passthrough). */
  commit: (fn: () => void) => void;
  /** Partial config from the engine's construction config. */
  config: StreamSmoothingConfig | undefined;
  /** The engine's flush cadence, reused as the disabled-mode publish interval. */
  disabledIntervalMs: number;
}

/**
 * The smoothing surface the engine drives. One instance backs one StreamingSource
 * (the engine creates two: answer text and reasoning). `get(id)` returns a value
 * that is referentially STABLE between publishes, satisfying `useSyncExternalStore`.
 */
export interface StreamSmoother {
  /** Feed the latest authoritative full text for `id`; the display advances toward
   *  it over time. Append-only in normal use (the value only grows). */
  setTarget(id: string, fullText: string): void;
  /** Jump the display for `id` straight to `fullText` (no typewriter) — used for
   *  seeds, resets, and `accumulated_text`/reconnect replay. */
  snap(id: string, fullText: string): void;
  /** Current displayed prefix for `id` ('' when unknown). Stable between publishes. */
  get(id: string): string;
  /** Drop `id`'s cursor and notify (so a re-read yields ''). */
  drop(id: string): void;
  /** Drop every cursor and stop the loop (end of turn / disconnect). */
  clear(): void;
  /** Full teardown (engine dispose). */
  dispose(): void;
}

// ─── Grapheme boundary helpers ───────────────────────────────────────────────

const segmenter: Intl.Segmenter | null =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

// A generous upper bound on the code-unit length of a single grapheme cluster
// (long emoji ZWJ sequences). Pads the segmentation window so the cluster straddling
// the release boundary is always fully present in the slice.
const GRAPHEME_WINDOW_PAD = 32;

/**
 * Return the code-unit index reached by releasing ~`stepUnits` code units from
 * `from`, snapped DOWN to a grapheme-cluster boundary — but always advancing by at
 * least one whole grapheme (so a cluster larger than the step is revealed whole
 * rather than stalling). Windowed segmentation ⇒ O(stepUnits), never O(target).
 */
function advanceToGraphemeBoundary(target: string, from: number, stepUnits: number): number {
  if (from >= target.length) return target.length;
  if (!segmenter) return advanceByCodePoints(target, from, stepUnits);

  const windowEnd = Math.min(target.length, from + stepUnits + GRAPHEME_WINDOW_PAD);
  const slice = target.slice(from, windowEnd);
  let consumed = 0;
  let released = 0;
  for (const { segment } of segmenter.segment(slice)) {
    const len = segment.length;
    // Stop before overshooting the step, but always take at least one grapheme.
    if (consumed + len > stepUnits && released > 0) break;
    consumed += len;
    released += 1;
    if (consumed >= stepUnits) break;
  }
  return from + consumed;
}

/** Segmenter-less fallback: advance by whole code points (never splits a surrogate
 *  pair). Loses combining-mark grouping but is only reached on legacy engines. */
function advanceByCodePoints(target: string, from: number, stepUnits: number): number {
  let i = from;
  let count = 0;
  while (i < target.length && count < stepUnits) {
    const cp = target.codePointAt(i);
    const width = cp !== undefined && cp > 0xffff ? 2 : 1;
    i += width;
    count += width;
  }
  return Math.min(i, target.length);
}

// ─── Cursor + controller ─────────────────────────────────────────────────────

interface Cursor {
  /** Authoritative full text (mirrors the engine's liveText for this id). */
  target: string;
  /** Code-unit index up to which text is displayed — always a grapheme boundary. */
  shown: number;
  /** Cached `target.slice(0, shown)` — a stable reference for useSyncExternalStore. */
  published: string;
}

export function createStreamSmoother(opts: StreamSmootherOptions): StreamSmoother {
  const { onPublish, commit, disabledIntervalMs } = opts;
  const cfg: ResolvedSmoothingConfig = {
    enabled: opts.config?.enabled ?? SMOOTHING_DEFAULTS.enabled,
    baseCharsPerSecond: opts.config?.baseCharsPerSecond ?? SMOOTHING_DEFAULTS.baseCharsPerSecond,
    catchUpTauMs: opts.config?.catchUpTauMs ?? SMOOTHING_DEFAULTS.catchUpTauMs,
    publishIntervalMs: opts.config?.publishIntervalMs ?? SMOOTHING_DEFAULTS.publishIntervalMs,
    maxFrameMs: opts.config?.maxFrameMs ?? SMOOTHING_DEFAULTS.maxFrameMs,
    disabledIntervalMs,
  };

  const cursors = new Map<string, Cursor>();
  const useRaf = cfg.enabled && typeof requestAnimationFrame !== 'undefined';
  let rafId: number | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let lastStepAt = 0;

  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  function anyBacklog(): boolean {
    for (const c of cursors.values()) if (c.shown < c.target.length) return true;
    return false;
  }

  function publish(ids: string[]) {
    if (ids.length === 0) return;
    commit(() => {
      for (const id of ids) onPublish(id);
    });
  }

  /** Advance every cursor by `dtSeconds` worth of reveal; publish the ones that
   *  moved. Returns whether any backlog remains (⇒ keep the loop alive). */
  function stepAll(dtSeconds: number): boolean {
    const changed: string[] = [];
    for (const [id, c] of cursors) {
      if (c.shown >= c.target.length) continue;
      const before = c.shown;
      if (cfg.enabled) {
        const backlog = c.target.length - c.shown;
        const velocity = Math.max(cfg.baseCharsPerSecond, backlog / (cfg.catchUpTauMs / 1000));
        const stepUnits = Math.ceil(velocity * dtSeconds);
        c.shown =
          stepUnits >= backlog
            ? c.target.length
            : advanceToGraphemeBoundary(c.target, c.shown, stepUnits);
      } else {
        // Disabled: mirror arrival (reveal everything at the publish cadence).
        c.shown = c.target.length;
      }
      if (c.shown !== before) {
        c.published = c.target.slice(0, c.shown);
        changed.push(id);
      }
    }
    publish(changed);
    return anyBacklog();
  }

  function onFrame(ts: number) {
    rafId = null;
    const elapsed = ts - lastStepAt;
    // Throttle to the publish cadence: rAF fires at the display refresh rate, but we
    // only step every `publishIntervalMs` to bound markdown re-parse frequency.
    if (elapsed < cfg.publishIntervalMs) {
      rafId = requestAnimationFrame(onFrame);
      return;
    }
    const dt = Math.min(elapsed, cfg.maxFrameMs) / 1000;
    lastStepAt = ts;
    if (stepAll(dt)) rafId = requestAnimationFrame(onFrame);
  }

  function onInterval() {
    const t = nowMs();
    const dt = Math.min(t - lastStepAt, cfg.maxFrameMs) / 1000;
    lastStepAt = t;
    if (!stepAll(dt) && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function ensureRunning() {
    if (useRaf) {
      if (rafId !== null) return;
      lastStepAt = nowMs();
      rafId = requestAnimationFrame(onFrame);
    } else {
      if (intervalId !== null) return;
      lastStepAt = nowMs();
      intervalId = setInterval(onInterval, cfg.enabled ? cfg.publishIntervalMs : cfg.disabledIntervalMs);
    }
  }

  function stopRunning() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  return {
    setTarget(id, fullText) {
      let c = cursors.get(id);
      if (!c) {
        c = { target: fullText, shown: 0, published: '' };
        cursors.set(id, c);
      } else {
        c.target = fullText;
        // Defensive: if the authoritative text ever shrank below the display cursor
        // (never happens on the append-only path, but keeps the prefix invariant),
        // clamp and republish so `get` can't return text outside the new target.
        if (c.shown > fullText.length) {
          c.shown = fullText.length;
          c.published = fullText;
          onPublish(id);
        }
      }
      if (c.shown < c.target.length) ensureRunning();
    },

    snap(id, fullText) {
      const c = cursors.get(id);
      if (c) {
        c.target = fullText;
        c.shown = fullText.length;
        c.published = fullText;
      } else {
        cursors.set(id, { target: fullText, shown: fullText.length, published: fullText });
      }
      onPublish(id);
    },

    get(id) {
      return cursors.get(id)?.published ?? '';
    },

    drop(id) {
      if (cursors.delete(id)) onPublish(id);
      if (!anyBacklog()) stopRunning();
    },

    clear() {
      cursors.clear();
      stopRunning();
    },

    dispose() {
      cursors.clear();
      stopRunning();
    },
  };
}
