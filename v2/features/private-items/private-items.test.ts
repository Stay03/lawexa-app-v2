import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { privateItemAnswerLine, refusalLine, skillProblems, splitUpload, templateDetail, templateStatusLine, usedItemLine } from './model';
import { transformApiMessages } from '@/lib/utils/transform-api-messages';
import type { ApiMessage, ChatMessage } from '@/types/chat';

/* A person's own templates and skills, and a firm's (Stay, thread 9ae498ae,
 * 18 and 19 November 2026; Backend's contract, 19 November). TEST DATA only. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
const file = (name: string, size = 1000) => ({ name, size }) as File;

test('a template says how far Lawexa got reading it, and what file is behind it', () => {
  assert.equal(templateStatusLine('processing', null), 'Reading');
  assert.equal(templateStatusLine('live', null), 'Ready');
  assert.equal(templateStatusLine('failed', 'The file has no text.'), 'Couldn’t read it: The file has no text.');
  assert.equal(templateStatusLine('failed', null), 'Couldn’t read it');
  assert.equal(templateDetail({ original_name: 'TEST DATA notice.docx', size: 49_152 }, 6), 'TEST DATA notice.docx · 48 KB · 6 blanks');
  assert.equal(templateDetail({ original_name: 'a.pdf', size: 2048 }, 1), 'a.pdf · 2 KB · 1 blank');
  assert.equal(templateDetail({ original_name: 'a.pdf', size: 2048 }, null), 'a.pdf · 2 KB');
  assert.equal(templateDetail(null, 7), '7 blanks', 'a template with no stored file still says its blanks');
  assert.equal(templateDetail(null, null), '');
});

test('the picker refuses what the server would, and names each refused file', () => {
  const { accepted, refused, overCount } = splitUpload([
    file('TEST DATA lease.docx'),
    file('notes.txt'),
    file('big.pdf', 21 * 1024 * 1024),
    file('old.DOC'),
    file('memo.rtf'),
  ]);
  assert.deepEqual(accepted.map((f) => f.name), ['TEST DATA lease.docx', 'old.DOC', 'memo.rtf']);
  assert.deepEqual(refused, [
    { original_name: 'notes.txt', reason: 'type' },
    { original_name: 'big.pdf', reason: 'size' },
  ]);
  assert.equal(overCount, false);
  const eleven = splitUpload(Array.from({ length: 11 }, (_, i) => file(`t${i}.pdf`)));
  assert.equal(eleven.accepted.length, 10, 'ten go at a time');
  assert.equal(eleven.overCount, true);
  assert.equal(refusalLine('notes.txt', 'type'), 'notes.txt wasn’t added: only Word, RTF or PDF files can be templates.');
  assert.equal(refusalLine('a.pdf', 'duplicate'), 'a.pdf wasn’t added: it is already one of your templates.');
});

test('a skill needs a name, one line and steps, within the server’s limits', () => {
  assert.deepEqual(skillProblems({ display_name: '', description: ' ', instructions: '' }), {
    display_name: 'Give the skill a name.',
    description: 'Say in one line what the skill is for.',
    instructions: 'Write the steps Lawexa should follow.',
  });
  assert.deepEqual(skillProblems({ display_name: 'TEST DATA review', description: 'Checks a notice', instructions: '1. Read it.' }), {});
  assert.equal(skillProblems({ display_name: 'x', description: 'y'.repeat(301), instructions: 'z' }).description, 'Keep this to 300 characters or fewer.');
});

test('the line under an answer: the owner sees the name, everyone else only whose it was', () => {
  const item = { kind: 'template' as const, owner: { uuid: 'ada', name: 'TEST DATA Ada' }, name: 'Tenancy notice' };
  assert.equal(usedItemLine(item, 'ada'), 'Used your Tenancy notice template');
  assert.equal(usedItemLine({ ...item, name: null }, 'kemi'), 'Used a template from TEST DATA Ada');
  assert.equal(usedItemLine({ ...item, kind: 'skill', name: null }, null), 'Used a skill from TEST DATA Ada');
});

test('the last answer of each turn carries its turn, and an answer carries the items it used', () => {
  const at = '2026-11-19T10:00:00Z';
  const rows = [
    { id: 1, conversation_id: 'c', agent_id: null, role: 'user', content: 'TEST DATA draft the notice', metadata: {}, created_at: at },
    { id: 2, conversation_id: 'c', agent_id: null, role: 'assistant', content: 'TEST DATA. Reading the file.', metadata: { execution_id: 'turn-1' }, created_at: at },
    {
      id: 3,
      conversation_id: 'c',
      agent_id: null,
      role: 'assistant',
      content: 'A choice is waiting for TEST DATA Ada.',
      metadata: { execution_id: 'turn-1' },
      created_at: at,
    },
    {
      id: 4,
      conversation_id: 'c',
      agent_id: null,
      role: 'assistant',
      content: 'TEST DATA. Here is the notice.',
      metadata: { execution_id: 'turn-2' },
      used_private_items: [{ kind: 'template', owner: { uuid: 'ada', name: 'TEST DATA Ada' }, name: null }],
      created_at: at,
    },
  ] as unknown as ApiMessage[];
  const out = transformApiMessages(rows) as ChatMessage[];
  const row = (id: string) => out.find((m) => m.id === id);
  assert.equal(row('msg_3')?.turnId, 'turn-1', 'the card sits under the last answer of the turn that asked');
  assert.equal(row('msg_2')?.turnId, undefined, 'never twice for one turn');
  assert.equal(row('msg_4')?.usedPrivateItems?.[0]?.owner.name, 'TEST DATA Ada');
  assert.equal(row('msg_1')?.turnId, undefined);
});

test('a final reply with no execution_id of its own takes the turn of the steps before it', () => {
  const at = '2026-11-19T06:29:47Z';
  const rows = [
    { id: 5, conversation_id: 'c', agent_id: null, role: 'user', content: 'TEST DATA Draft a notice to quit', metadata: {}, created_at: at },
    { id: 6, conversation_id: 'c', agent_id: null, role: 'assistant', content: '{"tool_call":"search_templates","parameters":{}}', metadata: { type: 'tool_call', execution_id: 'turn-7' }, created_at: at },
    { id: 7, conversation_id: 'c', agent_id: null, role: 'tool', content: '{"success":true}', metadata: { type: 'tool_result', execution_id: 'turn-7' }, created_at: at },
    { id: 10, conversation_id: 'c', agent_id: null, role: 'assistant', content: 'TEST DATA. A choice is waiting for you.', metadata: null, created_at: at },
  ] as unknown as ApiMessage[];
  const out = transformApiMessages(rows) as ChatMessage[];
  assert.equal(out.find((m) => m.id === 'msg_10')?.turnId, 'turn-7', 'the card sits under the reply, not under a step');
});

test('the wiring: Settings rows, routes, the chat card, the skill card, the file chip and the firm list', () => {
  const rows = read('v2', 'features', 'settings', 'rows.ts');
  assert.match(rows, /id: 'templates-skills',\s*label: 'Templates and skills',/);
  assert.match(rows, /href: '\/settings\/templates',/);
  assert.match(rows, /href: '\/settings\/skills',/);
  const manifest = read('v2', 'routes.manifest.ts');
  assert.match(manifest, /'\/settings\/templates',\n\s*'\/settings\/skills',/);

  const ask = read('v2', 'features', 'private-items', 'PrivateItemAsk.tsx');
  assert.match(ask, /\{ choice: 'once', label: 'Just this time' \},\s*\{ choice: 'always', label: 'Always in this Space' \},\s*\{ choice: 'no', label: 'No' \},/);
  assert.match(ask, /Only you see this\. Others see Lawexa&rsquo;s answer, not your/);
  assert.match(ask, /if \(result\.resumed\?\.execution_id\) chat\?\.followResumedTurn\(result\.resumed\.execution_id\);/, 'a yes follows the new turn');
  assert.match(ask, /request\.status === 'pending' && request\.execution_id === turnId/, 'under the reply whose turn asked');
  assert.match(ask, /chatRequests\(conversationId, conversationId !== '' && chat\?\.inSpace === true\)/, 'asked in Space chats only');
  assert.match(read('v2', 'features', 'private-items', 'queries.ts'), /refetchOnMount: 'always',/, 'a new reply reads the requests again, push or no push');

  const card = read('v2', 'features', 'conversations', 'conversation', 'skill-draft', 'SkillDraftCard.tsx');
  assert.match(card, /const canKeep = card\.kind === 'new';/, 'a change to a Lawexa skill can only go to an admin');
  assert.match(card, /\n\s*Save to my skills\n/);
  assert.match(card, /\n\s*Send to admin\n/);

  const sent = read('v2', 'features', 'conversations', 'conversation', 'rows', 'SentAttachments.tsx');
  assert.match(sent, /\{keepable && isTemplateFile\(document\) \? <KeepAsTemplate document=\{document\} \/> : null\}/);
  assert.match(read('v2', 'features', 'conversations', 'conversation', 'rows', 'UserMessageRow.tsx'), /keepable=\{turnSide\(message, viewerId\) === 'mine'\}/, 'only the sender keeps their file');

  assert.match(read('v2', 'features', 'organizations', 'OrganizationScreen.tsx'), /<FirmTemplates organizationUuid=\{organization\.uuid\} canManage=\{canManage\} \/>/);
  const spine = read('v2', 'runtime', 'realtime', 'spine.tsx');
  assert.match(spine, /channel\.listen\(EVT_PRIVATE_ITEM_REQUESTED, readRequests\);/);
  assert.match(spine, /channel\.listen\(EVT_MY_TEMPLATE_UPDATED,/);
});

test('the owner’s yes is a quiet line: "You" for the owner, the name for everyone else, never the item', () => {
  assert.equal(privateItemAnswerLine({ choice: 'once', kind: 'template' }, { name: 'TEST DATA Ada', mine: true }), 'You let Lawexa use your template just this time');
  assert.equal(
    privateItemAnswerLine({ choice: 'always', kind: 'skill' }, { name: 'TEST DATA Ada', mine: false }),
    'TEST DATA Ada let Lawexa use one of their skills in this Space from now on',
  );
  const at = '2026-11-19T07:46:00Z';
  const out = transformApiMessages([
    { id: 11, conversation_id: 'c', agent_id: null, role: 'user', content: '[Lawexa instruction]', metadata: { type: 'private_item_answer', choice: 'always', item_kind: 'template', execution_id: 'x' }, created_at: at },
  ] as unknown as ApiMessage[]) as ChatMessage[];
  assert.deepEqual(out[0]?.privateItemAnswer, { choice: 'always', kind: 'template' });
  assert.match(read('v2', 'features', 'conversations', 'conversation', 'rows', 'UserMessageRow.tsx'), /if \(message\.privateItemAnswer\) \{/, 'drawn as a line, its text never shown');
});
