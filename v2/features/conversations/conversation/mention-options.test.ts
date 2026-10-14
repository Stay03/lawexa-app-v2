import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformApiMessages } from '@/lib/utils/transform-api-messages';
import { parseMessageContent } from '@/lib/utils/collab';
import { adoptServerFields } from '@/v2/runtime/chat-engine/server-fields';
import type { EngineMessage } from '@/v2/runtime/chat-engine';
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
  // Before a space already there: no second one (review of ecaf2d5, finding 5).
  assert.deepEqual(applyMention('ask @ch about it', { query: 'ch', start: 4 }, 'chidi'), {
    value: 'ask @chidi about it',
    caret: 10,
  });
  assert.deepEqual(applyMention('ask @ch', { query: 'ch', start: 4 }, 'chidi'), { value: 'ask @chidi ', caret: 11 });
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
  assert.match(composer, /if \(mentionOptions\) \{\s*detectMention\(next, textarea\(\)\?\.selectionStart \?\? next\.length\);/);
  assert.match(composer, /onKeyDown=\{handleMentionKeys\}/);
  assert.match(composer, /if \(!pickerOpen \|\| event\.nativeEvent\.isComposing\) return;/);
  assert.match(composer, /<ul id=\{listId\} role="listbox" aria-label="Mention someone">/);
  const row = readHere('rows', 'UserMessageRow.tsx');
  assert.match(row, /const mentions = useMemo\(\(\) => mentionMetadata\(message\.mentions\), \[message\.mentions\]\);/);
  assert.match(row, /\{unmatched && <p className="text-muted-foreground mt-1 text-xs">\{unmatched\}<\/p>\}/);
  assert.match(readHere('rows', 'MentionText.tsx'), /isSelfMention\(segment\.uuid, viewerUuid\) \? 'bg-primary\/20 text-foreground' : 'bg-primary\/10 text-primary'/);
});

