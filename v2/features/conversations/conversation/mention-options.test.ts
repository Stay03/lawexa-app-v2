import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformApiMessages } from '@/lib/utils/transform-api-messages';
import { parseMessageContent } from '@/lib/utils/collab';
import type { ApiMessage } from '@/types/chat';
import type { Member } from '@/types/collab';
import {
  MAX_MENTION_SUGGESTIONS,
  applyMention,
  mentionMetadata,
  mentionQueryAt,
  mentionSuggestions,
  spaceMentionOptions,
  spaceUnmatchedSentence,
  untaggableFor,
} from './mention-options';

/*
 * Tagging people in a space chat (Stay, 14 October 2026; the techlead's
 * contract of the same day). The rules are pure and tested here; the composer
 * and the rows are .tsx, which this runner does not load, so their wiring is
 * pinned in source.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..');
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8').replace(/\r\n/g, '\n');
const readHere = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

const member = (uuid: string, name: string, username: string | null, role = 'editor', active = true) =>
  ({ user: { uuid, name, username, avatar_url: null }, role, is_active: active }) as unknown as Member;
const ROSTER = [
  member('o', 'Ada Obi', 'adaobi', 'owner'),
  member('c', 'Chidi Okonkwo', 'chidi'),
  member('v', 'Bola Ade', 'bolaade', 'viewer'),
  member('n', 'Nkem Eze', null),
  member('gone', 'Left Person', 'leftp', 'editor', false),
];

test('the picker offers active members with a handle, Viewers included, and not Lawexa', () => {
  const options = spaceMentionOptions(ROSTER);
  assert.deepEqual(options.candidates.map((c) => c.handle), ['adaobi', 'chidi', 'bolaade']);
  assert.deepEqual(options.untaggable, ['Nkem Eze']);
  assert.equal(options.candidates.some((c) => c.handle === 'lawexa'), false);
});

test('an @ after a space or at the start opens the picker; an e-mail address does not', () => {
  assert.deepEqual(mentionQueryAt('@ch', 3), { query: 'ch', start: 0 });
  assert.deepEqual(mentionQueryAt('ask @Chi', 8), { query: 'chi', start: 4 });
  assert.deepEqual(mentionQueryAt('ask @', 5), { query: '', start: 4 });
  assert.equal(mentionQueryAt('mail a@b.com', 12), null);
  assert.equal(mentionQueryAt('ask @chidi now', 14), null, 'the caret is past the tag');
  // Read at the caret, not the end of the text.
  assert.deepEqual(mentionQueryAt('ask @ch and more', 7), { query: 'ch', start: 4 });
});

test('the picker matches handle or name, and names the untaggable it matches', () => {
  const options = spaceMentionOptions(ROSTER);
  assert.deepEqual(mentionSuggestions(options, 'ok').map((c) => c.handle), ['chidi'], 'Okonkwo, by name');
  assert.deepEqual(mentionSuggestions(options, 'bola').map((c) => c.handle), ['bolaade']);
  assert.equal(mentionSuggestions(options, '').length, 3);
  assert.equal(untaggableFor(options, 'nk'), "Nkem Eze can't be tagged yet — no handle.");
  assert.equal(untaggableFor(options, 'chi'), '');
  const many = spaceMentionOptions(Array.from({ length: 10 }, (_, i) => member(`u${i}`, `Person ${i}`, `p${i}`)));
  assert.equal(mentionSuggestions(many, 'p').length, MAX_MENTION_SUGGESTIONS);
});

test('picking a person writes their handle and a space, and the caret follows it', () => {
  assert.deepEqual(applyMention('ask @ch about it', { query: 'ch', start: 4 }, 'chidi'), {
    value: 'ask @chidi  about it',
    caret: 11,
  });
  assert.deepEqual(applyMention('@', { query: '', start: 0 }, 'adaobi'), { value: '@adaobi ', caret: 8 });
});

test('the writer is told which @s matched nobody in the space', () => {
  assert.equal(spaceUnmatchedSentence([]), '');
  assert.equal(spaceUnmatchedSentence(['bola']), "@bola didn't match anyone in this space.");
  assert.equal(spaceUnmatchedSentence(['a', 'b', 'a']), "@a and @b didn't match anyone in this space.");
  assert.equal(spaceUnmatchedSentence(['a', 'b', 'c', 'd', 'e']), "@a, @b, @c and 2 others didn't match anyone in this space.");
});

test('a tag the server resolved becomes a chip; a reader outside the space gets plain names', () => {
  const meta = mentionMetadata([{ uuid: 'c', name: 'Chidi Okonkwo', username: 'chidi' }]);
  assert.ok(meta);
  const segments = parseMessageContent('@chidi can you check this? cc @nobody', meta);
  assert.deepEqual(
    segments.filter((s) => s.type === 'mention').map((s) => s.type === 'mention' && s.label),
    ['Chidi Okonkwo'],
  );
  assert.equal(segments.some((s) => s.type === 'text' && s.value.includes('@nobody')), true, 'an unresolved @ stays text');
  // Outsiders: names only (no uuid), and the text already says "@Chidi Okonkwo".
  assert.equal(mentionMetadata([{ name: 'Chidi Okonkwo' }]), null);
  assert.equal(mentionMetadata([]), null);
  assert.equal(mentionMetadata(undefined), null);
});

test('a question keeps its tags and the writer’s unmatched handles from the server', () => {
  const row = (id: number, over: Partial<ApiMessage>): ApiMessage => ({
    id,
    conversation_id: 'c1',
    agent_id: null,
    role: 'user',
    content: '@chidi see this',
    metadata: {},
    created_at: '2026-10-14T09:00:00Z',
    ...over,
  });
  const [tagged, plain] = transformApiMessages([
    row(1, { mentions: [{ uuid: 'c', name: 'Chidi Okonkwo', username: 'chidi' }], unmatched_handles: ['bola'] }),
    row(2, { mentions: [] }),
  ]);
  assert.deepEqual(tagged.mentions, [{ uuid: 'c', name: 'Chidi Okonkwo', username: 'chidi' }]);
  assert.deepEqual(tagged.unmatchedHandles, ['bola']);
  assert.equal('mentions' in plain, false);
  assert.equal('unmatchedHandles' in plain, false);
});

test('the wiring: the picker in a space chat, chips in the bubble, the writer’s line under it', () => {
  // The pill lets the host take Enter first: a picked person, not a send.
  const pill = read('components', 'ui', 'prompt-input.tsx');
  assert.match(pill, /const handleKeyDown = \(e: React\.KeyboardEvent<HTMLTextAreaElement>\) => \{\s*onKeyDown\?\.\(e\)\s*if \(e\.defaultPrevented\) return\s*if \(e\.key === "Enter" && !e\.shiftKey && !isMobile\) \{/);
  // The writer's line shows at once, from the send's answer.
  const engine = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  assert.match(engine, /const unmatched = response\.data\.unmatched_handles;\s*if \(unmatched && unmatched\.length > 0\) \{\s*setMessages\(\(msgs\) =>\s*msgs\.map\(\(m\) => \(m\.id === optimisticMsg\.id \? \{ \.\.\.m, unmatchedHandles: unmatched \} : m\)\),/);
  const controller = readHere('useConversationController.ts');
  assert.match(controller, /\(\) => \(showAuthors && rosterRows \? spaceMentionOptions\(rosterRows\) : null\),/);
  assert.match(readHere('ConversationScreen.tsx'), /mentionOptions=\{controller\.mentionOptions\}/);
  const composer = readHere('ConversationComposer.tsx');
  assert.match(composer, /if \(mentionOptions\) \{\s*setMention\(mentionQueryAt\(next, textarea\(\)\?\.selectionStart \?\? next\.length\)\);/);
  assert.match(composer, /onKeyDown=\{handleMentionKeys\}/);
  assert.match(composer, /if \(!pickerOpen \|\| event\.nativeEvent\.isComposing\) return;/);
  assert.match(composer, /<ul role="listbox" aria-label="Mention someone">/);
  const row = readHere('rows', 'UserMessageRow.tsx');
  assert.match(row, /const mentions = useMemo\(\(\) => mentionMetadata\(message\.mentions\), \[message\.mentions\]\);/);
  assert.match(row, /\{unmatched && <p className="text-muted-foreground mt-1 text-xs">\{unmatched\}<\/p>\}/);
  assert.match(readHere('rows', 'MentionText.tsx'), /isSelfMention\(segment\.uuid, viewerUuid\) \? 'bg-primary\/20 text-foreground' : 'bg-primary\/10 text-primary'/);
});
