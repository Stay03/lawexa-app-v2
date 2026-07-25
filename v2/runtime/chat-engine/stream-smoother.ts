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
 * TWO LAYERS, ONE CONTROLLER
 * --------------------------
 * The controller is split into two independent concerns, and keeping them separate
 * is what makes the two streaming styles possible without duplicating any logic:
 *
 *   1. PACING — "how fast may the display advance this frame". The eased,
 *      backlog-proportional rate controller below. Style-independent.
 *   2. LANDING POLICY — "where is the display ALLOWED to come to rest". Pure text
 *      geometry. `flow` may only rest on a WORD boundary; `line` may only rest on
 *      the end of a release unit (a source line / sentence / held table).
 *
 * The pacing layer proposes a character budget; the landing policy spends as much
 * of it as it can without stopping somewhere illegal. Neither layer can violate
 * the module's one hard invariant: the published value is always `target.slice(0,
 * shown)` — a strict PREFIX of the authoritative text.
 *
 * THE RATE MODEL (an eased, backlog-proportional catch-up controller)
 * -------------------------------------------------------------------
 * Each cursor keeps a display index `shown` into its authoritative `target` and a
 * current reveal `velocity`. On a ~60fps rAF cadence it computes a TARGET velocity
 *
 *     targetVelocity = max(baseCharsPerSecond, backlog / catchUpTau)   // chars/sec
 *
 * where `backlog = target.length - shown`, then LOW-PASS filters the actual velocity
 * toward it (`velocity += (targetVelocity - velocity)·(1 - e^(-dt/velTau))`) and
 * advances `shown` by `velocity·dt`. Two effects compose:
 *   1. The proportional target makes display lag settle at exactly `catchUpTau`
 *      SECONDS of text for any steady incoming rate R (Little's-law: backlog = R·τ,
 *      velocity = R) — so lag never grows unbounded.
 *   2. The velocity low-pass is the "butter": when a provider BURST spikes the
 *      backlog, the reveal speed ramps UP smoothly over ~velTau instead of dumping a
 *      word-sized chunk in a single frame, then eases back down as the backlog
 *      drains. Steady state is unchanged, so (1) still holds — the filter only shapes
 *      the transient, turning the old per-frame "steps" into continuous acceleration.
 * The `baseCharsPerSecond` floor keeps a readable minimum pace and drains the tail
 * without a Zeno crawl. When `backlog` hits 0 the loop stops — the display waits, it
 * never invents a pause mid-burst and never rubber-bands (motion is monotone).
 *
 * FRACTIONAL CARRY (correctness fix, 2026-07)
 * -------------------------------------------
 * `velocity · dt` is fractional; characters are not. The previous
 * `Math.max(1, Math.round(velocity · dt))` DISCARDED the sub-character remainder
 * every frame, so the configured rate was never the real rate: at the default
 * 140 cps on a 60Hz panel the per-frame demand is 140/60 = 2.33 chars, which
 * rounded to a flat 2 — an ACTUAL floor rate of 120 cps, 14% below the setting.
 * Worse, `round` AMPLIFIES rAF's dt jitter whenever the demand sits near x.5: a
 * 2.49→2.51 wobble of dt flips the step between 2 and 3, a ±20% swing that reads
 * as deterministic micro-jitter.
 *
 * Both are fixed by integrating the demand into a per-cursor ACCUMULATOR (`carry`)
 * and only ever spending WHOLE characters out of it, keeping the fractional
 * remainder for the next frame:
 *
 *     carry += velocity · dt;  step = floor(carry);  carry -= charactersActuallyTaken
 *
 * At 140 cps / 60Hz the steps become 2,2,3,2,2,3,… — exactly 7 chars per 3 frames
 * = 140 cps, the configured rate to the character. And because the total released
 * is now ∫v·dt rather than a per-frame rounding decision, frame-time noise no
 * longer changes what is released; it is absorbed by the accumulator.
 *
 * PUBLISH THROTTLE — ROUND TO THE NEAREST FRAME (correctness fix, 2026-07)
 * ------------------------------------------------------------------------
 * rAF fires at the display refresh rate; the loop steps only every
 * `publishIntervalMs` so markdown re-parse frequency stays bounded. The old test
 * (`elapsed < publishIntervalMs → skip`) rounds the cadence UP to the next whole
 * frame, which made the cadence WORSE the better the display:
 *
 *      60Hz (16.67ms)  16.67 ≥ 16  → step every frame       → 60 steps/s
 *      90Hz (11.11ms)  11.11 <  16 → step every OTHER frame → 45 steps/s (2× size)
 *     144Hz ( 6.94ms)   6.94 <  16 → step every 3rd frame   → 48 steps/s (3× size)
 *
 * i.e. a 90Hz phone got a COARSER, refresh-dependent cadence than a 60Hz laptop —
 * the exact opposite of the intent. The fix measures the display's frame time from
 * the rAF timestamps and rounds the cadence to the NEAREST frame instead of the
 * next one (threshold = `publishIntervalMs − frameMs/2`):
 *
 *      60Hz  threshold 16 − 8.33 = 7.7  → every frame  → 60 steps/s (UNCHANGED)
 *      90Hz  threshold 16 − 5.56 = 10.4 → every frame  → 90 steps/s
 *     144Hz  threshold 16 − 3.47 = 12.5 → every 2nd    → 72 steps/s
 *
 * The 60Hz publish rate is bit-for-bit what it was; high-refresh displays are never
 * coarser than the 60Hz reference, and their steps are proportionally SMALLER (the
 * step is dt-driven), which is the finer motion those panels exist for. The extra
 * integration frames are near-free: with the word/line landing policies a step only
 * publishes when it actually crosses a boundary, so React work is boundary-driven,
 * not frame-driven.
 *
 * WHY 60fps + eased velocity (the "smooth like butter" second pass): at ~30fps with
 * a raw proportional velocity, a real provider burst made `velocity·dt` land on
 * word-sized-or-bigger jumps (backlog dominated), which read as chunky/word-by-word.
 * Halving the frame time AND ramping velocity instead of stepping it makes each
 * on-screen advance continuous. The cost is markdown re-parse frequency of the
 * streaming row's LAST block; it is bounded by that block's size, by
 * `publishIntervalMs`, and — since the word landing policy landed — by the rate at
 * which whole words complete (~23/s at 140 cps), not the frame rate.
 *
 * Reference points that shaped the model (researched 2026-07):
 *  - Vercel AI SDK `smoothStream` — buffer + fixed per-chunk delay, word/line/char
 *    chunking, `Intl.Segmenter` for locale-safe boundaries (ai-sdk.dev). We keep its
 *    grapheme-safety, its word/line chunking vocabulary, and its "smooth is a
 *    transform between arrival and render" framing, but replace its FIXED delay
 *    (which lets lag grow unbounded on a fast stream) with a backlog-proportional
 *    controller so display lag stays bounded.
 *  - Streamdown's `@streamdown/animate` — per-word release plus a compositor-only
 *    fade supplies the sub-word smoothness that a lower publish rate gives up
 *    (see `rehype-stream-words.ts`, which implements the render half).
 *  - ChatGPT/Claude web render analyses + flowtoken/Upstash write-ups — decouple the
 *    network from an rAF display loop, release at a consistent cadence, buffer
 *    outside React (akashbuilds.com, upstash.com/blog/smooth-streaming).
 *  - lerp/low-pass interpolation as the standard "buttery" motion primitive — easing
 *    a value toward a moving target per frame (kirupa buttery-smooth animations);
 *    applied here to VELOCITY, not position, so catch-up accelerates gradually.
 *  - END-OF-STREAM handling in the field (researched 2026-07, for the drain below):
 *    Vercel's `smoothStream` is a SERVER-side transform (buffer + fixed per-chunk
 *    delay) with no rhythm-preserving flush of the remainder, and flowtoken /
 *    Streamdown expose no completion handling at all — the host app is told to switch
 *    a finished message to a non-animated render, which is exactly the source switch
 *    that produces a terminal pop. The implementations that do NOT pop (e.g. the
 *    Upstash rAF write-up, whose loop runs until `index >= fullText.length`) keep the
 *    display loop authoritative until it has drained, and let "finished" only supply
 *    the final target. That is the model {@link StreamSmoother.finish} implements.
 *
 * GRAPHEME SAFETY
 * ---------------
 * Release is measured in code units for pacing but always CUT on a grapheme-cluster
 * boundary (`Intl.Segmenter`, granularity 'grapheme'), so an emoji ZWJ sequence, a
 * flag, a skin-tone modifier or a combining diacritic is never split across a frame.
 * The word and line policies cut on boundaries reported by the WORD and SENTENCE
 * segmenters, which are themselves grapheme-aligned by construction, and the
 * anti-stall fallback goes through the grapheme cutter — so every landing this
 * module can produce is on a cluster boundary. Segmentation is windowed to the small
 * slice being released, so cost stays O(chars released) — never a per-frame re-scan
 * of the whole message.
 *
 * TERMINAL CORRECTNESS
 * --------------------
 * This layer only ever exposes a PREFIX of `target` (which is a prefix of the final
 * text). It is authoritative for NOTHING. Terminal paths in the engine write the
 * full text onto the structural message and flip `isStreaming:false`; the row can
 * then read `message.content` and stop reading this layer entirely. `snap()` is used
 * for replayed/`accumulated_text` content so it appears instantly instead of
 * typewriting. Nothing here can lose, truncate, or keep animating content after a
 * stream ends — including in `line` style, whose deliberate holds are all released
 * by the same `snap()` the terminal paths already call.
 *
 * THE TERMINAL DRAIN — `finish()` (2026-07)
 * -----------------------------------------
 * The rate model runs a DELIBERATE display lag: steady state is `catchUpTau` seconds
 * of text (Little's law), i.e. ≈56 characters — about ten words — at the default
 * 350ms and a ~160 char/s stream. That lag is the entire point while text is
 * arriving, but it has to go somewhere when the stream ends. It used to go nowhere:
 * `text_done` wrote the full text onto the structural message and flipped
 * `isStreaming:false`, the row switched source in that same commit, and the
 * undrained tail appeared in ONE frame. Butter, butter, butter, POP — on every single
 * answer. `snap()` on that path was cosmetically a no-op, because the row had already
 * stopped reading the smoothed value.
 *
 * `finish(id, fullText)` replaces that snap with a BOUNDED DRAIN: the cursor keeps
 * revealing at the ordinary rhythm until the display reaches the end of the text.
 *
 *  - RATE. The deadline is `min(maxDrainMs, backlog / baseCharsPerSecond)`, so a tail
 *    that CAN drain at the floor pace does exactly that (56 chars at 140 c/s = 400ms)
 *    and a larger tail is compressed into `maxDrainMs` instead of extending the
 *    answer. On top of the normal controller each step spends
 *    `max(velocity, backlog / timeLeft)`; that second term alone integrates to a
 *    CONSTANT-rate landing which reaches the end exactly at the deadline, so the
 *    drain can never Zeno-crawl — and because it is a `max`, the drain is never
 *    SLOWER than the rhythm the answer was already being revealed at (a fast stream
 *    keeps its speed and eases down naturally as the backlog shrinks).
 *  - GEOMETRY. During a drain the target is FINAL, so `target.length` becomes a legal
 *    landing: the word policy may rest on the last word (it can no longer grow), the
 *    `line` policy treats end-of-text as end-of-unit, and a table header whose
 *    delimiter never arrived stops being held. Without this the last word or line
 *    would be held back by rules that exist only to protect STILL-ARRIVING text.
 *  - BOUND. `now >= drainUntil` lands the full text unconditionally, so a drain
 *    terminates within `maxDrainMs` whatever the landing policy thinks.
 *
 * WHAT MAKES THE DRAIN SAFE (the part that matters)
 * -------------------------------------------------
 * The structural message already carries the FULL authoritative text for the whole
 * duration of the drain — `finish()` is only ever called by a terminal path that has
 * already written it. The drain is therefore never the only copy of anything: the row
 * prefers this layer's value only while it IS a strict prefix of `message.content`,
 * and falls back to `message.content` the instant this layer stops offering one.
 * Every way a drain can end — landing, `snap()`, `abandonDrains()`, `drop()`,
 * `clear()`, `dispose()`, smoothing switched off, the deadline — ends with the full
 * text on screen. The worst failure mode this feature has is the OLD POP. It cannot
 * be text loss.
 *
 * `drop()` and `clear()` DEFER for a draining cursor (they mark it and let it land)
 * rather than removing it, because the engine's `completed` terminal fires within
 * milliseconds of `text_done` and would otherwise cut every drain off at its first
 * frame. A deferred cursor holds its OWN copy of the final text, so it depends on
 * nothing the engine has already torn down; it is bounded by the same deadline; it
 * notifies only its own id; and it deletes itself the moment it lands.
 * {@link StreamSmoother.abandonDrains} is the immediate override — Stop must never be
 * made to wait for a drain.
 *
 * No React, no engine imports — a self-contained, unit-testable controller.
 */

// ─── Config ──────────────────────────────────────────────────────────────────

/**
 * How streamed text is released to the screen.
 *
 *  - `flow` (default) — the continuous reveal: whole WORDS are released as the rate
 *    controller pays for them, and the render layer fades each new word in. Reads as
 *    one moving body of text.
 *  - `line`  — one reader-sized unit at a time (a source line, a sentence, or a held
 *    table), with a skeleton bar standing in for the unit still arriving. Reads as a
 *    document being written line by line.
 */
export type StreamStyle = 'flow' | 'line';

/** Tunable smoothing knobs (all optional; sensible defaults below). */
export interface StreamSmoothingConfig {
  /** Master switch. When false the layer mirrors arrival (snap at publish cadence),
   *  i.e. the pre-smoothing behaviour. Default true. */
  enabled?: boolean;
  /** Release style — see {@link StreamStyle}. Default `'flow'`. */
  style?: StreamStyle;
  /** Floor reveal speed in characters/second — the minimum readable pace and the
   *  rate the tail drains at. Default 140. */
  baseCharsPerSecond?: number;
  /** Catch-up time constant in ms. Steady-state display lag ≈ this many ms of text,
   *  independent of the incoming rate. Larger = smoother but laggier. Default 350. */
  catchUpTauMs?: number;
  /** VELOCITY smoothing time constant in ms — how gradually the reveal speed itself
   *  ramps toward its target when a burst arrives (a low-pass on velocity). This is
   *  the "butter" lever: it spreads a burst's catch-up over a smooth acceleration
   *  instead of a single word-sized step. Larger = smoother accel, slower to react.
   *  Default 140. */
  velocitySmoothingMs?: number;
  /** Min ms between publishes while smoothing (the visual frame rate; also bounds
   *  markdown re-parse frequency). Default 16 (~60fps) for continuous motion. */
  publishIntervalMs?: number;
  /** dt clamp in ms — caps how much a single late/returning frame may advance, so a
   *  GC hitch or a background-tab return catches up over a few frames instead of one
   *  jump. Default 100. */
  maxFrameMs?: number;
  /** Hard bound in ms on the TERMINAL DRAIN — how long the last, already-arrived tail
   *  may keep revealing after a stream ends (see the drain note in the module doc).
   *  A tail that can drain at `baseCharsPerSecond` inside this window does exactly
   *  that; a larger one is compressed to fit. `0` turns the drain off entirely, so
   *  `finish()` is a plain `snap()` — the pre-drain behaviour, with one knob.
   *  Default 400. */
  maxDrainMs?: number;
}

/** Fully-resolved config used internally (also exported for the design record). */
export interface ResolvedSmoothingConfig {
  enabled: boolean;
  style: StreamStyle;
  baseCharsPerSecond: number;
  catchUpTauMs: number;
  velocitySmoothingMs: number;
  publishIntervalMs: number;
  maxFrameMs: number;
  maxDrainMs: number;
  /** Publish cadence used when disabled — the engine passes its `flushIntervalMs`
   *  so "smoothing off" reproduces the prior arrival-mirroring cadence exactly. */
  disabledIntervalMs: number;
}

export const SMOOTHING_DEFAULTS: Omit<ResolvedSmoothingConfig, 'disabledIntervalMs'> = {
  enabled: true,
  style: 'flow',
  baseCharsPerSecond: 140,
  catchUpTauMs: 350,
  velocitySmoothingMs: 140,
  publishIntervalMs: 16,
  maxFrameMs: 100,
  maxDrainMs: 400,
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
   *  seeds, resets, and `accumulated_text`/reconnect replay. Also the unconditional
   *  ABANDON for a drain in flight: it always ends with the full text shown. */
  snap(id: string, fullText: string): void;
  /**
   * "The text is final — land it at the normal reveal rhythm instead of snapping."
   * The graceful end of a stream (`text_done`) calls this where it used to call
   * {@link snap}, which is what turns the terminal POP into a smooth landing. See the
   * TERMINAL DRAIN note in the module doc.
   *
   * Bounded by `maxDrainMs` and abandoned by every other terminal. Degrades to an
   * exact `snap()` whenever a drain would be wrong or pointless: smoothing disabled,
   * `maxDrainMs: 0`, no cursor, nothing left to reveal, an already-dropped cursor, or
   * a `fullText` the display is somehow not a prefix of.
   */
  finish(id: string, fullText: string): void;
  /**
   * Land every in-flight drain IMMEDIATELY (full text, no further animation). The
   * engine calls this when the user presses Stop: a cancel must feel instant, and a
   * drain is the one thing in this layer that could otherwise make it wait. Safe to
   * call at any time — it only ever moves a display cursor FORWARD, and it is a
   * no-op when nothing is draining.
   */
  abandonDrains(): void;
  /** Current displayed prefix for `id` ('' when unknown). Stable between publishes. */
  get(id: string): string;
  /** Drop `id`'s cursor and notify (so a re-read yields ''). DEFERRED while that
   *  cursor is draining — see the drain note in the module doc. */
  drop(id: string): void;
  /** Drop every cursor and stop the loop (end of turn / disconnect). Draining
   *  cursors are deferred, exactly as in {@link drop}. */
  clear(): void;
  /**
   * Re-resolve the tunables on a LIVE smoother (the streaming-style setting is a
   * user preference, so it must take effect without rebuilding the engine). Cursor
   * state is untouched: `shown` never moves backwards, so the published value stays
   * a prefix across the switch. A no-op when nothing actually changed.
   */
  setConfig(config: StreamSmoothingConfig | undefined): void;
  /** Full teardown (engine dispose). */
  dispose(): void;
}

// ─── Segmentation helpers ────────────────────────────────────────────────────

const hasSegmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl;

const graphemeSegmenter: Intl.Segmenter | null = hasSegmenter
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null;

/** Locale-aware WORD boundaries — the `flow` landing policy. Handles scripts that
 *  do not delimit words with spaces (CJK), which a whitespace split cannot. */
const wordSegmenter: Intl.Segmenter | null = hasSegmenter
  ? new Intl.Segmenter(undefined, { granularity: 'word' })
  : null;

/** Locale-aware SENTENCE boundaries — one half of the `line` release unit. */
const sentenceSegmenter: Intl.Segmenter | null = hasSegmenter
  ? new Intl.Segmenter(undefined, { granularity: 'sentence' })
  : null;

// A generous upper bound on the code-unit length of a single grapheme cluster
// (long emoji ZWJ sequences). Pads the segmentation window so the cluster straddling
// the release boundary is always fully present in the slice.
const GRAPHEME_WINDOW_PAD = 32;

/** Pad for the WORD window — long enough that the word straddling the budget edge is
 *  always fully inside the slice, so its boundary can be trusted. */
const WORD_WINDOW_PAD = 64;

/**
 * Return the code-unit index reached by releasing ~`stepUnits` code units from
 * `from`, snapped DOWN to a grapheme-cluster boundary — but always advancing by at
 * least one whole grapheme (so a cluster larger than the step is revealed whole
 * rather than stalling). Windowed segmentation ⇒ O(stepUnits), never O(target).
 */
function advanceToGraphemeBoundary(target: string, from: number, stepUnits: number): number {
  if (from >= target.length) return target.length;
  if (!graphemeSegmenter) return advanceByCodePoints(target, from, stepUnits);

  const windowEnd = Math.min(target.length, from + stepUnits + GRAPHEME_WINDOW_PAD);
  const slice = target.slice(from, windowEnd);
  let consumed = 0;
  let released = 0;
  for (const { segment } of graphemeSegmenter.segment(slice)) {
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

/**
 * The `flow` LANDING POLICY: the furthest index ≤ `from + stepUnits` at which the
 * display may come to rest without showing a PARTIAL WORD — or `from` when the
 * budget cannot reach any complete word boundary yet.
 *
 * A boundary is only trusted when there is more authoritative text AFTER it: a
 * segment that ends at `target.length` may still be growing (the next delta could
 * extend the word), and a segment that ends at the window edge may have been cut by
 * the window. Both are rejected, which is exactly the property that stops a
 * half-drawn word from painting and then re-wrapping onto the next line.
 *
 * `final` (a cursor draining after the stream ended) lifts exactly the first of
 * those two rejections and nothing else: the text CANNOT grow any more, so the last
 * word is complete and `target.length` is a legal place to rest. The window-edge
 * rejection still stands — a cut window is untrustworthy whatever the stream is
 * doing. Without this the drain would hold the final word back for `WORD_STALL_MS`.
 */
function advanceToWordBoundary(
  target: string,
  from: number,
  stepUnits: number,
  final: boolean,
): number {
  if (from >= target.length || stepUnits < 1) return from;
  const windowEnd = Math.min(target.length, from + stepUnits + WORD_WINDOW_PAD);
  const slice = target.slice(from, windowEnd);

  if (!wordSegmenter) {
    // Segmenter-less fallback: land at the start of the next word, i.e. just after a
    // whitespace run that is fully present and fully affordable. When `final`, the
    // end of the text is itself a legal landing (nothing can extend it).
    let best = from;
    let i = 0;
    while (i < slice.length) {
      if (!isSpace(slice[i])) {
        i += 1;
        continue;
      }
      let j = i + 1;
      while (j < slice.length && isSpace(slice[j])) j += 1;
      if (j >= slice.length || j > stepUnits) break;
      best = from + j;
      i = j;
    }
    if (final && windowEnd === target.length && slice.length <= stepUnits) best = target.length;
    return best;
  }

  let best = from;
  for (const { index, segment, isWordLike } of wordSegmenter.segment(slice)) {
    const end = index + segment.length;
    if (end > stepUnits) break; // beyond this frame's budget
    if (from + end >= windowEnd) {
      // The segment reaches the edge of the slice. If the edge is the window's, it
      // may have been cut — never a boundary. If it is the end of the AUTHORITATIVE
      // text it may still be growing, so it is a boundary only when it is not
      // word-like: trailing whitespace/punctuation cannot re-wrap, and allowing it
      // lets a caught-up cursor actually reach the end and let the loop stop. On a
      // FINAL target nothing can grow, so the last word is a boundary too.
      if (windowEnd === target.length && (final || isWordLike === false)) best = from + end;
      break;
    }
    best = from + end;
  }
  return best;
}

function isSpace(ch: string): boolean {
  return ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r' || ch === '\f' || ch === '\v';
}

// ─── `line` style — release-unit geometry ────────────────────────────────────

/**
 * The reader-sized cap on a single `line` release unit. A run-on paragraph with no
 * newline and no sentence terminator would otherwise be held whole; this releases it
 * in ~one-line pieces instead, cut on a word boundary.
 */
const LINE_UNIT_MAX_CHARS = 120;

/** A COMPLETED unit is never held longer than this, whatever the rate controller
 *  says — the floor that keeps `line` style feeling responsive on a slow stream. */
const LINE_MAX_HOLD_MS = 350;

/**
 * Ceiling on how many release UNITS may land in one frame, so a burst can never
 * dump a wall of lines in a single paint.
 *
 * HONEST LIMIT: this bounds the unit COUNT, not the unit SIZE, and two units are
 * unbounded in size — a fenced-code line (one logical line of minified JS can be
 * thousands of characters) and a table's header+delimiter pair. Both are single
 * logical lines that would be worse to split, and the {@link LINE_MAX_HOLD_MS} floor
 * can release either regardless of budget, so a large one can still land in one
 * frame. Everything else is bounded by {@link LINE_UNIT_MAX_CHARS}.
 */
const LINE_MAX_UNITS_PER_STEP = 2;

/** `flow` anti-stall: if no complete word boundary has been reachable for this long
 *  (a pathological unbroken token, or a stream that stopped mid-word), fall back to
 *  grapheme pacing so the display can always drain and the loop can always stop. */
const WORD_STALL_MS = 400;

/**
 * `line` anti-stall. `lineUnitEnd` can legitimately answer "nothing releasable yet",
 * and if the provider then stops mid-unit the answer would sit behind the skeleton
 * forever. This releases through the WORD policy after the stream has gone quiet.
 *
 * THE GATE IS LOAD-BEARING: it fires only when NEITHER an advance NOR new
 * AUTHORITATIVE TEXT has happened for this long. Gating on "no advance" alone would
 * fire in the middle of an actively-streaming table and destroy the deliberate hold
 * that the table policy exists for. Ordered between {@link LINE_MAX_HOLD_MS} (which
 * only relaxes the BUDGET, never the "unit incomplete" answer) and
 * {@link PARK_AFTER_MS}, so a genuinely stalled cursor escapes before it parks.
 */
const LINE_STALL_MS = 500;

/** Upper bound on banked (unspent) release budget, so a long hold can never be
 *  followed by a single-frame dump of everything it banked. */
const MAX_CARRY_UNITS = 160;

/**
 * How long a cursor may sit unable to advance before it is PARKED (excluded from
 * the "keep the loop alive" test until new text arrives).
 *
 * `line` style holds deliberately — a unit that has not finished arriving is not
 * shown, and the skeleton stands in for it. If the provider then pauses mid-line
 * (a tool call between text deltas), that hold is correct but it would otherwise
 * keep an rAF loop spinning for the whole pause with nothing to do. Parking stops
 * the loop with ZERO content compromise: nothing is revealed that the policy would
 * not reveal, and `setTarget` un-parks and re-arms the moment a delta lands. It is
 * well past {@link LINE_MAX_HOLD_MS}, so a cursor that merely cannot AFFORD a
 * completed unit is always released by the floor long before it could park.
 */
const PARK_AFTER_MS = 600;

/** A GFM table delimiter row (`|---|:--:|`). Requires at least one dash AND one pipe
 *  so an ordinary prose line can never be mistaken for one. */
function isTableDelimiter(line: string): boolean {
  return /^[\s|:-]+$/.test(line) && line.includes('-') && line.includes('|');
}

/** A partial line that could still GROW into a delimiter row. */
function couldBecomeTableDelimiter(line: string): boolean {
  return /^[\s|:-]*$/.test(line);
}

/**
 * TABLE POLICY — the HEADER PAIR is the unit, not the whole table.
 *
 * A partially-revealed GFM table is the worst case for incremental markdown: a header
 * row on its own renders as literal `| A | B |` and then re-lays out completely the
 * moment the delimiter row lands. **The delimiter row is what fixes the layout** —
 * once remark-gfm has both lines it renders a real table, and each further body row
 * simply appends a `<tr>`. So the release unit here is exactly `header + delimiter`,
 * held together; body rows then flow through the ordinary one-line-at-a-time policy
 * (a body row's successor is never a delimiter, so this function declines them).
 *
 * That choice fixes three things at once versus holding the whole table:
 *  - a message that ENDS with a table (very common for us) no longer holds 10s+ of
 *    content behind a pulsing bar waiting for a terminating line that never comes;
 *  - the maximum unit size drops from "the entire table" to two lines, so the
 *    {@link LINE_MAX_HOLD_MS} floor can no longer dump thousands of characters; and
 *  - the cost drops from an O(rows) body walk on every call (≤2×/frame, re-armed by
 *    every delta — quadratic over a long table) to a fixed handful of `indexOf`s.
 *
 * Returns `undefined` when `from` is not a table header (caller continues with the
 * normal line/sentence policy), `null` when a header row is present but its delimiter
 * has not finished arriving (hold — a short, bounded wait), or the exclusive end
 * index of the complete header+delimiter pair.
 */
function tableUnitEnd(target: string, from: number): number | null | undefined {
  const firstNl = target.indexOf('\n', from);

  // The candidate header must actually look like a table header: it must contain a
  // pipe AND be shorter than the reader cap. Without the length bound, an ordinary
  // run-on paragraph that happens to contain one `|` was held whole — bypassing both
  // the cap and the hold floor — for as long as it took to arrive.
  const headerEnd = firstNl === -1 ? target.length : firstNl;
  if (headerEnd - from >= LINE_UNIT_MAX_CHARS) return undefined;
  if (target.lastIndexOf('|', headerEnd) < from) return undefined;

  // Header still arriving: hold briefly, since it may yet turn out to be a table.
  if (firstNl === -1) return null;

  const secondNl = target.indexOf('\n', firstNl + 1);
  const delimiter = target.slice(firstNl + 1, secondNl === -1 ? target.length : secondNl);
  // Delimiter row still arriving: hold only while what has arrived is still a
  // plausible prefix of one. (A list item — `- item` — is such a prefix for its first
  // two characters, so it can hold for a frame or two; that is ~16-33ms, invisible,
  // and the alternative is flashing raw pipes on every real table.)
  if (secondNl === -1) return couldBecomeTableDelimiter(delimiter) ? null : undefined;
  if (!isTableDelimiter(delimiter)) return undefined;

  return secondNl + 1;
}

/**
 * The FIRST complete sentence boundary in `[from, limit)`, or null. A segment that
 * reaches `limit` is rejected: it was either cut by the cap or is the still-growing
 * tail of the stream, and neither is a boundary we may rest on.
 */
function sentenceEndWithin(target: string, from: number, limit: number): number | null {
  if (!sentenceSegmenter || limit <= from) return null;
  for (const { index, segment } of sentenceSegmenter.segment(target.slice(from, limit))) {
    const end = from + index + segment.length;
    return end < limit ? end : null;
  }
  return null;
}

// ─── Cursor + controller ─────────────────────────────────────────────────────

interface Cursor {
  /** Authoritative full text (mirrors the engine's liveText for this id). */
  target: string;
  /** Code-unit index up to which text is displayed — always a grapheme boundary. */
  shown: number;
  /** Cached `target.slice(0, shown)` — a stable reference for useSyncExternalStore. */
  published: string;
  /** Current reveal velocity in code units/second — low-pass filtered so it ramps
   *  smoothly toward its backlog-driven target rather than stepping. */
  velocity: number;
  /** Fractional release budget carried across frames (see the FRACTIONAL CARRY note
   *  in the module doc). Always in [0, MAX_CARRY_UNITS]. */
  carry: number;
  /** Timestamp of the last actual advance — powers the `line` hold floor, the
   *  `flow` anti-stall fallback, and parking. */
  lastAdvanceAt: number;
  /** Timestamp of the last time AUTHORITATIVE text actually grew. Distinct from
   *  `lastAdvanceAt` on purpose: `line` style holds deliberately while a unit is
   *  still arriving, so "the display has not moved" must never be mistaken for "the
   *  stream has stopped" — only this separates an in-flight table from a dead one. */
  lastTargetGrowthAt: number;
  /** True when the cursor has been unable to advance for {@link PARK_AFTER_MS} and
   *  only new authoritative text can change that — see the constant's note. */
  parked: boolean;
  /** True while this cursor is DRAINING a finished stream's tail: `target` is final,
   *  the landing policy may rest on `target.length`, and the loop must not park. */
  finishing: boolean;
  /** Wall-clock ms after which a drain lands unconditionally (0 = not draining). */
  drainUntil: number;
  /** The engine asked for this cursor to go away while it was draining. Honoured the
   *  moment the drain lands — see the drain note in the module doc. */
  pendingDrop: boolean;
  /** Index (always at a line start, never beyond `shown`) up to which fenced-code
   *  state has been computed, plus that state. Incremental, so fence tracking costs
   *  O(total chars) across the whole stream rather than O(n) per frame. */
  fenceScan: number;
  fenceOpen: boolean;
  fenceChar: string;
}

function newCursor(target: string, shown: number, velocity: number, now: number): Cursor {
  return {
    target,
    shown,
    published: target.slice(0, shown),
    velocity,
    carry: 0,
    lastAdvanceAt: now,
    lastTargetGrowthAt: now,
    parked: false,
    finishing: false,
    drainUntil: 0,
    pendingDrop: false,
    fenceScan: 0,
    fenceOpen: false,
    fenceChar: '',
  };
}

/** Advance the incremental fenced-code state to cover every COMPLETE line before
 *  `upto`. `upto` is only ever a position the cursor has committed to. */
function syncFenceState(c: Cursor, upto: number): void {
  while (c.fenceScan < upto) {
    const nl = c.target.indexOf('\n', c.fenceScan);
    if (nl === -1 || nl >= upto) break;
    const marker = /^\s*(?:```+|~~~+)/.exec(c.target.slice(c.fenceScan, nl));
    if (marker) {
      const ch = marker[0].trim()[0];
      if (!c.fenceOpen) {
        c.fenceOpen = true;
        c.fenceChar = ch;
      } else if (ch === c.fenceChar) {
        c.fenceOpen = false;
        c.fenceChar = '';
      }
    }
    c.fenceScan = nl + 1;
  }
}

