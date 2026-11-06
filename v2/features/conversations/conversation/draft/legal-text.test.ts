import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { JSONContent } from '@tiptap/core';
import { getSchema } from '@tiptap/core';

import { isHangingClause } from '@/lib/notes/note-html';
import { createNoteExtensions } from '@/v2/features/notes/editor/extensions';
import type { CaseMentionSnapshot, CaseMentionStore } from '@/v2/features/notes/editor/mention-store';

import { foldEscapes, markdownToDoc } from './markdown-to-doc';

/* Legal text in drafts: one rule set (spec 384c fc292022 + 55809600, approved
 * 8ee0785c). The fixture file is shared with the server, byte for byte: every
 * case's draft Markdown must read to the same canonical HTML here as it does
 * in DraftHtml, and fold to the same plain text an edit's find is matched
 * against. TEST DATA only. */

const FIXTURE = join(process.cwd(), 'v2', 'features', 'conversations', 'conversation', 'draft', 'legal-text-lines.json');
/** The hash recorded on both sides (lawexa-api tests/Fixtures/legal-text/lines.json). */
const FIXTURE_SHA256 = 'c4e04ef79395895b4900e2f7b26b5aa43abf47e471ddf48dc94459a85a4528d4';

interface LegalCase {
  id: string;
  markdown: string;
  html: string;
  plain: string;
}

const bytes = readFileSync(FIXTURE);
const cases = (JSON.parse(bytes.toString('utf8')) as { cases: LegalCase[] }).cases;

// ── The canonical HTML of the spec (§5) ─────────────────────────────────────

/** Mark order, outer to inner (spec §5): a, em, strong, u, s, code. The font mark is not part of it. */
const MARK_ORDER = ['link', 'italic', 'bold', 'underline', 'strike', 'code'] as const;
const MARK_TAG: Record<(typeof MARK_ORDER)[number], string> = { link: 'a', italic: 'em', bold: 'strong', underline: 'u', strike: 's', code: 'code' };

const escapeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(nodes: readonly JSONContent[] = []): string {
  return nodes
    .map((node) => {
      if (node.type === 'hardBreak') return '<br>';
      if (node.type !== 'text') return '';
      const marks = MARK_ORDER.filter((name) => node.marks?.some((mark) => mark.type === name));
      let out = escapeText(node.text ?? '');
      for (const name of [...marks].reverse()) {
        const href = name === 'link' ? node.marks?.find((mark) => mark.type === 'link')?.attrs?.href : null;
        out = name === 'link' ? `<a href="${escapeText(String(href ?? ''))}">${out}</a>` : `<${MARK_TAG[name]}>${out}</${MARK_TAG[name]}>`;
      }
      return out;
    })
    .join('');
}

const align = (node: JSONContent) => {
  const value = node.attrs?.textAlign;
  return value === 'center' || value === 'right' || value === 'justify' ? ` style="text-align: ${value}"` : '';
};

/** A list item or a cell holding one paragraph is written without its `<p>`. */
function inner(node: JSONContent): string {
  const content = node.content ?? [];
  if (content.length === 1 && content[0].type === 'paragraph' && !align(content[0])) return inline(content[0].content);
  return blocks(content);
}

function blocks(nodes: readonly JSONContent[] = []): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'paragraph':
          // Attribute order (spec §5): data-hang, then style.
          return `<p${node.attrs?.hang === 1 ? ' data-hang="1"' : ''}${align(node)}>${inline(node.content)}</p>`;
        case 'heading':
          return `<h${node.attrs?.level}${align(node)}>${inline(node.content)}</h${node.attrs?.level}>`;
        case 'bulletList':
          return `<ul>${(node.content ?? []).map((item) => `<li>${inner(item)}</li>`).join('')}</ul>`;
        case 'orderedList':
          return `<ol>${(node.content ?? []).map((item) => `<li>${inner(item)}</li>`).join('')}</ol>`;
        case 'blockquote':
          return `<blockquote>${blocks(node.content)}</blockquote>`;
        case 'codeBlock':
          return `<pre><code>${escapeText((node.content ?? []).map((part) => part.text ?? '').join(''))}</code></pre>`;
        case 'horizontalRule':
          return '<hr>';
        case 'table':
          return `<table${node.attrs?.signature ? ' data-type="signature"' : ''}><tbody>${(node.content ?? [])
            .map((row) => `<tr>${(row.content ?? []).map((cell) => (cell.type === 'tableHeader' ? `<th>${inner(cell)}</th>` : `<td>${inner(cell)}</td>`)).join('')}</tr>`)
            .join('')}</tbody></table>`;
        default:
          return `<!--${node.type}-->`;
      }
    })
    .join('');
}

/** A draft body as the spec's canonical HTML, read by the panel's parser. */
export function canonicalHtml(markdown: string): string {
  return blocks(markdownToDoc(markdown).content);
}

