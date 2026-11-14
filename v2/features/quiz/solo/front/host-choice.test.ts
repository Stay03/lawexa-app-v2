import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { START_LIVE, START_SOLO } from './front-model';

/* Arthur's A (f730f71c, 14 November 2026): "Host live quiz" was hidden in the
 * three-dot menu. Start now offers both ways to play, to whoever may host:
 * Play solo, or Host live in a Space. Whoever cannot host gets Start alone,
 * which starts at once. TEST DATA only. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test("Start's two choices say what each one is", () => {
  assert.deepEqual(START_SOLO, { label: 'Play solo', hint: 'On your own, for your best score' });
  assert.deepEqual(START_LIVE, { label: 'Host live in a Space', hint: 'Everyone plays at once, on their own phone' });
});

test('for a host, Start opens the choice; Play solo starts the attempt, Host live opens the Space picker', () => {
  const front = read('v2', 'features', 'quiz', 'solo', 'front', 'QuizFrontScreen.tsx');
  assert.match(front, /\{mayTake && mayHostLive \? \(\s*\/\/[\s\S]{0,300}?<DropdownMenu>\s*<DropdownMenuTrigger asChild>\s*<RaisedButton className=\{FRONT_BUTTON\} disabled=\{startAttempt\.isPending\}>/);
  assert.match(front, /<DropdownMenuItem onSelect=\{start\}[\s\S]{0,400}?\{START_SOLO\.label\}/);
  assert.match(front, /<DropdownMenuItem onSelect=\{openHost\}[\s\S]{0,400}?\{START_LIVE\.label\}/);
  // Anyone else: Start starts at once.
  assert.match(front, /\) : mayTake \? \(\s*<RaisedButton className=\{FRONT_BUTTON\} onClick=\{start\} disabled=\{startAttempt\.isPending\}>/);
  // The three-dot menu no longer carries it.
  assert.doesNotMatch(front, /label: 'Host a live quiz'/);
});
