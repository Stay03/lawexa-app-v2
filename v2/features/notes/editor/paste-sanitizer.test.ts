import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stripPastedPresentation } from './paste-sanitizer';

/* Tester and Arthur, 20 October 2026: a table pasted from Google Docs turned
 * every cell bold. Google wraps its clipboard in a not-bold `<b>`. */

const GOOGLE_DOCS_TABLE =
  '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1a2b3c"><div dir="ltr" style="margin-left:0pt;" align="left">' +
  '<table style="border:none;border-collapse:collapse;"><tbody><tr style="height:0pt">' +
  '<td style="border-left:solid #000000 1pt;padding:5pt"><p dir="ltr" style="line-height:1.2;"><span style="font-size:11pt;color:#000000;font-weight:400;">Party</span></p></td>' +
  '<td style="padding:5pt"><p dir="ltr"><span style="font-size:11pt;font-weight:400;">Role</span></p></td>' +
  '</tr></tbody></table></div></b><br class="Apple-interchange-newline">';

test('Google Docs’ not-bold wrapper is dropped, so a pasted table is not bold', () => {
  const out = stripPastedPresentation(GOOGLE_DOCS_TABLE);
  assert.doesNotMatch(out, /<b\b/);
  assert.match(out, /<table><tbody><tr><td><p dir="ltr"><span>Party<\/span><\/p><\/td>/);
  // Every style is still gone, as before.
  assert.doesNotMatch(out, /style=/);
});

test('a real <b> stays bold, with or without a style', () => {
  assert.equal(stripPastedPresentation('<p><b>Held</b>: dismissed</p>'), '<p><b>Held</b>: dismissed</p>');
  assert.equal(stripPastedPresentation('<p><b style="font-weight:700">Held</b></p>'), '<p><b>Held</b></p>');
  assert.equal(stripPastedPresentation("<p><b style='color:red'>Held</b></p>"), '<p><b>Held</b></p>');
});

test('the wrapper is matched in any case and spacing, with weight normal or 400', () => {
  assert.equal(stripPastedPresentation('<B id="x" STYLE="font-weight : normal">a</B>'), 'a</B>');
  assert.equal(stripPastedPresentation('<b style="font-weight:400">a</b>'), 'a</b>');
  assert.equal(stripPastedPresentation('<b style="font-weight:4000">a</b>'), '<b>a</b>');
});

test('colour, font tags and presentation attributes are still stripped', () => {
  assert.equal(
    stripPastedPresentation('<p style="color:#fff"><font face="Arial" color="white">text</font></p><td bgcolor="#000">x</td>'),
    '<p>text</p><td>x</td>',
  );
});