// ── The cases ───────────────────────────────────────────────────────────────

test('the app reads the same fixture file as the server, byte for byte', () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), FIXTURE_SHA256);
  assert.ok(cases.length >= 39);
  assert.equal(new Set(cases.map((item) => item.id)).size, cases.length, 'case ids are unique');
});

for (const item of cases) {
  test(`legal text: ${item.id} reads as the spec's HTML`, () => {
    assert.equal(canonicalHtml(item.markdown), item.html);
  });
  test(`legal text: ${item.id} folds to the text an edit's find is matched against`, () => {
    assert.equal(foldEscapes(item.markdown), item.plain);
  });
}

// ── The same text in the editor, the saved note and the reader ─────────────

const SNAPSHOT: CaseMentionSnapshot = { open: false, query: '', loading: false, failed: false, items: [], activeIndex: 0, anchor: null };
const stubStore: CaseMentionStore = {
  subscribe: () => () => undefined,
  getSnapshot: () => SNAPSHOT,
  getServerSnapshot: () => SNAPSHOT,
  start: () => undefined,
  update: () => undefined,
  exit: () => undefined,
  moveActive: () => undefined,
  setActive: () => undefined,
  choose: () => undefined,
  handleKeyDown: () => false,
  destroy: () => undefined,
};
const schema = getSchema(createNoteExtensions({ placeholder: '', mentionStore: stubStore }));

test('every fixture case opens in the note editor: its document fits the editor schema', () => {
  for (const item of cases) {
    assert.doesNotThrow(() => schema.nodeFromJSON(markdownToDoc(item.markdown)).check(), item.id);
  }
});

test('a numbered clause keeps its hanging indent through a save: the editor writes data-hang="1" and reads back only that value', () => {
  const doc = schema.nodeFromJSON(markdownToDoc('1. Definitions'));
  const paragraph = doc.firstChild;
  assert.equal(paragraph?.attrs.hang, 1);
  const toDOM = schema.nodes.paragraph.spec.toDOM;
  assert.ok(toDOM && paragraph);
  const spec = toDOM(paragraph) as unknown as [string, Record<string, string>, ...unknown[]];
  assert.equal(spec[0], 'p');
  assert.equal(spec[1]['data-hang'], '1');
  // A paragraph with no number writes no mark.
  const plainSpec = toDOM(schema.nodes.paragraph.create()) as unknown as [string, Record<string, string> | number];
  assert.ok(typeof plainSpec[1] !== 'object' || !('data-hang' in plainSpec[1]));

  const rule = schema.nodes.paragraph.spec.parseDOM?.[0];
  assert.ok(rule);
  const element = (value: string | null) =>
    ({ getAttribute: (name: string) => (name === 'data-hang' ? value : null), style: {} }) as unknown as HTMLElement;
  const attrs = (value: string | null) => (rule.getAttrs ? rule.getAttrs(element(value)) : rule.attrs) as { hang?: number | null };
  // Tiptap leaves out an attribute its parser returns nothing for, so the schema's default (none) applies.
  assert.equal(attrs('1').hang, 1);
  assert.equal(attrs(null).hang ?? null, null);
  assert.equal(attrs('2').hang ?? null, null);
});

test('the note reader keeps a clause’s hanging indent, and only the exact value', () => {
  const element = (value: string | null) => ({ getAttribute: (name: string) => (name === 'data-hang' ? value : null) });
  assert.equal(isHangingClause(element('1')), true);
  assert.equal(isHangingClause(element(null)), false);
  assert.equal(isHangingClause(element('yes')), false);
  const here = join(process.cwd(), 'v2', 'features');
  const css = readFileSync(join(here, 'notes', 'legal-text.css'), 'utf8');
  assert.match(css, /:is\(\.v2-note-fonts, \.ProseMirror\) p\[data-hang='1'\] \{\s*padding-left: 2em;\s*text-indent: -2em;/);
  for (const parts of [
    ['notes', 'reader', 'NoteContent.tsx'],
    ['notes', 'editor', 'NoteEditorScreen.tsx'],
    ['conversations', 'conversation', 'draft', 'DraftEditor.tsx'],
    ['conversations', 'conversation', 'draft', 'DraftChangesView.tsx'],
  ]) {
    assert.match(readFileSync(join(here, ...parts), 'utf8'), /import '@\/v2\/features\/notes\/legal-text\.css';/, parts.join('/'));
  }
  assert.match(readFileSync(join(here, 'notes', 'reader', 'NoteContent.tsx'), 'utf8'), /\.\.\.\(node\.hang && \{ 'data-hang': '1' \}\)/);
  assert.match(readFileSync(join(here, 'conversations', 'conversation', 'draft', 'DraftChangesView.tsx'), 'utf8'), /data-hang=\{node\.attrs\?\.hang === 1 \? '1' : undefined\}/);
});
