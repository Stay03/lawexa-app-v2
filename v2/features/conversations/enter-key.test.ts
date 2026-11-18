import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { TOUCH_ONLY_ENTER_SENDS, enterOutcome } from '@/lib/utils/enter-key';

/* One Enter rule for every chat box (Arthur, 18 November 2026, thread
 * 8282ffe7, option 1: a computer's Enter sends; a phone's return adds a line
 * and the send button sends). TEST DATA free. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
const key = (over: Partial<{ key: string; shiftKey: boolean; isComposing: boolean; keyCode: number }> = {}) => ({
  key: 'Enter',
  shiftKey: false,
  isComposing: false,
  ...over,
});

test('Arthur’s option 1: a keyboard sends, a touch-only device adds a line', () => {
  assert.equal(TOUCH_ONLY_ENTER_SENDS, false);
  assert.equal(enterOutcome(key(), false), 'send');
  assert.equal(enterOutcome(key(), true), 'newline');
});

test('Shift+Enter is always a new line, and Cmd or Ctrl+Enter sends like Enter', () => {
  assert.equal(enterOutcome(key({ shiftKey: true }), false), 'newline');
  assert.equal(enterOutcome(key({ shiftKey: true }), true), 'newline');
  assert.equal(enterOutcome(key(), false), 'send', 'the modifier keys are not looked at');
});

test('a word still being composed is never sent', () => {
  assert.equal(enterOutcome(key({ isComposing: true }), false), 'ignore');
  assert.equal(enterOutcome(key({ keyCode: 229 }), false), 'ignore', 'older Safari and some Android keyboards');
});

test('other keys are left alone, and the one switch makes a phone send too', () => {
  assert.equal(enterOutcome(key({ key: 'a' }), false), 'ignore');
  assert.equal(enterOutcome(key({ key: 'Tab' }), false), 'ignore');
  assert.equal(enterOutcome(key(), true, true), 'send', 'TOUCH_ONLY_ENTER_SENDS = true');
});

test('every chat box uses the one rule; none measures the window', () => {
  const prompt = read('components', 'ui', 'prompt-input.tsx');
  assert.match(prompt, /if \(sendsOnEnter\(e\)\) onSubmit\?\.\(\)/, 'new chat, conversation, Space chat, case and statute chat');
  assert.doesNotMatch(prompt, /useIsMobile/, 'the window’s width plays no part');
  assert.match(read('v2', 'features', 'channels', 'composer', 'ChannelComposer.tsx'), /if \(sendsOnEnter\(event\)\) handleSend\(\);/, 'channels, threads and task chat');
  assert.match(read('v2', 'features', 'conversations', 'conversation', 'agents', 'AgentConversationPanel.tsx'), /if \(sendsOnEnter\(event\)\) submit\(\);/, 'the agent panel');
  assert.match(read('v2', 'features', 'channels', 'feed', 'MessageRow.tsx'), /if \(sendsOnEnter\(event\)\) saveEdit\(\);/, 'editing a message');
});