/**
 * The `line` LANDING POLICY: the exclusive end of the next complete release unit
 * starting at `from`, or `null` when that unit has not finished arriving (the caller
 * holds, and the transcript's skeleton bar stands in for it).
 *
 * Unit, in priority order:
 *   0. a table's HEADER+DELIMITER pair (see {@link tableUnitEnd}); body rows fall
 *      through to rule 1 and release one at a time;
 *   1. the next `\n` — one source line. Inside a fenced code block this is the ONLY
 *      boundary, so code appears line by line like a terminal, however long the line;
 *   2. the next SENTENCE boundary inside an over-long line;
 *   3. a cut at ~{@link LINE_UNIT_MAX_CHARS} for a run-on paragraph — on a word
 *      boundary when one exists, else on a GRAPHEME boundary. The grapheme fallback
 *      is what keeps a base64 blob, a long URL or a hash from freezing the answer:
 *      those contain no word boundary for hundreds of characters, and without it this
 *      returned `null` while text kept arriving (so the hold floor, which only
 *      relaxes the budget, could never release it and parking could never stop the
 *      loop). It is pure geometry, so unlike a timer it can never fire inside a table
 *      or a fence — rule 3 is only reached outside both.
 *
 * Headings, list items and blockquotes are one source line each, so rule 1 already
 * releases them exactly as authored — `line` style's best case.
 *
 * `final` (a cursor draining after the stream ended) turns every "still arriving —
 * hold" answer into "this IS the unit": end-of-text becomes end-of-line, an unclosed
 * fence ends at the text, and a table header whose delimiter never came stops being
 * held. Each of those holds exists solely to wait for text that is now never coming,
 * so on a final target the function always returns a real unit — which is what lets
 * a `line`-style answer land line by line instead of dumping its tail.
 */
