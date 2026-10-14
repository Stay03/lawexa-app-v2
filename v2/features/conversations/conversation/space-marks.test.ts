import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChatMessage } from '@/types/chat';
import type { MessageGroup } from './message-groups';
import { clockTime, dayLabel, isNewDay } from './day-label';
import { spaceMarks } from './space-marks';

/* Date separators and Lawexa's mark in a space chat (Arthur's layout, 14
 * October 2026), the techlead's case (e): a chat that crosses midnight. */

const msg = (role: 'user' | 'assistant', at: Date): MessageGroup => ({
  type: 'single',
  message: { id: `${role}-${at.getTime()}`, role, content: 'x', timestamp: at } as ChatMessage,
});

test('(e) a chat that crosses midnight gets a separator for each day', () => {
  const late = new Date(2026, 9, 13, 23, 50);
  const answer = new Date(2026, 9, 13, 23, 51);
  const early = new Date(2026, 9, 14, 0, 10);
  const marks = spaceMarks([msg('user', late), msg('assistant', answer), msg('user', early)]);
  assert.deepEqual(marks.map((m) => m.day), [late, null, early]);
  // Read on the 14th at noon.
  const noon = new Date(2026, 9, 14, 12, 0).getTime();
  assert.equal(dayLabel(late, noon), 'Yesterday');
  assert.equal(dayLabel(early, noon), 'Today');
  assert.equal(dayLabel(new Date(2026, 9, 10, 9, 0), noon), 'Sat 10 Oct');
  assert.equal(dayLabel(new Date(2025, 11, 31, 9, 0), noon), 'Wed 31 Dec 2025');
  // Before the clock is known (the server's render), the date, never a wrong "Today".
  assert.equal(dayLabel(early, 0), 'Wed 14 Oct 2026');
});

test('an answer is marked as Lawexa’s once, where it starts', () => {
  const t = (m: number) => new Date(2026, 9, 14, 10, m);
  const groups: MessageGroup[] = [
    msg('user', t(30)),
    { type: 'tool-chain', messages: [{ id: 'tool', role: 'tool', content: '', timestamp: t(31) } as never] },
    msg('assistant', t(32)),
    msg('user', t(33)),
    msg('assistant', t(34)),
  ];
  assert.deepEqual(spaceMarks(groups).map((m) => m.answer), [null, t(31), null, null, t(34)]);
});

test('times read as the reader’s clock; a new day is a local one', () => {
  assert.equal(clockTime(new Date(2026, 9, 14, 10, 36)), '10:36 AM');
  assert.equal(clockTime(new Date(2026, 9, 14, 0, 5)), '12:05 AM');
  assert.equal(isNewDay(null, new Date()), true);
  assert.equal(isNewDay(new Date(2026, 9, 14, 0, 1), new Date(2026, 9, 14, 23, 59)), false);
});
