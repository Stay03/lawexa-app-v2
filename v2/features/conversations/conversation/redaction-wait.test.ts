import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { EngineMessage } from '@/v2/runtime/chat-engine';
import { computeStreamStart, computeTurnSentAt } from './stream-start';

/* Redacted mode, the wait before the answer (Stay, 22 October 2026: "Can we
 * have a much nicer transition when redacted mode is on cos the wait time
 * feels long"; option A). The server redacts the message inside POST /chat
 * before any stream opens, so the row says "Removing personal details…" while
 * that POST is on the wire, and its clock runs from the send. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

const at = (ms: number) => new Date(ms);
const user = (ms: number): EngineMessage => ({ id: `u${ms}`, role: 'user', content: 'q', timestamp: at(ms) }) as EngineMessage;
const answer = (ms: number): EngineMessage =>
  ({ id: `a${ms}`, role: 'assistant', content: '', timestamp: at(ms), isStreaming: true }) as EngineMessage;

test('the send time is the last question, so the redaction wait counts', () => {
  assert.equal(computeTurnSentAt([]), null);
  assert.equal(computeTurnSentAt([user(1_000)]), 1_000);
  // A later question wins over an earlier one; answers do not move it.
  assert.equal(computeTurnSentAt([user(1_000), answer(2_000), user(9_000), answer(15_000)]), 9_000);
  // The stream's own start stays where it was, for every other chat.
  assert.equal(computeStreamStart([user(9_000), answer(15_000)]), 15_000);
  assert.equal(computeStreamStart([user(9_000)]), null);
});

test('the engine marks a send until its stream opens, and never while nothing streams', () => {
  const engine = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  assert.match(engine, /turnOrigin: 'own', sending: true \}\)\);/);
  // The stream opening ends the send…
  assert.match(engine, /error: null,\s*\/\/ The stream is open: the send is over \(redaction included\)\.\s*sending: false,/);
  // …and every path that stops the stream clears it, in one place.
  assert.match(engine, /if \(next\.sending && !next\.isStreaming\) next = \{ \.\.\.next, sending: false \};/);
  assert.match(engine, /turnOrigin: null,\s*sending: false,\s*\}\);/);
  assert.match(read('v2', 'runtime', 'chat-engine', 'use-conversation-stream.ts'), /sending: snapshot\.sending,/);
});

test('a redacted chat says it is removing personal details, and times the row from the send', () => {
  const controller = read('v2', 'features', 'conversations', 'conversation', 'useConversationController.ts');
  assert.match(
    read('v2', 'features', 'conversations', 'conversation', 'redaction-wait.ts'),
    /export const REDACTING_LABEL = 'Removing personal details…';/,
  );
  assert.match(controller, /import \{ REDACTING_LABEL \} from '\.\/redaction-wait';/);
  assert.match(controller, /const redacting = isRedacted && turn\.kind === 'own' && stream\.sending;/);
  assert.match(controller, /const sentAt = isRedacted && turn\.kind === 'own' \? computeTurnSentAt\(messages\) : null;/);
  assert.match(controller, /narration: redacting \? REDACTING_LABEL : narration,/);
  const list = read('v2', 'features', 'conversations', 'conversation', 'MessageList.tsx');
  assert.match(list, /const activityStart = heldSince \?\? sentAt \?\? streamStartTime;/);
  assert.match(read('v2', 'features', 'conversations', 'conversation', 'ConversationScreen.tsx'), /sentAt=\{controller\.sentAt\}/);
});

test('a new redacted chat says the same on the home screen, where its first message is redacted', () => {
  // The first message goes through the create request on the home screen, so
  // the wait Stay saw (a document pasted into a new chat) happens there.
  const home = read('v2', 'shell', 'designs', 'HomeComposer.tsx');
  assert.match(home, /setIsSubmitting\(true\);\s*setSubmittedAt\(Date\.now\(\)\);/);
  assert.match(
    home,
    /\{isSubmitting && redacted && submittedAt !== null \? \([\s\S]{0,300}?<ActivityStatus startTime=\{submittedAt\} narration=\{REDACTING_LABEL\} \/>/,
  );
  // The wait is the box's own strip, inside PromptInput after the refusal
  // strip, never a line among the suggested prompts (Stay, 22 October 2026:
  // "it looks like a mess").
  assert.match(home, /\{blocked \? <OutOfMessagesStrip blocked=\{blocked\} \/> : null\}[\s\S]{0,900}?\{isSubmitting && redacted && submittedAt !== null \? \(/);
  // The strip says only that, with its clock (Stay, 22 October 2026: "Remove
  // that checked before the ai reads it").
  assert.doesNotMatch(home, /Checked before the AI reads it/);
  assert.doesNotMatch(home, /inline-flex rounded-full bg-background px-3 py-1\.5/);
  // The host hears of it: on Send, and again when the send is refused.
  assert.match(home, /setSubmittedAt\(Date\.now\(\)\);\s*if \(redacted\) onRedactingChange\?\.\(true\);/);
  assert.match(home, /setIsSubmitting\(false\);\s*onRedactingChange\?\.\(false\);/);
});

test('every home fades its suggested prompts while a redacted send waits', () => {
  assert.match(read('v2', 'shell', 'designs', 'home-frame.ts'), /export const CHAT_PROMPTS_HIDDEN = 'pointer-events-none opacity-0';/);
  // The one shared box reports a held send (Stay, 24 October 2026: one box
  // for Chat, Work and Study); each home's prompts read it from the context.
  assert.match(read('v2', 'shell', 'designs', 'HomeFrame.tsx'), /onRedactingChange=\{setRedacting\}/);
  for (const surface of ['ChatHome.tsx', 'WorkHome.tsx', 'StudyHome.tsx']) {
    const source = read('v2', 'shell', 'designs', surface);
    assert.match(source, /const \{ confidential, redacting \} = useHomeComposer\(\);/, surface);
    assert.match(source, /<div className=\{cn\(CHAT_PROMPTS, redacting && CHAT_PROMPTS_HIDDEN\)\} aria-hidden=\{redacting \|\| undefined\}>/, surface);
  }
});
