import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { screenHeld, setScreenHold } from '@/v2/runtime/screen-hold';
import { introSeenKey, introShouldOpen, REDESIGN_INTRO_IMAGE, REDESIGN_INTRO_TITLE, type IntroInputs } from './model';

/* "Lawexa, redesigned": the one-time pop-up for the switch (Stay, 25 October 2026). */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

const base: IntroInputs = {
  account: true,
  userId: 3,
  seenOnServer: false,
  seenHere: false,
  mounted: true,
  screenHeld: false,
  showing: false,
};

test('it opens once for a signed-in account that has not seen it', () => {
  assert.equal(introShouldOpen(base), true);
  assert.equal(introShouldOpen({ ...base, seenHere: true }), false);
  assert.equal(introShouldOpen({ ...base, seenOnServer: true }), false);
});

test('never for a guest or a signed-out reader, and never before the client knows', () => {
  assert.equal(introShouldOpen({ ...base, account: false }), false);
  assert.equal(introShouldOpen({ ...base, userId: null }), false);
  assert.equal(introShouldOpen({ ...base, mounted: false }), false);
});

test('it waits while an answer is written or a quiz is played, but a hold under it does not close it', () => {
  assert.equal(introShouldOpen({ ...base, screenHeld: true }), false);
  assert.equal(introShouldOpen({ ...base, screenHeld: true, showing: true }), true);
});

test('the mark is per account', () => {
  assert.equal(introSeenKey(3), 'lawexa-v2-intro-seen:3');
  assert.notEqual(introSeenKey(3), introSeenKey(4));
});

test('a screen holds until it lets go, and every holder counts', () => {
  assert.equal(screenHeld(), false);
  setScreenHold('chat', true);
  setScreenHold('quiz', true);
  setScreenHold('chat', false);
  assert.equal(screenHeld(), true);
  setScreenHold('quiz', false);
  assert.equal(screenHeld(), false);
});

test('the chat and both quiz players hold; the layout mounts the pop-up with the server mark', () => {
  assert.match(read('v2', 'features', 'conversations', 'conversation', 'ConversationScreen.tsx'), /useScreenHold\(isStreaming\);/);
  assert.match(read('v2', 'features', 'quiz', 'player', 'PlayerScreen.tsx'), /useScreenHold\(sessionQuery\.isPending \|\| quizSession\?\.status === 'active'\);/);
  assert.match(read('v2', 'features', 'quiz', 'solo', 'player', 'AttemptPlay.tsx'), /useScreenHold\(true\);/);
  assert.match(read('v2', 'features', 'quiz', 'solo', 'player', 'AttemptPlayerScreen.tsx'), /useScreenHold\(query\.isPending\);/);
  assert.match(read('app', 'v2', 'layout.tsx'), /<RedesignIntro seenOnServer=\{user\?\.v2_intro_seen === true\} \/>/);
});

test('the card: the title, two buttons that both close it for good, gold only on Take a look, a picture slot', () => {
  assert.equal(REDESIGN_INTRO_TITLE, 'Lawexa, redesigned');
  const card = read('v2', 'features', 'redesign-intro', 'RedesignIntro.tsx');
  assert.match(card, /<Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick=\{close\}>\s*Don&apos;t show again/);
  assert.match(card, /<Button size="sm" onClick=\{close\}>\s*Take a look/);
  // Closing marks this browser and posts the account's own mark for every other device.
  const close = card.slice(card.indexOf('const close = () => {'), card.indexOf('return (', card.indexOf('const close = () => {')));
  assert.ok(close.indexOf('markSeenHere(userId);') > 0);
  assert.ok(close.indexOf('void authApi.v2IntroSeen().catch(() => undefined);') > close.indexOf('markSeenHere(userId);'));
  assert.match(read('lib', 'api', 'auth.ts'), /apiClient\.post<ApiResponse<\{ v2_intro_seen_at: string \}>>\('\/auth\/me\/v2-intro-seen'\)/);
  // Every way out is "seen": the ×, Escape and a tap outside go through onOpenChange.
  assert.match(card, /onOpenChange=\{\(next\) => \(next \? undefined : close\(\)\)\}/);
  // The picture is a 1200 x 630 slot, a neutral band until one is chosen.
  assert.equal(REDESIGN_INTRO_IMAGE, null);
  assert.match(card, /aspect-\[1200\/630\] w-full items-center justify-center bg-secondary/);
  assert.doesNotMatch(card, /amber|emerald|destructive/);
});
