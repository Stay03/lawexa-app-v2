import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { ChannelQuiz, ChannelQuizListResponse } from '@/types/channel-quiz';
import { isQuizListQuery, QUIZ_LIST_KINDS, withVisibility } from './list-cache';

/* The optimistic visibility write (useSetQuizVisibility) patches every cached
 * quiz-row list, flat or page-infinite, and leaves everything else under the
 * channel-quiz root alone (21 October 2026, when the solo library and the
 * explore list joined the room lists). */

function quiz(uuid: string, visibility: ChannelQuiz['visibility'] = 'shared'): ChannelQuiz {
  return {
    uuid,
    channel_uuid: null,
    channel_deleted: false,
    title: `Quiz ${uuid}`,
    description: null,
    settings: { show_leaderboard: true, allow_late_join: true },
    creator: null,
    is_ai_generated: false,
    visibility,
    is_mine: true,
    question_count: 2,
    created_at: '2026-10-21T16:29:55+00:00',
    updated_at: '2026-10-21T16:29:55+00:00',
  };
}

function page(...rows: ChannelQuiz[]): ChannelQuizListResponse {
  return {
    success: true,
    message: '',
    data: rows,
    pagination: { current_page: 1, per_page: 15, total: rows.length, last_page: 1, from: 1, to: rows.length },
    links: { first: '', last: '', prev: null, next: null },
  };
}

test('the four row lists are list queries; the game, an attempt and a preview are not', () => {
  assert.deepEqual([...QUIZ_LIST_KINDS], ['quizzes', 'my-quizzes', 'my-library', 'explore']);
  for (const kind of QUIZ_LIST_KINDS) {
    assert.equal(isQuizListQuery({ queryKey: ['channel-quiz', kind, { viewerId: 7 }] }), true, kind);
  }
  for (const kind of ['game', 'attempt', 'preview', 'quiz', 'results', 'active-game']) {
    assert.equal(isQuizListQuery({ queryKey: ['channel-quiz', kind, 'x', { viewerId: 7 }] }), false, kind);
  }
  assert.equal(isQuizListQuery({ queryKey: ['quiz', 'sessions'] }), false);
  assert.equal(isQuizListQuery({ queryKey: ['channel-quiz'] }), false);
});

test('a flat page gets the row rewritten, and comes back untouched when nothing changes', () => {
  const rows = page(quiz('a'), quiz('b', 'private'));
  const patched = withVisibility(rows, 'a', 'link');
  assert.notEqual(patched, rows);
  assert.equal(patched.data[0].visibility, 'link');
  // The other row keeps its identity.
  assert.equal(patched.data[1], rows.data[1]);
  assert.equal(withVisibility(rows, 'zzz', 'link'), rows);
  assert.equal(withVisibility(rows, 'b', 'private'), rows);
});

test('an infinite entry patches only the page holding the row and keeps the rest by identity', () => {
  const first = page(quiz('a'));
  const second = page(quiz('b'), quiz('c'));
  const entry = { pages: [first, second], pageParams: [1, 2] };
  const patched = withVisibility(entry, 'c', 'public');
  assert.notEqual(patched, entry);
  assert.equal(patched.pages[0], first);
  assert.notEqual(patched.pages[1], second);
  assert.equal(patched.pages[1].data[1].visibility, 'public');
  assert.equal(patched.pages[1].data[0], second.data[0]);
  assert.deepEqual(patched.pageParams, [1, 2]);
  assert.equal(withVisibility(entry, 'none', 'public'), entry);
});
