import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readCommand } from './commands';

/* Spoken commands: only the last words before a pause act. TEST DATA. */

test('a settled segment ending in "send" sends, and the word leaves the message', () => {
  assert.deepEqual(readCommand('Is the landlord liable for the repairs? Send.'), { command: 'send', text: 'Is the landlord liable for the repairs?' });
  assert.deepEqual(readCommand('Send it'), { command: 'send', text: '' });
  assert.deepEqual(readCommand("That's all. I'm done, send."), { command: 'send', text: "That's all." });
  assert.deepEqual(readCommand('and the deposit. End dictation.'), { command: 'send', text: 'and the deposit.' });
  assert.deepEqual(readCommand('That’s it, send it.'), { command: 'send', text: '' });
});

test('"send" mid-sentence is words, never a command', () => {
  assert.deepEqual(readCommand('Send the letter to my landlord tomorrow.'), { command: null, text: 'Send the letter to my landlord tomorrow.' });
  assert.deepEqual(readCommand('Should I send the notice first?'), { command: null, text: 'Should I send the notice first?' });
  assert.equal(readCommand('He was sent home.').command, null);
});

test('pause and cancel act the same way, as the last words', () => {
  assert.deepEqual(readCommand('Let me find the date. Pause.'), { command: 'pause', text: 'Let me find the date.' });
  assert.deepEqual(readCommand('Cancel dictation'), { command: 'cancel', text: '' });
  assert.equal(readCommand('The court may pause.').command, 'pause', 'a segment that truly ends in "pause" pauses; pausing loses nothing');
  assert.equal(readCommand('The court may pause the case.').command, null);
  assert.equal(readCommand('Pause the hearing until Monday.').command, null);
});

test('a question that really ends in "send" is read as a command: the Undo covers it', () => {
  // The known case from the research: the message ends with the word itself.
  assert.deepEqual(readCommand('Which form should I send?'), { command: 'send', text: 'Which form should I' });
});
