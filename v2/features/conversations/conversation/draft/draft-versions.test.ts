import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { draftOffsets } from './draft-ordinals';
import {
  answerDraftKeys,
  draftGroupKey,
  draftVersion,
  draftVersionIndex,
  draftVersionLabel,
  draftVersionTitle,
} from './draft-versions';

/* Draft versions (Stay, 27 October 2026, thread 4531c708, option B): a draft
 * Lawexa writes again after a change is "Version 2" of the same draft. Step 1
 * groups by title; step 2 swaps the key for the tag's fixed id. TEST DATA
 * throughout. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
const code = (...parts: string[]) =>
  read(...parts).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const DRAFT_DIR = ['v2', 'features', 'conversations', 'conversation', 'draft'];

const draft = (title: string, body = 'TEST DATA body.') => `<draft title="${title}">\n${body}\n</draft>`;

const MESSAGES = [
  { id: 'u1', role: 'user', content: 'TEST DATA. Draft me a tenancy agreement.' },
  { id: 'a1', role: 'assistant', content: `Here it is.\n${draft('Tenancy Agreement')}` },
  { id: 'u2', role: 'user', content: 'TEST DATA. Make the rent monthly, and write a notice letter too.' },
  {
    id: 'a2',
    role: 'assistant',
    content: `${draft('Tenancy  agreement ', 'TEST DATA monthly rent.')}\nAnd the letter:\n${draft('Notice to Quit')}`,
  },
  { id: 'u3', role: 'user', content: 'TEST DATA. Make it a two-year term.' },
  { id: 'a3', role: 'assistant', content: draft('Tenancy Agreement', 'TEST DATA two-year term.') },
];

test('drafts with the same title in one chat are one draft, whatever the case or spacing', () => {
  assert.equal(draftGroupKey({ title: 'Tenancy Agreement' }), draftGroupKey({ title: '  tenancy   AGREEMENT ' }));
  assert.notEqual(draftGroupKey({ title: 'Tenancy Agreement' }), draftGroupKey({ title: 'Notice to Quit' }));
});

test('drafts with the same fixed id are one draft even when the title changes', () => {
  const withId = (title: string, id: string, version: number) =>
    `<draft title="${title}" id="${id}" version="${version}">\nTEST DATA body.\n</draft>`;
  const messages = [
    { id: 'a1', role: 'assistant', content: withId('TEST DATA Tenancy Agreement', 'k3f9q2', 1) },
    { id: 'a2', role: 'assistant', content: withId('TEST DATA Monthly Tenancy Agreement', 'k3f9q2', 2) },
    // A different draft that happens to share the first one's title.
    { id: 'a3', role: 'assistant', content: withId('TEST DATA Tenancy Agreement', 'p7w2m1', 1) },
  ];
  const index = draftVersionIndex(messages);
  assert.deepEqual(
    index.map((entry) => entry.key),
    ['id:k3f9q2', 'id:k3f9q2', 'id:p7w2m1'],
  );
  assert.deepEqual(draftVersion(index, 1, 'id:k3f9q2'), { version: 2, count: 2, ordinals: [0, 1], latest: true, superseded: false });
  assert.equal(draftVersion(index, 2, 'id:p7w2m1').count, 1);
});

test('a draft with no id, or one that is not valid, groups by its title', () => {
  const title = draftGroupKey({ title: 'TEST DATA Notice to Quit' });
  assert.equal(draftGroupKey({ title: 'TEST DATA Notice to Quit', id: null }), title);
  const messages = [
    { id: 'a1', role: 'assistant', content: draft('TEST DATA Notice to Quit') },
    // Bad characters, and longer than 12: both ignored, so these group by title.
    { id: 'a2', role: 'assistant', content: '<draft title="TEST DATA Notice to Quit" id="k3f-q2">\nTEST DATA.\n</draft>' },
    { id: 'a3', role: 'assistant', content: '<draft title="TEST DATA Notice to Quit" id="abcdefghijklm">\nTEST DATA.\n</draft>' },
  ];
  const index = draftVersionIndex(messages);
  assert.deepEqual(
    index.map((entry) => entry.key),
    [title, title, title],
  );
  assert.equal(draftVersion(index, 2, title).version, 3);
});

test('the index counts drafts the way the ordinals do', () => {
  const index = draftVersionIndex(MESSAGES);
  assert.deepEqual(
    index.map((entry) => entry.ordinal),
    [0, 1, 2, 3],
  );
  // Each answer's first draft sits at its offset (draft-ordinals.ts).
  const offsets = draftOffsets(MESSAGES);
  assert.equal(index[offsets.get('a2') ?? -1].key, draftGroupKey({ title: 'Tenancy Agreement' }));
  assert.equal(index[offsets.get('a3') ?? -1].key, draftGroupKey({ title: 'Tenancy Agreement' }));
});

test('each draft knows its version, how many there are, and whether a newer one follows', () => {
  const index = draftVersionIndex(MESSAGES);
  const tenancy = draftGroupKey({ title: 'Tenancy Agreement' });
  assert.deepEqual(draftVersion(index, 0, tenancy), { version: 1, count: 3, ordinals: [0, 1, 3], latest: false, superseded: true });
  assert.deepEqual(draftVersion(index, 1, tenancy), { version: 2, count: 3, ordinals: [0, 1, 3], latest: false, superseded: true });
  assert.deepEqual(draftVersion(index, 3, tenancy), { version: 3, count: 3, ordinals: [0, 1, 3], latest: true, superseded: false });
  const notice = draftVersion(index, 2, draftGroupKey({ title: 'Notice to Quit' }));
  assert.deepEqual(notice, { version: 1, count: 1, ordinals: [2], latest: true, superseded: false });
});

test('a version cut off when Lawexa was stopped never greys the finished one before it', () => {
  const messages = [
    { id: 'a1', role: 'assistant', content: '<draft title="TEST DATA Lease" id="k3f9q2" version="1">\nTEST DATA one.\n</draft>' },
    { id: 'a2', role: 'assistant', content: '<draft title="TEST DATA Lease" id="k3f9q2" version="2">\nTEST DATA two.\n</draft>' },
    // Stopped halfway: no closing tag.
    { id: 'a3', role: 'assistant', content: '<draft title="TEST DATA Lease" id="k3f9q2" version="3">\nTEST DATA thr' },
  ];
  const index = draftVersionIndex(messages);
  assert.deepEqual(index.map((entry) => entry.finished), [true, true, false]);
  assert.equal(draftVersion(index, 0, 'id:k3f9q2').superseded, true);
  assert.equal(draftVersion(index, 1, 'id:k3f9q2').superseded, false);
  assert.equal(draftVersion(index, 2, 'id:k3f9q2').superseded, false);
  // It still counts as a version, and is the last one.
  assert.equal(draftVersion(index, 2, 'id:k3f9q2').count, 3);
});

test('a draft still being written is placed after the saved versions of its group', () => {
  // The streaming answer's text is not in `content` yet, so it is not indexed.
  const index = draftVersionIndex(MESSAGES);
  const streaming = draftVersion(index, 4, draftGroupKey({ title: 'Tenancy Agreement' }));
  assert.deepEqual(streaming, { version: 4, count: 4, ordinals: [0, 1, 3, 4], latest: true, superseded: false });
  assert.equal(draftVersion(index, 4, draftGroupKey({ title: 'A New Lease' })).count, 1);
});

test('a draft with one version reads as today; with more, "Version N" and its own save and file name', () => {
  const index = draftVersionIndex(MESSAGES);
  const one = draftVersion(index, 2, draftGroupKey({ title: 'Notice to Quit' }));
  const second = draftVersion(index, 1, draftGroupKey({ title: 'Tenancy Agreement' }));
  assert.equal(draftVersionLabel(one), null);
  assert.equal(draftVersionLabel(null), null);
  assert.equal(draftVersionLabel(second), 'Version 2');
  assert.equal(draftVersionTitle('Notice to Quit', one), 'Notice to Quit');
  assert.equal(draftVersionTitle('Tenancy Agreement', second), 'Tenancy Agreement (Version 2)');
});

test('the card labels its version and greys an older one', () => {
  const card = code(...DRAFT_DIR, 'DraftCard.tsx');
  assert.match(card, /panel\?\.draftVersion\(ordinal, key\)/);
  // Greyed once a newer FINISHED version follows; a cut-off one does not grey it.
  assert.match(card, /const older = version !== null && version\.superseded;/);
  assert.match(card, /older \? 'bg-muted text-muted-foreground' : 'bg-primary\/15 text-primary'/);
  assert.match(card, /\{versionLabel \? `\$\{versionLabel\} · \$\{status\}` : status\}/);
});

test('the panel switches versions in place, and downloads each under its own name', () => {
  const panel = code(...DRAFT_DIR, 'DraftPanel.tsx');
  // The downloads' name; the note is one for every version (drafts saved as notes).
  assert.match(panel, /title=\{draftVersionTitle\(draft\.title, version\)\}/);
  assert.match(panel, /versionSwitch=\{versionSwitch\}/);
  const strip = code(...DRAFT_DIR, 'DraftVersionSwitch.tsx');
  assert.match(strip, /panel\.open\(\{ kind: 'draft', ordinal \}\)/);
  assert.match(strip, /if \(!panel \|\| !version \|\| version\.count < 2\) return null;/);
  // Focus comes back to an arrow after the panel redraws, on both of its mounts
  // (the note-loading frame, then the editor).
  assert.match(strip, /refocus = \{ arrow, until: Date\.now\(\) \+ REFOCUS_MS \};/);
  assert.match(strip, /if \(!refocus \|\| Date\.now\(\) > refocus\.until\) return;/);
  assert.match(strip, /first\.current && !first\.current\.disabled \? first\.current : second\.current/);
  const editor = code(...DRAFT_DIR, 'DraftEditor.tsx');
  assert.match(editor, /<DraftBar \/>\s*\{versionSwitch\}/);
  assert.match(editor, /\)\}\s*\{versionSwitch\}\s*\{line \? <DraftLineBar line=\{line\} \/> : null\}/);
});

test('both chat frames hand the panel the version index', () => {
  const screen = code('v2', 'features', 'conversations', 'conversation', 'ConversationScreen.tsx');
  assert.match(
    screen,
    /const \{ draftVersions, draftTitles \} = useMemo\(\(\) => \{\s*const index = draftVersionIndex\(messages\);\s*return \{\s*draftVersions: \(ordinal: number, key: string\) => draftVersion\(index, ordinal, key\),[\s\S]*?draftTitles: \(key: string\) => draftGroupTitle\(index, key\),\s*\};\s*\}, \[messages\]\);/,
  );
  assert.equal(screen.match(/versions=\{draftVersions\}/g)?.length, 2);
  // And the titles, so an edit's card names the draft it changes (draft-edits.test.ts).
  assert.equal(screen.match(/titles=\{draftTitles\}/g)?.length, 2);
  // The case page loads the side panel's context before its chat opens, and no
  // draft code: the context takes the lookup, and imports only its type.
  const context = code('v2', 'features', 'conversations', 'conversation', 'side-panel', 'SidePanelContext.tsx');
  assert.match(context, /import type \{ DraftVersion \} from '\.\.\/draft\/draft-versions';/);
});

// ── Separate drafts in one answer (Arthur, 22 November 2026) ─────────────

const tagged = (title: string, id: string, version: number, body = 'TEST DATA body.') =>
  `<draft title="${title}" id="${id}" version="${version}">
${body}
</draft>`;

test('four documents in one answer that share one id are four drafts, not versions 2 to 5', () => {
  const messages = [
    { id: 'u1', role: 'user', content: 'TEST DATA. Draft the scoring pack.' },
    { id: 'a1', role: 'assistant', content: tagged('README', 'pack01', 1) },
    { id: 'u2', role: 'user', content: 'TEST DATA. Now the references and the scoring sheet.' },
    {
      id: 'a2',
      role: 'assistant',
      content: [tagged('README', 'pack01', 2), tagged('Reference R5', 'pack01', 3), tagged('Reference R6', 'pack01', 4), tagged('Scoring Sheet', 'pack01', 5)].join('\n'),
    },
  ];
  const index = draftVersionIndex(messages);
  assert.deepEqual(
    index.map((entry) => entry.key),
    ['id:pack01', 'id:pack01', 'id:pack01|title:reference r5', 'id:pack01|title:reference r6', 'id:pack01|title:scoring sheet'],
  );
  // The README rewritten in the second answer is still version 2 of the first one.
  assert.equal(draftVersion(index, 1, 'id:pack01').version, 2);
  // Each new document stands alone: no "Version" label.
  for (const ordinal of [2, 3, 4]) assert.equal(draftVersion(index, ordinal, index[ordinal].key).count, 1);
});

test('the guard is narrow: a same-id, same-title repeat in one answer stays grouped, and drafts without an id group by title as before', () => {
  assert.deepEqual(answerDraftKeys([{ title: 'Lease', id: 'k1' }, { title: '  lease ', id: 'k1' }]), ['id:k1', 'id:k1']);
  assert.deepEqual(answerDraftKeys([{ title: 'Lease' }, { title: 'Notice' }]), ['title:lease', 'title:notice']);
  assert.deepEqual(answerDraftKeys([{ title: 'Lease', id: 'k1' }, { title: 'Notice', id: 'k2' }]), ['id:k1', 'id:k2']);
});

test('a version whose title changed in a LATER answer still joins its draft by id', () => {
  const index = draftVersionIndex([
    { id: 'a1', role: 'assistant', content: tagged('Tenancy Agreement', 'k3f9q2', 1) },
    { id: 'a2', role: 'assistant', content: tagged('Residential Tenancy Agreement', 'k3f9q2', 2) },
  ]);
  assert.deepEqual(index.map((entry) => entry.key), ['id:k3f9q2', 'id:k3f9q2']);
});

test('the card, the panel and the index judge a draft’s group the same way', () => {
  assert.match(code('v2', 'features', 'conversations', 'conversation', 'markdown', 'ChatContent.tsx'), /const groupKeys = answerDraftKeys\(/);
  assert.match(code(...DRAFT_DIR, 'DraftCard.tsx'), /const key = groupKey \?\? draftGroupKey\(draft\);/);
  assert.match(code(...DRAFT_DIR, 'DraftPanel.tsx'), /const groupKey = draftKeyAt\(messages, ordinal\) \?\? draftGroupKey\(draft\);/);
});