function lineUnitEnd(c: Cursor, from: number, final: boolean): number | null {
  const t = c.target;
  if (from >= t.length) return null;
  syncFenceState(c, from);

  if (!c.fenceOpen) {
    const table = tableUnitEnd(t, from);
    // `null` = "the header pair has not finished arriving". On a FINAL target that
    // wait can never resolve, so fall through to the ordinary line rules instead.
    if (table !== undefined && !(final && table === null)) return table;
  }

  const nl = t.indexOf('\n', from);
  if (nl !== -1 && (c.fenceOpen || nl - from <= LINE_UNIT_MAX_CHARS)) return nl + 1;
  if (c.fenceOpen) return final ? t.length : null; // still arriving — hold it whole

  const lineLimit = nl === -1 ? t.length : nl;
  const sentence = sentenceEndWithin(t, from, Math.min(lineLimit, from + LINE_UNIT_MAX_CHARS));
  if (sentence !== null) return sentence;

  if (lineLimit - from > LINE_UNIT_MAX_CHARS) {
    const word = advanceToWordBoundary(t, from, LINE_UNIT_MAX_CHARS, final);
    if (word > from) return word;
    const grapheme = advanceToGraphemeBoundary(t, from, LINE_UNIT_MAX_CHARS);
    if (grapheme > from) return grapheme;
  }
  // Reachable on a final target only as the last, short line (the over-cap cases all
  // returned above), so this is the end of the text — always a grapheme boundary.
  return final ? t.length : null;
}

