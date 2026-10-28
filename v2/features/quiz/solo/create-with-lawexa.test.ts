import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ASK_PARAM, askHref, queueAsk, QUIZ_ASK_PROMPT, readAsk } from '@/v2/shell/designs/composer/ask-param';

/* "Create with Lawexa" (Arthur, 28 October 2026): a new quiz opens on a
 * choice, Lawexa first, "Create manually" second. Lawexa's button opens a chat
 * whose box holds "Make me a quiz on ", focused, never sent: the home's, or a
 * channel's Space's. Pinned by source where it is markup. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test('a link carries the words in ?ask=, encoded, to the home or a Space', () => {
  assert.equal(ASK_PARAM, 'ask');
  assert.equal(QUIZ_ASK_PROMPT, 'Make me a quiz on ');
  assert.equal(askHref({ kind: 'home' }, QUIZ_ASK_PROMPT), '/?ask=Make%20me%20a%20quiz%20on%20');
  assert.equal(askHref({ kind: 'space', spaceUuid: 'space-1' }, 'a & b'), '/spaces/space-1?ask=a%20%26%20b');
});

test('a tap queues the words for the box it names, and no other box takes them', () => {
  const saved = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = { location: { search: '' } };
  try {
    queueAsk({ kind: 'space', spaceUuid: 'space-1' }, QUIZ_ASK_PROMPT);
    assert.equal(readAsk({ kind: 'space', spaceUuid: 'space-1' }), QUIZ_ASK_PROMPT);
    assert.equal(readAsk({ kind: 'space', spaceUuid: 'space-2' }), null);
    assert.equal(readAsk({ kind: 'home' }), null);
    // A link opened in a new tab has only the address.
    (globalThis as { window?: unknown }).window = { location: { search: '?ask=Make%20me%20a%20quiz%20on%20' } };
    assert.equal(readAsk({ kind: 'home' }), QUIZ_ASK_PROMPT);
  } finally {
    (globalThis as { window?: unknown }).window = saved;
  }
});

test('the box takes the words as it mounts, is focused after them, and the address drops them', () => {
  const param = read('v2', 'shell', 'designs', 'composer', 'ask-param.ts');
  assert.match(param, /textarea\.focus\(\);\s*textarea\.setSelectionRange\(textarea\.value\.length, textarea\.value\.length\);/);
  assert.match(param, /url\.searchParams\.delete\(ASK_PARAM\);\s*window\.history\.replaceState\(/);
  // Never sent for the reader.
  assert.doesNotMatch(param, /submit|send\(/i);
  // The home: the words before the saved draft, then kept as the draft.
  const draft = read('v2', 'shell', 'designs', 'composer', 'useComposerDraft.ts');
  assert.match(draft, /const ask = readAsk\(\{ kind: 'home' \}\);\s*if \(ask\) return ask;\s*try \{\s*return window\.localStorage\.getItem\(DRAFT_KEY\)/);
  assert.match(read('v2', 'shell', 'designs', 'HomeFrame.tsx'), /useAskArrival\(areaRef, HOME_ASK\);/);
  // A Space: its own box, never the home's draft.
  const dock = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceChatDock.tsx');
  assert.match(dock, /useAskArrival\(box, \{ kind: 'space', spaceUuid: space\.uuid \}\);/);
  assert.match(dock, /<div ref=\{box\} data-space-chat-dock=""/);
});

test('a new quiz opens on the choice, an edit on the form, and the choice has nothing else', () => {
  const form = read('v2', 'features', 'channels', 'quiz', 'QuizFormDialog.tsx');
  assert.match(form, /const \[manual, setManual\] = useState\(false\);\s*const choosing = !isEdit && !manual;/);
  assert.match(form, /'Let Lawexa create a quiz on any topic or from your study material\.'/);
  assert.match(form, /footer=\{\s*choosing \? undefined : \(/);
  // The home's chat, or for a channel's quiz its Space's.
  assert.match(form, /chat=\{room && spaceUuid \? \{ kind: 'space', spaceUuid \} : \{ kind: 'home' \}\}/);
  assert.match(read('v2', 'features', 'channels', 'quiz', 'QuizLibrarySheet.tsx'), /spaceUuid=\{channel\.space\.uuid\}/);
  const choice = form.slice(form.indexOf('function QuizCreateChoice'), form.indexOf('function SettingRow'));
  // The tap queues the words: Next draws the chat before the address changes.
  assert.match(choice, /<Link href=\{askHref\(chat, QUIZ_ASK_PROMPT\)\} onClick=\{\(\) => queueAsk\(chat, QUIZ_ASK_PROMPT\)\}>/);
  assert.match(choice, /Create with Lawexa/);
  assert.match(choice, /variant="ghost"[\s\S]*onClick=\{onManual\}[\s\S]*Create manually/);
  // Two buttons: no card, no border, no picture.
  assert.doesNotMatch(choice, /border|rounded-|shadow|<img/);
  // "Create manually" lands on the title.
  assert.match(form, /autoFocus=\{manual\}/);
});
