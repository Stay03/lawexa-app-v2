import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Guard for the narrow-table rule (statute-document.css). Layout cannot run
// under node:test; the live phone measurements are in the commit. This pins
// the rule and the DOM shape its selector depends on.
const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, name), 'utf8');
const css = read('statute-document.css');
const node = read('AknNode.tsx');

const NARROW = '.v2-statute-doc .akn-table:not(:has(> * > tr > :nth-child(3)))';

test('a table of one or two columns drops the minimum width', () => {
  const at = css.indexOf(`${NARROW} {`);
  assert.notEqual(at, -1, 'the narrow-table rule is missing');
  const body = css.slice(at, css.indexOf('}', at));
  assert.match(body, /min-width:\s*0;/);
});

test('wider tables keep the minimum, so they still scroll in their wrapper', () => {
  assert.match(css, /\.v2-statute-doc \.akn-table \{[^}]*min-width:\s*32rem;/);
  assert.match(css, /\.v2-statute-doc \.akn-table-wrap \{[^}]*overflow-x:\s*auto;/);
});

test('rows always sit in a thead or tbody, which `> * > tr` counts on', () => {
  assert.ok(node.includes('<thead key={key}>{renderTableRows(child)}</thead>'));
  assert.ok(node.includes('<tbody key={key}>{renderTableRows(child)}</tbody>'));
  assert.ok(node.includes('<tbody>{looseRows}</tbody>'), 'rows placed directly under the table');
  assert.ok(node.includes('<table className={tableClass}>'));
});
