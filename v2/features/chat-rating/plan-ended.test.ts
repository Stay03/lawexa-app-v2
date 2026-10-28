import { test } from 'node:test';
import assert from 'node:assert/strict';

import { beginOffer, noteChatMoment } from './store';

/* A paid plan ran out (Arthur, 28 October 2026, "B plus A"): the server says
 * `moment: "plan_ended"`, and the banner asks on the chat that is open, with
 * no moment and no answer named. Its own file: the store keeps the session's
 * one ask, and this needs a fresh session. */

test('a plan that ended opens the session’s one ask in the chat that is open', () => {
  // No moment happened anywhere.
  assert.equal(beginOffer('conv-3'), false);
  assert.equal(beginOffer('conv-3', 'plan_ended'), true);
  // The session has asked: neither a later moment nor another plan_ended asks again.
  noteChatMoment('copy', 11, '/c/conv-3');
  assert.equal(beginOffer('conv-3'), false);
  assert.equal(beginOffer('conv-3', 'plan_ended'), false);
});
