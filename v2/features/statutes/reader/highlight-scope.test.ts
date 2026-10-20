import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* The Android statute chat's Close (Stay, 20 October 2026, 10:35Z: "go ahead"):
 * Chrome tested every ::highlight rule on each of the ~12,000 elements it
 * restyled. A rule scoped to a class an element's ancestors do not have is
 * skipped at once, so each rule names the reader that paints it, and the
 * statute rules apply only while that statute has notes or annotations. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test('no ::highlight rule is left unscoped', () => {
  for (const file of [['app', 'globals.css'], ['v2', 'features', 'statutes', 'reader', 'statute-document.css']]) {
    const css = read(...file);
    assert.doesNotMatch(css, /(^|[,}]\s*)::highlight\(/m, `${file.join('/')}: a bare ::highlight`);
    assert.doesNotMatch(css, /\.v2-statute-doc ::highlight\(/, `${file.join('/')}: scoped to the whole statute page`);
  }
  const globals = read('app', 'globals.css');
  assert.match(globals, /\.v2-case-doc ::highlight\(judgment-passage\),\n\.judgment-sheet-body ::highlight\(judgment-passage\) \{/);
  assert.match(read('components', 'admin', 'case-principles', 'JudgmentSheet.tsx'), /className="judgment-sheet-body /);
});

test('the statute rules apply only while there is something to paint', () => {
  const css = read('v2', 'features', 'statutes', 'reader', 'statute-document.css');
  assert.equal(css.match(/\.akn-doc--painted ::highlight\(/g)?.length, 7);
  assert.match(
    read('v2', 'features', 'statutes', 'reader', 'StatuteDocument.tsx'),
    /\(statuteNotes\.notes\.length > 0 \|\| annotations\.length > 0\) && 'akn-doc--painted',/,
  );
});
