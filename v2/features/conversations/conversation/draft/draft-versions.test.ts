import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { draftOffsets } from './draft-ordinals';
import {
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
  assert.deepEqual(draftVersion(index, 0, tenancy), { version: 1, count: 3, ordinals: [0, 1, 3], latest: false });
  assert.deepEqual(draftVersion(index, 1, tenancy), { version: 2, count: 3, ordinals: [0, 1, 3], latest: false });
  assert.deepEqual(draftVersion(index, 3, tenancy), { version: 3, count: 3, ordinals: [0, 1, 3], latest: true });
  const notice = draftVersion(index, 2, draftGroupKey({ title: 'Notice to Quit' }));
  assert.deepEqual(notice, { version: 1, count: 1, ordinals: [2], latest: true });
});

test('a draft still being written is placed after the saved versions of its group', () => {
  // The streaming answer's text is not in `content` yet, so it is not indexed.
  const index = draftVersionIndex(MESSAGES);
  const streaming = draftVersion(index, 4, draftGroupKey({ title: 'Tenancy Agreement' }));
  assert.deepEqual(streaming, { version: 4, count: 4, ordinals: [0, 1, 3, 4], latest: true });
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
  assert.match(card, /panel\?\.draftVersion\(ordinal, draftGroupKey\(draft\)\)/);
  assert.match(card, /const older = version !== null && !version\.latest;/);
  assert.match(card, /older \? 'bg-muted text-muted-foreground' : 'bg-primary\/15 text-primary'/);
  assert.match(card, /\{versionLabel \? `\$\{versionLabel\} · \$\{status\}` : status\}/);
});

test('the panel switches versions in place and saves each under its own name', () => {
  const panel = code(...DRAFT_DIR, 'DraftPanel.tsx');
  assert.match(panel, /title=\{draftVersionTitle\(draft\.title, version\)\}/);
  assert.match(panel, /versionSwitch=\{versionSwitch\}/);
  const strip = code(...DRAFT_DIR, 'DraftVersionSwitch.tsx');
  assert.match(strip, /panel\.open\(\{ kind: 'draft', ordinal \}\)/);
  assert.match(strip, /if \(!panel \|\| !version \|\| version\.count < 2\) return null;/);
  const editor = code(...DRAFT_DIR, 'DraftEditor.tsx');
  assert.match(editor, /<DraftBar \/>\s*\{versionSwitch\}/);
  assert.match(editor, /\)\}\s*\{versionSwitch\}\s*<div data-v2-draft-scroll/);
});

test('both chat frames hand the panel the version index', () => {
  const screen = code('v2', 'features', 'conversations', 'conversation', 'ConversationScreen.tsx');
  assert.match(
    screen,
    /const draftVersions = useMemo\(\(\) => \{\s*const index = draftVersionIndex\(messages\);\s*return \(ordinal: number, key: string\) => draftVersion\(index, ordinal, key\);\s*\}, \[messages\]\);/,
  );
  assert.equal(screen.match(/versions=\{draftVersions\}/g)?.length, 2);
  // The case page loads the side panel's context before its chat opens, and no
  // draft code: the context takes the lookup, and imports only its type.
  const context = code('v2', 'features', 'conversations', 'conversation', 'side-panel', 'SidePanelContext.tsx');
  assert.match(context, /import type \{ DraftVersion \} from '\.\.\/draft\/draft-versions';/);
});
