import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AxiosError, type AxiosResponse } from 'axios';

import { reportCut } from './voice-cut';

/* "Pick up where the voice was cut" (Stay's option B, 24 November 2026).
 * TEST DATA throughout. */

const cut = { full: 'TEST DATA. Section 24 says three things. First, consent. Second, notice. Third, access.', spoken: 'TEST DATA. Section 24 says three things. First, consent.' };

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

test('a cut is told once, against the turn whose result the page last sent in, with the full reply and the heard part', async () => {
  const { posts, post } = recorder();
  assert.equal(await reportCut({ sessionUuid: 'TEST-session', lastSentTurn: 'TEST-turn-2' }, cut, post), true);
  assert.deepEqual(posts, [{ sessionUuid: 'TEST-session', turnUuid: 'TEST-turn-2', full: cut.full, spoken: cut.spoken }]);
});

test('before any result has gone into the call, a cut is not told', async () => {
  const { posts, post } = recorder();
  assert.equal(await reportCut({ sessionUuid: 'TEST-session', lastSentTurn: null }, cut, post), false);
  assert.equal(await reportCut({ sessionUuid: null, lastSentTurn: 'TEST-turn-2' }, cut, post), false);
  assert.equal(posts.length, 0);
});

test('an ended call (409) or an unknown turn (404) is dropped without a word, and not tried again', async () => {
  for (const status of [409, 404]) {
    const { posts, post } = recorder(httpError(status));
    assert.equal(await reportCut({ sessionUuid: 'TEST-session', lastSentTurn: 'TEST-turn-2' }, cut, post), false);
    assert.equal(posts.length, 1);
  }
});

test('a second cut is told again', async () => {
  const { posts, post } = recorder();
  const where = { sessionUuid: 'TEST-session', lastSentTurn: 'TEST-turn-2' };
  await reportCut(where, cut, post);
  await reportCut(where, { full: cut.full, spoken: 'TEST DATA. Section 24 says three things.' }, post);
  assert.equal(posts.length, 2);
  assert.equal(posts[1].spoken, 'TEST DATA. Section 24 says three things.');
});

test("the page wires ElevenLabs' correction event to the cut, on a Lawexa voice call, against the last /sent turn", () => {
  const dir = join(process.cwd(), 'v2', 'features', 'voice-test');
  const session = readFileSync(join(dir, 'elevenlabs-voice-session.ts'), 'utf8');
  assert.match(session, /onAgentResponseCorrection: \(\{ original_agent_response, corrected_agent_response \}\) =>\s*handlers\.onCut\?\.\(\{ full: original_agent_response, spoken: corrected_agent_response \}\)/);
  const controller = readFileSync(join(dir, 'voice-controller.ts'), 'utf8');
  assert.match(controller, /if \(turn\) this\.lastSentTurn = turn;\s*if \(turn && this\.state\.sessionUuid\) void this\.tellResultSent/);
  assert.match(controller, /onCut: \(cut\) => \{[\s\S]*?mode !== 'a'\) return;[\s\S]*?reportCut\(\{ sessionUuid: this\.state\.sessionUuid, lastSentTurn: this\.lastSentTurn \}, cut, voiceTestApi\.cut\)/);
});
