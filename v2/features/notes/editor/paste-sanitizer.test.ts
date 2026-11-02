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

/* Stay, 2 November 2026 (Techlead d164e8ed): a pasted centred line stays
 * centred. Tester's paste (259cd69c) had a centred "Signed:" line written as
 * the old align="center", which came in left-aligned. */

test('align="…" on a paragraph or heading comes in as its text-align', () => {
  assert.equal(
    stripPastedPresentation('<p align="center">Signed: TEST DATA Person</p><h2 align=RIGHT>TEST</h2><h3 align=\'justify\'>DATA</h3>'),
    '<p style="text-align: center">Signed: TEST DATA Person</p><h2 style="text-align: right">TEST</h2><h3 style="text-align: justify">DATA</h3>',
  );
  // Word's own class and other attributes go as before; only the alignment is kept.
  assert.equal(
    stripPastedPresentation('<p class="MsoNormal" align="center" style="margin:0;color:red"><span style="font-size:12pt">TEST</span></p>'),
    '<p class="MsoNormal" style="text-align: center"><span>TEST</span></p>',
  );
});

test('a text-align style is kept, and wins over align', () => {
  assert.equal(stripPastedPresentation('<p style="margin:0; text-align: Center;">TEST</p>'), '<p style="text-align: center">TEST</p>');
  assert.equal(stripPastedPresentation('<p align="right" style="text-align:center">TEST</p>'), '<p style="text-align: center">TEST</p>');
  // Left is the editor's default: written as no alignment.
  assert.equal(stripPastedPresentation('<p align="left">TEST</p><p style="text-align:left">DATA</p>'), '<p>TEST</p><p>DATA</p>');
  // An unknown style value leaves align to decide.
  assert.equal(stripPastedPresentation('<p align="right" style="text-align:start">TEST</p>'), '<p style="text-align: right">TEST</p>');
});

test('a paragraph or heading takes the alignment of the div, item or cell around it, unless it has its own', () => {
  assert.equal(
    stripPastedPresentation('<div align="center"><p>TEST</p><h2 align="left">DATA</h2><div><p>Ltd</p></div></div><p>After</p>'),
    '<div align="center"><p style="text-align: center">TEST</p><h2>DATA</h2><div><p style="text-align: center">Ltd</p></div></div><p>After</p>',
  );
  assert.equal(
    stripPastedPresentation('<table><tr><td style="text-align:right"><p class="MsoNormal">TEST</p></td><td><p>DATA</p></td></tr></table>'),
    '<table><tr><td><p class="MsoNormal" style="text-align: right">TEST</p></td><td><p>DATA</p></td></tr></table>',
  );
  assert.equal(stripPastedPresentation('<ul><li align="center"><p>TEST</p></li><li><p>DATA</p></li></ul>'), '<ul><li align="center"><p style="text-align: center">TEST</p></li><li><p>DATA</p></li></ul>');
});

test('unknown alignments, other elements and plain text are left as before', () => {
  assert.equal(stripPastedPresentation('<p align="middle">TEST</p><p align="">DATA</p>'), '<p>TEST</p><p>DATA</p>');
  // The editor keeps alignment only on paragraphs and headings: words straight in a div or cell stay as before.
  assert.equal(stripPastedPresentation('<div align="center" style="text-align:center">TEST</div><td align="center">DATA</td>'), '<div align="center">TEST</div><td align="center">DATA</td>');
  assert.equal(stripPastedPresentation('<pre>TEST</pre><param align="center">'), '<pre>TEST</pre><param align="center">');
  assert.equal(stripPastedPresentation('TEST DATA, align="center" in prose'), 'TEST DATA, align="center" in prose');
  assert.equal(stripPastedPresentation('<p>TEST</p>'), '<p>TEST</p>');
});

/* Review e5d2b521. */

test('an attribute posing as the carrier, nested or in prose, never becomes a style', () => {
  assert.equal(stripPastedPresentation('<p data-v2-align-x="center">TEST</p>'), '<p data-v2-align-x="center">TEST</p>');
  const nested = stripPastedPresentation('<p data-v2-paste-align=" data-v2-paste-align="center"center">TEST</p>');
  assert.doesNotMatch(nested, /text-align/);
  assert.equal(stripPastedPresentation('<p>TEST data-v2-paste-align="right" DATA</p>'), '<p>TEST data-v2-paste-align="right" DATA</p>');
});

test('an item, cell or row ends at the next one or at its list’s or table’s end; a self-closed div holds nothing', () => {
  assert.equal(
    stripPastedPresentation('<ul><li align="center"><p>a</p><li><p>b</p></ul><p>After</p>'),
    '<ul><li align="center"><p style="text-align: center">a</p><li><p>b</p></ul><p>After</p>',
  );
  assert.equal(stripPastedPresentation('<div align="center"/><p>After</p>'), '<div align="center"/><p>After</p>');
  assert.equal(
    stripPastedPresentation('<table><tr><td align="right"><p>a</p><td><p>b</p><tr><th align="center"><p>c</p></table><p>After</p>'),
    '<table><tr><td align="right"><p style="text-align: right">a</p><td><p>b</p><tr><th align="center"><p style="text-align: center">c</p></table><p>After</p>',
  );
  // An unclosed div inside a cell ends with the cell.
  assert.equal(
    stripPastedPresentation('<table><tr><td><div align="center"><p>a</p></td></tr></table><p>After</p>'),
    '<table><tr><td><div align="center"><p style="text-align: center">a</p></td></tr></table><p>After</p>',
  );
});

test('the last text-align declaration wins, as in CSS', () => {
  assert.equal(stripPastedPresentation('<p style="text-align:left;text-align:center">TEST</p>'), '<p style="text-align: center">TEST</p>');
  assert.equal(stripPastedPresentation('<p style="text-align:center; text-align: left">TEST</p>'), '<p>TEST</p>');
});

test('a Google Docs paste keeps its centred paragraph', () => {
  const docs =
    '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-4d5e6f">' +
    '<p dir="ltr" style="line-height:1.38;margin-top:0pt;text-align:center;"><span style="font-size:11pt;font-weight:700;">TEST DATA</span></p>' +
    '<p dir="ltr" style="line-height:1.38;"><span style="font-size:11pt;">Body</span></p></b>';
  assert.equal(stripPastedPresentation(docs), '<meta charset="utf-8"><p dir="ltr" style="text-align: center"><span>TEST DATA</span></p><p dir="ltr"><span>Body</span></p></b>');
});
