import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  burstConfetti,
  CONFETTI_COLORS,
  CONFETTI_COUNT,
  CONFETTI_MAX_MS,
  confettiDone,
  stepConfetti,
} from './results/confetti-model';

/* The podium moment's headline and confetti (Arthur, 28 October 2026: "isn't
 * celebratory enough ... a 'You made the Podium' headline and a confetti
 * explosion like Kahoot"). The burst's timing first, then the wiring, pinned
 * by source. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

/** A seeded random, so a run is the same every time. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Runs a burst at 60 frames a second until it is over; returns how long it took. */
function run(origin: { x: number; y: number }, screenHeight: number, seed: number): number {
  const pieces = burstConfetti(origin, seeded(seed));
  let elapsed = 0;
  while (!confettiDone(pieces, screenHeight, elapsed)) {
    stepConfetti(pieces, 16);
    elapsed += 16;
  }
  return elapsed;
}

test('the burst goes up and out from one point, in Lawexa’s gold and a few other colours', () => {
  const pieces = burstConfetti({ x: 200, y: 500 }, seeded(1));
  assert.equal(pieces.length, CONFETTI_COUNT);
  assert.ok(pieces.every((piece) => piece.x === 200 && piece.y === 500));
  assert.ok(pieces.every((piece) => piece.vy < 0), 'every piece starts upward');
  assert.ok(pieces.some((piece) => piece.vx < 0) && pieces.some((piece) => piece.vx > 0), 'it fans both ways');
  const gold = pieces.filter((piece) => piece.color === CONFETTI_COLORS[0]).length;
  assert.ok(gold >= CONFETTI_COUNT / 3, 'at least a third is gold');
  assert.ok(new Set(pieces.map((piece) => piece.color)).size >= 4);
});

test('it falls off the bottom of a phone and a computer in about two to three seconds', () => {
  for (const seed of [1, 2, 3]) {
    // A phone: the podium a little below the middle of 844px.
    const phone = run({ x: 195, y: 500 }, 844, seed);
    // A computer: 900px tall, the podium near the foot of the page.
    const computer = run({ x: 840, y: 620 }, 900, seed);
    for (const ms of [phone, computer]) {
      assert.ok(ms >= 1800, `still falling at 1.8s (${ms}ms)`);
      assert.ok(ms < CONFETTI_MAX_MS, `gone before the 3.2s cap (${ms}ms)`);
    }
  }
});

test('a burst is never on screen for longer than 3.2s', () => {
  assert.equal(confettiDone(burstConfetti({ x: 0, y: 0 }, seeded(4)), 10_000, CONFETTI_MAX_MS), true);
  assert.equal(confettiDone(burstConfetti({ x: 0, y: 0 }, seeded(4)), 10_000, 100), false);
});

test('the podium moment says "You made the Podium!", bursts as the steps land, and moves on after it falls', () => {
  const stage = read('v2', 'features', 'quiz', 'solo', 'results', 'PodiumStage.tsx');
  assert.match(stage, /playing && 'v2-solo-podium-headline',\s*\)\}\s*>\s*You made the Podium!/);
  // The burst waits for the steps (first place lands at 900ms).
  assert.match(stage, /const PODIUM_LANDS_MS = 900;/);
  // A Skip or Escape before the steps land cancels the burst (Frontend's review of c2775f8).
  assert.match(stage, /useEffect\(\(\) => \{\s*if \(leaving\) return;\s*const timer = window\.setTimeout\(\(\) => \{\s*const box = podiumRef/);
  assert.match(stage, /\}, PODIUM_LANDS_MS\);\s*return \(\) => window\.clearTimeout\(timer\);\s*\}, \[leaving\]\);/);
  assert.match(stage, /setConfetti\(box \? \{ x: box\.left \+ box\.width \/ 2, y: box\.top \+ box\.height \* 0\.55 \} : 'fallen'\);/);
  assert.match(stage, /\{typeof confetti === 'object' \? <Confetti origin=\{confetti\} onDone=\{confettiFallen\} \/> : null\}/);

  const confetti = read('v2', 'features', 'quiz', 'solo', 'results', 'Confetti.tsx');
  // Our own canvas, never a tap target, over the stage (z-40), and stopped with the component.
  assert.match(confetti, /<canvas ref=\{canvasRef\} aria-hidden className="pointer-events-none fixed inset-0 z-50 size-full" \/>/);
  assert.match(confetti, /return \(\) => cancelAnimationFrame\(frame\);/);
});

test('under reduced motion there is no podium stage and no confetti: the results come straight away', () => {
  const screen = read('v2', 'features', 'quiz', 'solo', 'results', 'AttemptResultsScreen.tsx');
  assert.match(screen, /useState\(\(\) => prefersReducedMotion\(\) \|\| podiumAlreadySeen\(attemptUuid\)\)/);
  const css = read('v2', 'features', 'quiz', 'solo', 'solo-quiz.css');
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.ok(reduced.includes('.v2-solo-podium-headline'));
});

test('no confetti package: the app’s dependencies are unchanged', () => {
  const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string> };
  assert.ok(!Object.keys(pkg.dependencies ?? {}).some((name) => /confetti/i.test(name)));
});
