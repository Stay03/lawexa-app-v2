import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Guard for the nested-section step (statute-document.css). Layout cannot run
// under node:test, so this pins the two halves that must agree: the class
// names AknNode renders and the selectors that space them. The live check
// (s.2 to s.3 and s.3 to "Made at Abuja" on statute 1361) is in the commit.
const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, name), 'utf8');
const css = read('statute-document.css');
const node = read('AknNode.tsx');

/** The declarations of the rule whose selector list holds every given selector. */
function ruleBody(selectors: string[]): string | null {
  for (const match of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const list = match[1]
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '));
    if (selectors.every((s) => list.includes(s))) return match[2];
  }
  return null;
}

test('whatever follows a nested section takes the top-level block step', () => {
  const body = ruleBody([
    '.v2-statute-doc .akn-section + .akn-section',
    '.v2-statute-doc .akn-section + .akn-p',
    '.v2-statute-doc .akn-section + .akn-numbered',
    '.v2-statute-doc .akn-section + .akn-unnumbered',
    '.v2-statute-doc .akn-section + .akn-anchor > :first-child',
  ]);
  assert.ok(body, 'the nested-section rule is missing');
  const step = /margin-top:\s*([\d.]+rem)/.exec(body)?.[1];
  const blockStep = /\.akn-block \+ \.akn-block \{\s*margin-top:\s*([\d.]+rem)/.exec(css)?.[1];
  assert.ok(blockStep, 'the top-level block step is missing');
  assert.equal(step, blockStep);
});

test('the anchor wrapper stays display: contents, so its first child must carry the step', () => {
  assert.match(css, /\.akn-anchor \{\s*display: contents;/);
});

test('AknNode still renders the classes the rule names', () => {
  for (const name of ['akn-section', 'akn-anchor', 'akn-numbered', 'akn-unnumbered']) {
    assert.ok(node.includes(`className="${name}"`), name);
  }
  assert.ok(/className=\{?[^>]*akn-p\b|'akn-p'|"akn-p"/.test(node), 'akn-p');
});