test('the pill’s key order changed in one shared component: every caller still sends on Enter', () => {
  // Every PromptInputTextarea in the app, v1 and v2. Only the conversation
  // composer (the /c screen and the case dock) passes onKeyDown; the rest leave
  // the pill's own Enter-to-send exactly as it was.
  const callers: Record<string, string[]> = {
    'v2/shell/designs/HomeComposer.tsx': [],
    'components/ui/floating-prompt-input.tsx': [],
    'app/(main)/c/[conversationId]/conversation-client.tsx': [],
    'app/(main)/page.tsx': [],
    'v2/features/conversations/conversation/ConversationComposer.tsx': ['handleMentionKeys'],
  };
  for (const [file, handlers] of Object.entries(callers)) {
    const source = read(...file.split('/'));
    const uses = [...source.matchAll(/<PromptInputTextarea\b([\s\S]*?)\/>/g)].map((m) => m[1]);
    assert.ok(uses.length > 0, `${file} renders the pill's textarea`);
    const passed = uses.flatMap((props) => [...props.matchAll(/onKeyDown=\{(\w+)\}/g)].map((m) => m[1]));
    assert.deepEqual(passed, handlers, file);
  }
  // The one handler leaves every key alone unless the picker is on screen, and
  // only prevents Enter or Tab when it has a person to pick.
  const composer = readHere('ConversationComposer.tsx');
  const handler = composer.match(/const handleMentionKeys = [\s\S]*?\n {2}\};/)?.[0] ?? '';
  assert.match(handler, /^const handleMentionKeys = \(event: React\.KeyboardEvent<HTMLTextAreaElement>\) => \{\s*\/\/[^\n]*\n\s*if \(!pickerOpen \|\| event\.nativeEvent\.isComposing\) return;/);
  assert.match(handler, /if \(suggestions\.length > 0\) \{[\s\S]*?if \(event\.key === 'Enter' \|\| event\.key === 'Tab'\) \{\s*event\.preventDefault\(\);/);
  // And the list above is every caller: a new one has to be added and looked at.
  const found = (dir: string): string[] =>
    readdirSync(join(root, dir), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
      .map((entry) => join(entry.parentPath, entry.name).slice(root.length + 1).replace(/\\/g, '/'))
      .filter((file) => file !== 'components/ui/prompt-input.tsx' && /<PromptInputTextarea\b/.test(read(...file.split('/'))));
  assert.deepEqual([...found('app'), ...found('components'), ...found('v2')].sort(), Object.keys(callers).sort());
  // The pill: the host's handler first, and a key it prevents does not send.
  const pill = read('components', 'ui', 'prompt-input.tsx');
  assert.match(pill, /onKeyDown\?\.\(e\)\s*if \(e\.defaultPrevented\) return/);
});

test('the writer’s own question takes the server copy’s tags, keeping its own id (review finding 1)', () => {
  const at = new Date('2026-10-14T09:00:00Z');
  const drawn = { id: 'local-1', role: 'user', content: '@chidi see this', timestamp: at, drawnHere: true, savedId: 54 } as EngineMessage;
  const answer = { id: 'local-2', role: 'assistant', content: 'ok', timestamp: at } as EngineMessage;
  const serverCopy = {
    id: 'msg_54',
    role: 'user',
    content: '@chidi see this',
    timestamp: at,
    mentions: [{ uuid: 'c', name: 'Chidi Okonkwo', username: 'chidi' }],
    author: { id: 2, uuid: 'o', name: 'Ada Obi', avatar_url: null },
  } as EngineMessage;
  const rows = [drawn, answer];
  const next = adoptServerFields(rows, [serverCopy]);
  assert.notEqual(next, rows);
  assert.equal(next[0].id, 'local-1', 'the local id stays');
  assert.equal((next[0] as { drawnHere?: true }).drawnHere, true);
  assert.deepEqual((next[0] as { mentions?: unknown }).mentions, [{ uuid: 'c', name: 'Chidi Okonkwo', username: 'chidi' }]);
  assert.equal(next[1], answer, 'other rows untouched');
  // Nothing to take: the same array back, so a merge that adds nothing renders nothing.
  assert.equal(adoptServerFields(next, [serverCopy]), next);
  assert.equal(adoptServerFields(rows, []), rows);
  assert.equal(adoptServerFields([{ ...drawn, savedId: undefined } as EngineMessage], [serverCopy]).length, 1);
  // Both merges use it.
  const engine = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  assert.match(engine, /messages: \[\.\.\.adoptServerFields\(prev\.messages\.slice\(0, cutIndex\), transformed\), \.\.\.transformed\],/);
  assert.match(engine, /const enriched = adoptServerFields\(state\.messages, next\);\s*if \(added\.length === 0 && enriched === state\.messages\) return false;/);
  assert.match(engine, /messages: \[\.\.\.adoptServerFields\(prev\.messages, next\), \.\.\.added\],/);
});

test('the review of ecaf2d5 and the rendered check: what each finding changed', () => {
  // 2. A question with a pasted card still draws its tags.
  const row = readHere('rows', 'UserMessageRow.tsx');
  assert.match(row, /\{mentions \? \(\s*<MentionText content=\{remainingText\} metadata=\{mentions\} viewerUuid=\{viewerUuid\} \/>\s*\) : \(\s*remainingText\s*\)\}/);
  // 3. A caret moved without typing reads the @ there again.
  const composer = readHere('ConversationComposer.tsx');
  assert.match(composer, /onSelect=\{\(event\) => detectMention\(event\.currentTarget\.value, event\.currentTarget\.selectionStart\)\}/);
  // 4. A combobox: the list is owned and the highlight announced; no button in an option.
  assert.match(composer, /role: 'combobox',[\s\S]{0,200}?'aria-controls': listId,[\s\S]{0,120}?'aria-activedescendant':/);
  assert.match(composer, /<ul id=\{listId\} role="listbox" aria-label="Mention someone">/);
  assert.match(composer, /<li\s+key=\{candidate\.key\}\s+id=\{optionId\(index\)\}\s+role="option"/);
  // The rendered check: a jump leaves the bottom before it scrolls, so a row
  // that grows meanwhile cannot snap the view back down (?m= in Chromium).
  const list = readHere('MessageList.tsx');
  assert.match(list, /if \(!root \|\| !row\) return false;[\s\S]{0,400}?atBottomRef\.current = false;\s*if \(followRafRef\.current != null\) \{\s*cancelAnimationFrame\(followRafRef\.current\);\s*followRafRef\.current = null;\s*\}/);
});
