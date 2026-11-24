import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AxiosError, type AxiosResponse } from 'axios';

import { NO_CUT_WATCH, cutTurnFor, reportCut, watchOnPassIn, watchOnReply, type CutWatch } from './voice-cut';

/* "Pick up where the voice was cut" (Stay's option B, 24 November 2026), with
 * the Techlead's review: only a cut of the research result's own reading is
 * told. TEST DATA throughout. */

const reading = 'TEST DATA. Section 24 says three things. First, consent. Second, notice. Third, access.';
const heard = 'TEST DATA. Section 24 says three things. First, consent.';
const filler = 'Is there anything else I can help with?';

function recorder(fail?: unknown) {
  const posts: Array<{ sessionUuid: string; turnUuid: string; full: string; spoken: string }> = [];
  const post = async (sessionUuid: string, turnUuid: string, body: { full: string; spoken: string }) => {
    posts.push({ sessionUuid, turnUuid, ...body });
    if (fail) throw fail;
  };
  return { posts, post };
}

function httpError(status: number): AxiosError {
  return new AxiosError('TEST DATA', String(status), undefined, undefined, { status, data: {} } as AxiosResponse);
}

/** The result for turn 2 went in, and the voice is reading it. */
const reading2: CutWatch = watchOnReply(watchOnPassIn('TEST-turn-2'), reading);

test('a cut during the research result is told once, against its turn, with the full reply and the heard part', async () => {
  const { posts, post } = recorder();
  assert.equal(await reportCut('TEST-session', reading2, { full: reading, spoken: heard }, post), true);
  assert.deepEqual(posts, [{ sessionUuid: 'TEST-session', turnUuid: 'TEST-turn-2', full: reading, spoken: heard }]);
});

test('a cut during filler after the result has finished tells nothing', async () => {
  const { posts, post } = recorder();
  const afterwards = watchOnReply(reading2, filler);
  assert.equal(await reportCut('TEST-session', afterwards, { full: filler, spoken: 'Is there' }, post), false);
  assert.equal(posts.length, 0);
});

test('a cut during an action outcome or a nudge tells nothing: they end the watch', async () => {
  const { posts, post } = recorder();
  // An outcome or a nudge goes in (sentNoticeTurn gives no research turn for them).
  const outcome = watchOnReply(watchOnPassIn(null), 'TEST DATA. Done: the reminder is set for 9 am.');
  assert.deepEqual(outcome, NO_CUT_WATCH);
  assert.equal(await reportCut('TEST-session', outcome, { full: 'TEST DATA. Done: the reminder is set for 9 am.', spoken: 'TEST DATA. Done' }, post), false);
  // Even the result's own text, once something else went in after it.
  assert.equal(await reportCut('TEST-session', watchOnPassIn(null), { full: reading, spoken: heard }, post), false);
  assert.equal(posts.length, 0);
});

test('before any result has gone into the call, a cut tells nothing', async () => {
  const { posts, post } = recorder();
  assert.equal(await reportCut('TEST-session', NO_CUT_WATCH, { full: reading, spoken: heard }, post), false);
  assert.equal(await reportCut(null, reading2, { full: reading, spoken: heard }, post), false);
  assert.equal(posts.length, 0);
});

test('a short reply before the reading ("Sure, one moment") does not stand in for it, and spacing differences do not matter', () => {
  const watch = watchOnReply(watchOnPassIn('TEST-turn-2'), 'Sure, one moment.');
  const both = watchOnReply(watch, reading);
  assert.equal(cutTurnFor(both, { full: `  ${reading.replace('. ', '.\n')}  `, spoken: heard }), 'TEST-turn-2');
  assert.equal(cutTurnFor(both, { full: 'Sure, one moment.', spoken: 'Sure' }), null);
});

test('an ended call (409) or an unknown turn (404) is let go without a word, and not tried again', async () => {
  for (const status of [409, 404]) {
    const { posts, post } = recorder(httpError(status));
    assert.equal(await reportCut('TEST-session', reading2, { full: reading, spoken: heard }, post), false);
    assert.equal(posts.length, 1);
  }
});

test('a second cut of the reading is told again', async () => {
  const { posts, post } = recorder();
  await reportCut('TEST-session', reading2, { full: reading, spoken: heard }, post);
  await reportCut('TEST-session', reading2, { full: reading, spoken: 'TEST DATA. Section 24 says three things.' }, post);
  assert.equal(posts.length, 2);
  assert.equal(posts[1].spoken, 'TEST DATA. Section 24 says three things.');
});

test("the page wires ElevenLabs' correction to the cut, and keeps the watch where results, outcomes, nudges and replies happen", () => {
  const dir = join(process.cwd(), 'v2', 'features', 'voice-test');
  const session = readFileSync(join(dir, 'elevenlabs-voice-session.ts'), 'utf8');
  assert.match(session, /onAgentResponseCorrection: \(\{ original_agent_response, corrected_agent_response \}\) =>\s*handlers\.onCut\?\.\(\{ full: original_agent_response, spoken: corrected_agent_response \}\)/);
  const controller = readFileSync(join(dir, 'voice-controller.ts'), 'utf8');
  assert.match(controller, /const turn = sentNoticeTurn\(next\);[\s\S]*?this\.cutWatch = watchOnPassIn\(turn\);/);
  assert.match(controller, /if \(message\.source === 'ai'\) this\.cutWatch = watchOnReply\(this\.cutWatch, message\.text\);/);
  assert.match(controller, /mode !== 'a'\) return;\s*void reportCut\(this\.state\.sessionUuid, this\.cutWatch, cut, voiceTestApi\.cut\);/);
});
