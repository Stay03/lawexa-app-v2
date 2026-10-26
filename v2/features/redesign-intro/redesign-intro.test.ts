import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { screenHeld, setScreenHold } from '@/v2/runtime/screen-hold';
import { imagesStatus, INTRO_IMAGES_TIMEOUT_MS } from './intro-images';
import { slideAt, slideOffset } from './carousel';
import { introSeenKey, introShouldOpen, REDESIGN_INTRO_IMAGES, REDESIGN_INTRO_TEXT, REDESIGN_INTRO_TITLE, type IntroInputs } from './model';

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
  images: 'ready',
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

test('it opens only once every picture has loaded, and never when one failed', () => {
  assert.equal(introShouldOpen({ ...base, images: 'loading' }), false);
  assert.equal(introShouldOpen({ ...base, images: 'failed' }), false);
  // A failed picture keeps it shut even if it was up: no broken card.
  assert.equal(introShouldOpen({ ...base, images: 'failed', showing: true }), false);
  assert.equal(introShouldOpen({ ...base, images: 'ready' }), true);
});

test('the pictures add up: ready when all loaded, failed as soon as one fails, none is ready', () => {
  assert.equal(imagesStatus([]), 'ready');
  assert.equal(imagesStatus(['loaded', 'loaded', 'loaded']), 'ready');
  assert.equal(imagesStatus(['loaded', 'loading', 'loaded']), 'loading');
  assert.equal(imagesStatus(['loaded', 'failed', 'loading']), 'failed');
  // A slow picture counts as failed for the page load after this long.
  assert.equal(INTRO_IMAGES_TIMEOUT_MS, 10_000);
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

test("the card: Stay's text, one button that closes it for good, the pictures above", () => {
  assert.equal(REDESIGN_INTRO_TITLE, 'Welcome to the new Lawexa');
  assert.equal(REDESIGN_INTRO_TEXT, 'A cleaner look, with your chats, cases, notes and work in one place.');
  const card = read('v2', 'features', 'redesign-intro', 'RedesignIntro.tsx');
  assert.match(card, /<Button className="w-full sm:w-auto sm:self-end" onClick=\{close\}>\s*Take a look/);
  assert.doesNotMatch(card, /Don&apos;t show again/);
  // Closing marks this browser and posts the account's own mark for every other device.
  const close = card.slice(card.indexOf('const close = () => {'), card.indexOf('return (', card.indexOf('const close = () => {')));
  assert.ok(close.indexOf('markSeenHere(userId);') > 0);
  assert.ok(close.indexOf('void authApi.v2IntroSeen().catch(() => undefined);') > close.indexOf('markSeenHere(userId);'));
  assert.match(read('lib', 'api', 'auth.ts'), /apiClient\.post<ApiResponse<\{ v2_intro_seen_at: string \}>>\('\/auth\/me\/v2-intro-seen'\)/);
  // Every way out is "seen": the ×, Escape and a tap outside go through onOpenChange.
  assert.match(card, /onOpenChange=\{\(next\) => \(next \? undefined : close\(\)\)\}/);
  // The light pictures as WebP in public/, in Stay's order (the draft one is added once Tester retakes it).
  assert.deepEqual(REDESIGN_INTRO_IMAGES.map((image) => image.src), ['/v2-intro/redesigned-case.webp', '/v2-intro/redesigned-statute.webp']);
  for (const image of REDESIGN_INTRO_IMAGES) {
    assert.ok(image.alt.length > 0, image.src);
    assert.ok(readFileSync(join(process.cwd(), 'public', image.src)).length < 80 * 1024, `${image.src} stays small`);
  }
  // They slide, with snap points and grey dots (never gold).
  assert.match(card, /className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none/);
  assert.match(card, /position === index \? 'bg-foreground\/70' : 'bg-foreground\/20 hover:bg-foreground\/40'/);
  // Loaded before the card may open, and only for a reader it is for.
  assert.match(card, /const images = useIntroImages\(REDESIGN_INTRO_IMAGES, account && !seenOnServer && !seenHere\);/);
  assert.match(card, /aspect-\[1200\/630\] w-full items-center justify-center bg-secondary/);
  assert.doesNotMatch(card, /amber|emerald|destructive/);
});

test('the picture strip: which picture shows for a scroll, and where a dot takes it', () => {
  // A 576px strip of three pictures.
  assert.equal(slideAt(0, 576, 3), 0);
  assert.equal(slideAt(300, 576, 3), 1);
  assert.equal(slideAt(1152, 576, 3), 2);
  // Past either end it stays on the first or the last.
  assert.equal(slideAt(-40, 576, 3), 0);
  assert.equal(slideAt(5000, 576, 3), 2);
  assert.equal(slideOffset(2, 576, 3), 1152);
  assert.equal(slideOffset(5, 576, 3), 1152);
  assert.equal(slideOffset(-1, 576, 3), 0);
  // No pictures, or a strip not laid out yet.
  assert.equal(slideAt(100, 0, 3), 0);
  assert.equal(slideOffset(1, 576, 0), 0);
});
