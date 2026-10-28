import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beginOffer, beginPlanEndedOffer, noteChatMoment } from './store';

/* A paid plan ran out (Arthur, 28 October 2026, "B plus A"): the server says
 * `moment: "plan_ended"`, and the banner asks on the FIRST screen opened, home,
 * the chat list or a chat (Stay: a plan that ran out cannot chat), about no
 * chat. Its own file: the store keeps the session's one ask, and this needs a
 * fresh session. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test('a plan that ended opens the session’s one ask, and nothing asks again', () => {
  assert.equal(beginPlanEndedOffer(), true);
  noteChatMoment('copy', 11, '/c/conv-3');
  assert.equal(beginOffer('conv-3'), false);
  assert.equal(beginPlanEndedOffer(), false);
});

test('the shell asks the server as the app opens and shows the banner on any screen, about no chat', () => {
  const slot = read('v2', 'features', 'chat-rating', 'PlanEndedRating.tsx');
  assert.match(slot, /const prompt = useQuery\(\{ \.\.\.chatPromptQuery\(userId\), enabled: isAccount && !askedThisSession \}\);/);
  assert.match(slot, /prompt\.data\?\.eligible === true && prompt\.data\.moment === 'plan_ended'/);
  assert.match(slot, /if \(planEnded && beginPlanEndedOffer\(\)\) \{\s*void feedbackApi\.chatPromptSeen\('shown'\)/);
  assert.match(slot, /if \(!active \|\| active\.trigger !== 'plan_ended'\) return null;/);
  const layout = read('app', 'v2', 'layout.tsx');
  assert.match(layout, /<PlanEndedRating \/>/);
  // The chat's slot and the shell read one cached answer: one request a page load at most.
  const banner = read('v2', 'features', 'chat-rating', 'ChatRatingBanner.tsx');
  assert.match(banner, /queryKey: \['chat-rating', 'prompt', userId\] as const,/);
  assert.match(banner, /\.\.\.chatPromptQuery\(userId\),\s*enabled: isAccount && hasMoment && !askedThisSession,/);
});