export function createStreamSmoother(opts: StreamSmootherOptions): StreamSmoother {
  const { onPublish, commit, disabledIntervalMs } = opts;

  function resolveConfig(partial: StreamSmoothingConfig | undefined): ResolvedSmoothingConfig {
    return {
      enabled: partial?.enabled ?? SMOOTHING_DEFAULTS.enabled,
      style: partial?.style ?? SMOOTHING_DEFAULTS.style,
      baseCharsPerSecond: partial?.baseCharsPerSecond ?? SMOOTHING_DEFAULTS.baseCharsPerSecond,
      catchUpTauMs: partial?.catchUpTauMs ?? SMOOTHING_DEFAULTS.catchUpTauMs,
      velocitySmoothingMs: partial?.velocitySmoothingMs ?? SMOOTHING_DEFAULTS.velocitySmoothingMs,
      publishIntervalMs: partial?.publishIntervalMs ?? SMOOTHING_DEFAULTS.publishIntervalMs,
      maxFrameMs: partial?.maxFrameMs ?? SMOOTHING_DEFAULTS.maxFrameMs,
      maxDrainMs: partial?.maxDrainMs ?? SMOOTHING_DEFAULTS.maxDrainMs,
      disabledIntervalMs,
    };
  }

  let cfg: ResolvedSmoothingConfig = resolveConfig(opts.config);
  let catchUpTauSec = cfg.catchUpTauMs / 1000;
  let velTauSec = cfg.velocitySmoothingMs / 1000;

  const cursors = new Map<string, Cursor>();
  let rafId: number | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let lastStepAt = 0;
  /** Smoothed display frame time, measured from rAF timestamps (0 = not yet known).
   *  Drives the round-to-nearest-frame publish threshold. */
  let frameMs = 0;
  let lastFrameTs = 0;
  /** True for the duration of one step (including the synchronous React work a
   *  publish triggers). See the re-entrancy note in `onFrame`. */
  let stepping = false;

  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  // Read as a function (not a const) because `setConfig` may flip `enabled` on a
  // live smoother, which changes WHICH loop drives it.
  const rafDriven = () => cfg.enabled && typeof requestAnimationFrame !== 'undefined';

  /** Whether any cursor still has work the loop could do THIS second. A parked
   *  cursor is skipped: only new authoritative text can unblock it, and
   *  `setTarget` re-arms the loop when that arrives. */
  function anyBacklog(): boolean {
    for (const c of cursors.values()) if (!c.parked && c.shown < c.target.length) return true;
    return false;
  }

  function publish(ids: string[]) {
    if (ids.length === 0) return;
    commit(() => {
      for (const id of ids) onPublish(id);
    });
  }

  /**
   * Spend up to `stepUnits` characters of release budget on `c`, respecting the
   * active landing policy. Returns nothing; `c.shown` is the only thing it moves,
   * and it only ever moves FORWARD (the prefix invariant).
   */
  function applyLandingPolicy(c: Cursor, stepUnits: number, now: number): void {
    const backlog = c.target.length - c.shown;
    const final = c.finishing;

    if (cfg.style === 'line') {
      // The rate controller decides HOW FAST; the unit geometry decides WHERE the
      // display may stop. A completed unit is never held past LINE_MAX_HOLD_MS.
      const overdue = now - c.lastAdvanceAt >= LINE_MAX_HOLD_MS;
      let landing = c.shown;
      let budget = stepUnits;
      for (let units = 0; units < LINE_MAX_UNITS_PER_STEP; units += 1) {
        const end = lineUnitEnd(c, landing, final);
        if (end === null) break; // still arriving — hold; the skeleton stands in
        const cost = end - landing;
        if (cost > budget && !(units === 0 && overdue)) break;
        budget -= Math.min(cost, budget);
        landing = end;
      }
      if (landing > c.shown) {
        c.shown = landing;
        return;
      }
      // Nothing was releasable. `overdue` cannot help — it relaxes the BUDGET, never
      // the "unit incomplete" answer — so a stream that died mid-unit would sit
      // behind the skeleton forever. Escape only once BOTH the display and the
      // authoritative text have gone quiet, so an actively-streaming table (which
      // grows without advancing) keeps its deliberate hold. (On a FINAL target
      // `lineUnitEnd` always answers with a unit, so this is unreachable during a
      // drain — the deadline in `stepAll` is the drain's own backstop.)
      if (now - Math.max(c.lastAdvanceAt, c.lastTargetGrowthAt) >= LINE_STALL_MS) {
        const word = advanceToWordBoundary(c.target, c.shown, stepUnits, final);
        c.shown =
          word > c.shown
            ? word
            : stepUnits >= backlog
              ? c.target.length
              : advanceToGraphemeBoundary(c.target, c.shown, stepUnits);
      }
      return;
    }

    // `flow`: whole words only.
    const landing = advanceToWordBoundary(c.target, c.shown, stepUnits, final);
    if (landing > c.shown) {
      c.shown = landing;
      return;
    }
    // On a FINAL target only, a budget that covers the whole remaining backlog may
    // land it. This is NOT the "budget ≥ backlog ⇒ show everything" fast path that
    // `stepAll` deliberately removed: that path was wrong because the last word could
    // still be GROWING, and here it provably cannot. It is what lets a drain finish
    // an unbroken tail token (a long URL, a hash) without waiting out WORD_STALL_MS,
    // and it costs at most `backlog` characters — which, at this point, the rate
    // controller has already paid for.
    if (final && stepUnits >= backlog) {
      c.shown = c.target.length;
      return;
    }
    // No complete word is reachable. Normally that is a one-or-two-frame wait while
    // the current word finishes arriving; if it lasts, the text is either one
    // pathological unbroken token or a stream that stopped mid-word, and holding
    // forever would both hide content and keep the rAF loop alive. Degrade to
    // grapheme pacing, which always drains and therefore always terminates.
    if (now - c.lastAdvanceAt >= WORD_STALL_MS) {
      c.shown =
        stepUnits >= backlog
          ? c.target.length
          : advanceToGraphemeBoundary(c.target, c.shown, stepUnits);
    }
  }

  /** Advance every cursor by `dtSeconds` worth of reveal; publish the ones that
   *  moved. Returns whether any backlog remains (⇒ keep the loop alive). */
  function stepAll(dtSeconds: number, now: number): boolean {
    const changed: string[] = [];
    // Ids whose DRAIN reached the end of the text in this step (see `settleDrains`).
    let landed: string[] | null = null;
    for (const [id, c] of cursors) {
      if (c.shown >= c.target.length) {
        // Already at the end — a drain marked on a caught-up cursor still has to be
        // settled, or a deferred drop would never be honoured and the loop would
        // have no reason to run again.
        if (c.finishing) (landed ??= []).push(id);
        continue;
      }
      const before = c.shown;
      if (cfg.enabled) {
        const backlog = c.target.length - c.shown;
        // Target velocity: a backlog-proportional term (keeps display lag bounded to
        // ~catchUpTau seconds of text regardless of the incoming rate) with a floor
        // (a readable minimum pace that also drains the tail without a Zeno crawl).
        const targetVelocity = Math.max(cfg.baseCharsPerSecond, backlog / catchUpTauSec);
        // Low-pass the velocity toward that target (frame-rate-independent). THIS is
        // the butter: when a provider burst spikes the backlog, the reveal speed ramps
        // UP over ~velocitySmoothingMs instead of dumping a word-sized chunk in one
        // frame, then eases back down as the backlog drains. Steady state is unchanged
        // (velocity → target), so lag stays bounded.
        const k = velTauSec > 0 ? 1 - Math.exp(-dtSeconds / velTauSec) : 1;
        c.velocity += (targetVelocity - c.velocity) * k;
        // THE DRAIN (see the TERMINAL DRAIN note in the module doc). A finishing
        // cursor spends at least `backlog / timeLeft`, which on its own integrates to
        // a constant-rate landing that reaches the end exactly at `drainUntil`; the
        // `max` keeps the eased velocity as a floor, so a fast answer lands at its own
        // speed and eases down rather than being slowed to the drain's average. Past
        // the deadline the landing is unconditional — the drain is bounded in time no
        // matter what the landing policy would prefer.
        if (c.finishing && now >= c.drainUntil) {
          // Deadline reached — land the rest unconditionally. This is the drain's
          // hard bound: whatever the landing policy would prefer, a drain is over
          // within `maxDrainMs`.
          c.shown = c.target.length;
          c.carry = 0;
        } else {
          let spend = c.velocity;
          if (c.finishing) {
            // Spend at least `backlog / timeLeft`, which on its own integrates to a
            // constant-rate landing arriving exactly at `drainUntil`. Keeping the
            // eased velocity as a floor (via `max`) means a fast answer lands at its
            // own speed and eases down, instead of being slowed to the drain average.
            const required = backlog / Math.max((c.drainUntil - now) / 1000, dtSeconds);
            if (required > spend) spend = required;
          }
          // Integrate the fractional demand into the carry and spend WHOLE characters
          // out of it, so the configured rate is the real rate and frame-time noise is
          // absorbed rather than amplified (see the module doc).
          c.carry += spend * dtSeconds;
          const stepUnits = Math.floor(c.carry);
          if (stepUnits >= 1) {
            // NOTE: there is deliberately no "budget ≥ backlog ⇒ show everything" fast
            // path for a LIVE cursor. Catching up to the tail does NOT license
            // painting it: the last word (or `line` unit) may still be growing, and
            // the landing policy is the single place that decides whether a position
            // may be rested on. (A FINAL target is the one case where it provably
            // cannot grow — see `applyLandingPolicy`.)
            applyLandingPolicy(c, stepUnits, now);
            // Debit what was actually consumed; forgive an overdraft (a landing may
            // exceed the budget by at most one unit) and cap the bank so a long hold
            // can never be followed by a single-frame dump.
            c.carry -= c.shown - before;
            if (c.carry < 0) c.carry = 0;
            else if (c.carry > MAX_CARRY_UNITS) c.carry = MAX_CARRY_UNITS;
          }
        }
      } else {
        // Disabled: mirror arrival (reveal everything at the publish cadence).
        c.shown = c.target.length;
      }
      if (c.shown !== before) {
        c.published = c.target.slice(0, c.shown);
        c.lastAdvanceAt = now;
        c.parked = false;
        changed.push(id);
        if (c.finishing && c.shown >= c.target.length) (landed ??= []).push(id);
      } else if (cfg.enabled && !c.finishing && now - c.lastAdvanceAt >= PARK_AFTER_MS) {
        // Held with nothing releasable for long enough that only new text can
        // change it — park so the loop can stop (see PARK_AFTER_MS). A DRAINING
        // cursor is never parked: its deadline already bounds it, and parking would
        // strand a deferred drop.
        c.parked = true;
      }
    }
    // Settle landed drains BEFORE publishing, so a deferred drop is already applied
    // when subscribers read — one notification, one render, no intermediate value.
    if (landed) {
      for (const id of landed) {
        const c = cursors.get(id);
        if (!c) continue;
        c.finishing = false;
        c.drainUntil = 0;
        if (c.pendingDrop) {
          cursors.delete(id);
          if (!changed.includes(id)) changed.push(id);
        }
      }
    }
    publish(changed);
    return anyBacklog();
  }

  function onFrame(ts: number) {
    rafId = null;
    // RE-ENTRANCY GUARD. `stepAll` publishes, a publish drives a synchronous
    // external-store re-render, and that render's effect can call `setSmoothing` →
    // `setConfig` → `ensureRunning`. With `rafId` already nulled above, that would
    // arm a SECOND rAF loop alongside the one this frame's tail arms — two loops
    // stepping the same cursors at double rate, forever. Nothing reaches that path
    // today, but the cost of closing it is three lines. The tail below re-evaluates
    // backlog AFTER the publish, so anything `setConfig` un-parked is still honoured.
    stepping = true;
    // Measure the display's frame time (outliers — tab switches, GC hitches — are
    // rejected) so the publish cadence can round to the NEAREST frame.
    if (lastFrameTs !== 0) {
      const delta = ts - lastFrameTs;
      if (delta >= 3 && delta <= 40) {
        frameMs = frameMs === 0 ? delta : frameMs + (delta - frameMs) * 0.2;
      }
    }
    lastFrameTs = ts;

    const elapsed = ts - lastStepAt;
    // Throttle to the publish cadence: rAF fires at the display refresh rate, but we
    // only step every ~`publishIntervalMs` to bound markdown re-parse frequency.
    // Rounding to the NEAREST frame (rather than the next frame at or after the
    // interval) is what keeps a 90/144Hz panel from getting a coarser cadence than a
    // 60Hz one — see the PUBLISH THROTTLE note in the module doc.
    if (elapsed < Math.max(0, cfg.publishIntervalMs - frameMs / 2)) {
      rafId = requestAnimationFrame(onFrame);
      stepping = false;
      return;
    }
    const dt = Math.min(elapsed, cfg.maxFrameMs) / 1000;
    lastStepAt = ts;
    const busy = stepAll(dt, ts);
    stepping = false;
    rearm(busy);
  }

  function onInterval() {
    stepping = true;
    const t = nowMs();
    const dt = Math.min(t - lastStepAt, cfg.maxFrameMs) / 1000;
    lastStepAt = t;
    const busy = stepAll(dt, t);
    stepping = false;
    rearm(busy);
  }

  /**
   * Schedule (or stop) the next step from POST-PUBLISH state. Owning this in one
   * place is what makes the re-entrancy guard complete: a `setConfig` that lands
   * inside a publish may have un-parked cursors AND flipped which loop should drive
   * them, and both are read here rather than at the top of the step.
   */
  function rearm(busy: boolean) {
    if (!busy) {
      stopRunning();
      return;
    }
    if (rafDriven()) {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (rafId === null) rafId = requestAnimationFrame(onFrame);
    } else {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (intervalId === null) {
        lastStepAt = nowMs();
        intervalId = setInterval(
          onInterval,
          cfg.enabled ? cfg.publishIntervalMs : cfg.disabledIntervalMs,
        );
      }
    }
  }

  function ensureRunning() {
    // A publish inside the current step may re-enter here; the step's own tail arms
    // the next frame from post-publish state, so re-arming now would double the loop.
    if (stepping) return;
    if (rafDriven()) {
      if (rafId !== null) return;
      lastStepAt = nowMs();
      lastFrameTs = 0;
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

  /**
   * Jump `id`'s display straight to `fullText`. The whole of `snap`, factored out so
   * `finish` can degrade to it exactly (rather than approximately) on every path
   * where a drain would be wrong.
   *
   * A cursor that only still exists because its drain was in flight (`pendingDrop`)
   * is REMOVED here instead of being snapped: the engine already asked for it to go,
   * and `get(id)` returning '' sends the row to the authoritative `message.content` —
   * which, on every caller of this function, is that same full text.
   */
  function snapTo(id: string, fullText: string): void {
    const c = cursors.get(id);
    const now = nowMs();
    if (c) {
      if (c.pendingDrop) {
        cursors.delete(id);
        if (!anyBacklog() && !stepping) stopRunning();
        onPublish(id);
        return;
      }
      c.target = fullText;
      c.shown = fullText.length;
      c.published = fullText;
      c.velocity = cfg.baseCharsPerSecond;
      c.carry = 0;
      c.lastAdvanceAt = now;
      c.lastTargetGrowthAt = now;
      c.parked = false;
      c.finishing = false;
      c.drainUntil = 0;
      // Fenced-code state is recomputed lazily from the start on the next `line`
      // step (a snapped prefix may contain any number of fences).
      c.fenceScan = 0;
      c.fenceOpen = false;
      c.fenceChar = '';
    } else {
      cursors.set(id, newCursor(fullText, fullText.length, cfg.baseCharsPerSecond, now));
    }
    onPublish(id);
  }

  /** Land every in-flight drain immediately. See {@link StreamSmoother.abandonDrains}. */
  function abandonAllDrains(): void {
    let touched: string[] | null = null;
    for (const [id, c] of cursors) {
      if (!c.finishing) continue;
      c.finishing = false;
      c.drainUntil = 0;
      if (c.pendingDrop) {
        cursors.delete(id);
      } else if (c.shown < c.target.length) {
        c.shown = c.target.length;
        c.published = c.target;
        c.carry = 0;
        c.lastAdvanceAt = nowMs();
      }
      (touched ??= []).push(id);
    }
    if (!touched) return;
    if (!anyBacklog() && !stepping) stopRunning();
    for (const id of touched) onPublish(id);
  }

  return {
    setTarget(id, fullText) {
      let c = cursors.get(id);
      // New text on a DRAINING cursor means the "final" call was premature (a late
      // delta after a terminal). Resolve the drain first — landing what it had and
      // honouring any deferred drop — so the cursor is either back to ordinary live
      // pacing or gone, never half-finished.
      if (c?.finishing) {
        snapTo(id, c.target);
        c = cursors.get(id);
      }
      if (!c) {
        c = newCursor(fullText, 0, cfg.baseCharsPerSecond, nowMs());
        cursors.set(id, c);
      } else {
        if (fullText.length > c.target.length) c.lastTargetGrowthAt = nowMs();
        c.target = fullText;
        // New authoritative text is the only thing that can unblock a held cursor.
        c.parked = false;
        // Defensive: if the authoritative text ever shrank below the display cursor
        // (never happens on the append-only path, but keeps the prefix invariant),
        // clamp and republish so `get` can't return text outside the new target.
        if (c.shown > fullText.length) {
          c.shown = fullText.length;
          c.published = fullText;
          c.carry = 0;
          c.fenceScan = 0;
          c.fenceOpen = false;
          c.fenceChar = '';
          onPublish(id);
        }
      }
      if (c.shown < c.target.length) ensureRunning();
    },

    snap(id, fullText) {
      snapTo(id, fullText);
    },

    finish(id, fullText) {
      const c = cursors.get(id);
      // Every reason a drain would be wrong or pointless collapses to an exact
      // `snap` — the pre-drain behaviour, byte for byte:
      //   · no cursor / nothing left to reveal → there is nothing to drain;
      //   · smoothing off or `maxDrainMs: 0`   → the feature's off switches;
      //   · `pendingDrop`                      → the engine already dropped it;
      //   · not a prefix of `fullText`         → defensive; the display must never
      //     become a non-prefix, so the only safe move is to show the whole text.
      if (
        !c ||
        !cfg.enabled ||
        cfg.maxDrainMs <= 0 ||
        c.pendingDrop ||
        c.shown >= fullText.length ||
        // NOTHING WAS EVER REVEALED — there is no rhythm to land into, and draining
        // from zero would REWIND the answer. The row reads the smoother only while
        // its value is a non-empty strict prefix of the final text, so at `shown: 0`
        // the terminal commit paints the answer IN FULL; the first drained frame
        // would then publish a short prefix and the row would collapse back to it
        // and re-type. Reachable on every short answer in the `line` style (a single
        // sentence with no newline releases no unit at all) and on any answer that
        // finishes before a frame runs. Degrading to `snap` here is byte-identical
        // to the pre-drain behaviour, which is exactly what those answers already
        // did — a one-unit answer has no line-by-line landing to give up.
        c.shown === 0 ||
        !fullText.startsWith(c.published)
      ) {
        snapTo(id, fullText);
        return;
      }
      const backlog = fullText.length - c.shown;
      const base =
        cfg.baseCharsPerSecond > 0
          ? cfg.baseCharsPerSecond
          : SMOOTHING_DEFAULTS.baseCharsPerSecond;
      c.target = fullText;
      c.parked = false;
      c.finishing = true;
      // The tail lands at the FLOOR reveal rate when it can do so inside the bound,
      // and is compressed into the bound when it cannot — so the answer never gets
      // visibly longer, and never crawls (see the TERMINAL DRAIN note).
      c.drainUntil = nowMs() + Math.min(cfg.maxDrainMs, (backlog / base) * 1000);
      ensureRunning();
    },

    abandonDrains() {
      abandonAllDrains();
    },

    get(id) {
      return cursors.get(id)?.published ?? '';
    },

    drop(id) {
      const c = cursors.get(id);
      if (c?.finishing) {
        // DEFER. The engine's `completed` terminal lands within milliseconds of
        // `text_done`, so removing the cursor here would cut every drain off at its
        // first frame. The cursor holds its own copy of the final text, is bounded by
        // its own deadline, notifies only this id, and deletes itself the moment it
        // lands — at which point `get` returns '' and the row reads the authoritative
        // `message.content`, the same full text. Nothing here keeps the loop alive
        // beyond that deadline.
        //
        // `ensureRunning` makes the deferral SELF-SUFFICIENT: a deferred cursor can
        // only ever be released by a step, so it must never depend on some other
        // cursor to keep the loop armed.
        c.pendingDrop = true;
        ensureRunning();
        return;
      }
      if (cursors.delete(id)) onPublish(id);
      if (!anyBacklog()) stopRunning();
    },

    clear() {
      // NOTIFY, like `drop` does. Without this, a row still subscribed to a cleared
      // id kept rendering the last value this smoother published and only silently
      // emptied on some later, unrelated re-render — a stale-then-blank read of
      // answer text. Every caller (`resetStreamingBuffers`, `disconnect`) has already
      // written the authoritative text onto the structural message and flipped
      // `isStreaming:false`, so by the time these land the rows read `message.content`
      // and nothing visible changes; the point is that the two stores can no longer
      // disagree.
      //
      // A DRAINING cursor is deferred rather than removed, exactly as in `drop` and
      // for exactly the same reason (`completed` calls both, back to back).
      const ids: string[] = [];
      let deferred = false;
      for (const [id, c] of cursors) {
        if (c.finishing) {
          c.pendingDrop = true;
          deferred = true;
          continue;
        }
        ids.push(id);
      }
      for (const id of ids) cursors.delete(id);
      // Unconditional before drains existed, and still unconditional whenever none is
      // in flight — `anyBacklog()` is false once the map is empty. When one IS in
      // flight the loop must instead be guaranteed to run, since only a step can
      // release a deferred cursor (see `drop`).
      if (deferred) ensureRunning();
      else if (!anyBacklog()) stopRunning();
      for (const id of ids) onPublish(id);
    },

    setConfig(config) {
      const next = resolveConfig(config);
      if (
        next.enabled === cfg.enabled &&
        next.style === cfg.style &&
        next.baseCharsPerSecond === cfg.baseCharsPerSecond &&
        next.catchUpTauMs === cfg.catchUpTauMs &&
        next.velocitySmoothingMs === cfg.velocitySmoothingMs &&
        next.publishIntervalMs === cfg.publishIntervalMs &&
        next.maxFrameMs === cfg.maxFrameMs &&
        next.maxDrainMs === cfg.maxDrainMs
      ) {
        return;
      }
      const loopKindChanged = next.enabled !== cfg.enabled;
      cfg = next;
      catchUpTauSec = cfg.catchUpTauMs / 1000;
      velTauSec = cfg.velocitySmoothingMs / 1000;
      // Switching smoothing (or the drain) OFF must take effect at once, not at the
      // end of an in-flight drain — "off" has to mean off. Landing them is always
      // safe: it only moves the display forward onto the full text.
      if (!cfg.enabled || cfg.maxDrainMs <= 0) abandonAllDrains();
      // Cursor POSITIONS are untouched — `shown` never moves backwards, so the
      // published value stays a prefix across the switch — but a new landing policy
      // can unblock a parked cursor, so every cursor is re-armed. Only the `enabled`
      // flag changes WHICH loop runs (rAF vs interval, and the interval's period),
      // so only that needs the loop torn down first.
      for (const c of cursors.values()) c.parked = false;
      // When called from inside a step (a publish's render effect), `rearm` owns the
      // scheduling decision and reads the new config — touching the loop here would
      // double it. See the re-entrancy note in `onFrame`.
      if (stepping) return;
      if (loopKindChanged) stopRunning();
      if (anyBacklog()) ensureRunning();
    },

    dispose() {
      // Hard teardown — no deferral for drains. The engine is going away, so there is
      // nothing left to animate into and nothing left to read the value; every row
      // that survives reads the authoritative `message.content`.
      cursors.clear();
      stopRunning();
    },
  };
}
