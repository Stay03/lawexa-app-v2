import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { diffDocs, diffInline, hasChanges, type DiffNode } from './draft-diff';
import { markdownToDoc } from './markdown-to-doc';

/* Show changes (Stay, 27 October 2026): version N against N−1, word by word,
 * formatting kept. TEST DATA throughout. */

/** A diff as readable text: [-removed-] and {+added+}, blocks one per line. */
function render(node: DiffNode): string {
  if (node.type === 'text') {
    const text = node.text ?? '';
    return node.diff === 'del' ? `[-${text}-]` : node.diff === 'add' ? `{+${text}+}` : text;
  }
  const inner = (node.content ?? []).map(render).join(node.type === 'doc' || node.type?.endsWith('List') || node.type === 'listItem' ? '\n' : '');
  if (node.diff && node.type !== 'doc') return node.diff === 'del' ? `[-block:${inner}-]` : `{+block:${inner}+}`;
  return inner;
}
const show = (before: string, after: string) => render(diffDocs(markdownToDoc(before), markdownToDoc(after)));

test('one changed clause: the old words struck, the new words added, the rest plain', () => {
  const before = '# Tenancy\n\nRent is ₦2,400,000 a year, paid in advance.\n\nThe Tenant keeps the premises clean.';
  const after = '# Tenancy\n\nRent is ₦200,000 a month, paid on the 1st.\n\nThe Tenant keeps the premises clean.';
  assert.equal(
    show(before, after),
    'Tenancy\nRent is [-₦2,400,000 a year,-]{+₦200,000 a month,+} paid [-in advance.-]{+on the 1st.+}\nThe Tenant keeps the premises clean.',
  );
});

test('whole words only: a changed word is replaced whole, never letter by letter', () => {
  const out = diffInline([{ type: 'text', text: 'six months notice' }], [{ type: 'text', text: 'one months notice' }]);
  assert.deepEqual(out.map((node) => [node.text, node.diff ?? null]), [['six', 'del'], ['one', 'add'], [' months notice', null]]);
});

test('an added or removed paragraph is marked whole, and unchanged ones stay plain around it', () => {
  const before = 'First clause.\n\nSecond clause.';
  const after = 'First clause.\n\nA new clause.\n\nSecond clause.';
  assert.equal(show(before, after), 'First clause.\n{+block:{+A new clause.+}+}\nSecond clause.');
  assert.equal(show(after, before), 'First clause.\n[-block:[-A new clause.-]-]\nSecond clause.');
});

test('formatting is kept: bold and headings stay, only the changed words are marked', () => {
  const diff = diffDocs(markdownToDoc('The **Landlord** gives six months notice.'), markdownToDoc('The **Landlord** gives one month notice.'));
  const runs = diff.content?.[0]?.content ?? [];
  const landlord = runs.find((node) => node.text === 'Landlord');
  assert.deepEqual(landlord?.marks?.map((mark) => mark.type), ['bold']);
  assert.equal(landlord?.diff, undefined);
  assert.equal(render(diff), 'The Landlord gives [-six months-]{+one month+} notice.');
});

test('a list item that changed is compared inside, by its words', () => {
  assert.equal(
    show('1. Pay rent on time.\n2. Keep it clean.', '1. Pay rent on the 1st.\n2. Keep it clean.'),
    'Pay rent on [-time.-]{+the 1st.+}\nKeep it clean.',
  );
});

test('two identical versions have no changes', () => {
  const doc = markdownToDoc('# Notice\n\nTake notice that you are to quit.');
  assert.equal(hasChanges(diffDocs(doc, doc)), false);
  assert.equal(hasChanges(diffDocs(doc, markdownToDoc('# Notice\n\nTake notice that you must quit.'))), true);
});

test('the panel offers Show changes from version 2 on, off by default, and draws the changes read only', () => {
  const read = (name: string) => readFileSync(join(process.cwd(), 'v2', 'features', 'conversations', 'conversation', 'draft', name), 'utf8');
  const panel = read('DraftPanel.tsx');
  assert.match(panel, /let rememberedShowChanges = false;/);
  assert.match(panel, /version && version\.version >= 2 \? draftAt\(messages, version\.ordinals\[version\.version - 2\]\) : null;/);
  assert.match(panel, /const comparable = draft\.complete && previous\?\.complete === true;/);
  assert.match(panel, /<DraftChangesView\s+before=\{previous\.body\}\s+after=\{draft\.body\}/);
  const strip = read('DraftVersionSwitch.tsx');
  assert.match(strip, /\{changes \? \(\s*<label[^>]*>\s*<Switch checked=\{changes\.on\} onCheckedChange=\{changes\.onChange\} \/>\s*Show changes/);
  const view = read('DraftChangesView.tsx');
  assert.match(view, /if \(node\.diff === 'add'\) return <ins key=\{key\} className=\{ADDED\}>/);
  assert.match(view, /if \(node\.diff === 'del'\) return <del key=\{key\} className=\{REMOVED\}>/);
});
