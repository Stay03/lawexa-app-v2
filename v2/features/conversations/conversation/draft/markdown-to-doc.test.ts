import { test } from 'node:test';
import assert from 'node:assert/strict';

import { markdownToDoc } from './markdown-to-doc';

/* The draft editor (Stay, 23 October 2026): the draft Lawexa wrote opens in the
 * note editor with its structure. TEST DATA throughout. */

test('headings, paragraphs and inline marks become the editor schema', () => {
  const doc = markdownToDoc('# TEST DATA Agreement\n\nMade **between** *the parties*, ~~not~~ `here`, see [the Act](https://example.com).\n\n#### Deep');
  assert.deepEqual(doc.content?.[0], { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'TEST DATA Agreement' }] });
  assert.deepEqual(doc.content?.[1].content, [
    { type: 'text', text: 'Made ' },
    { type: 'text', text: 'between', marks: [{ type: 'bold' }] },
    { type: 'text', text: ' ' },
    { type: 'text', text: 'the parties', marks: [{ type: 'italic' }] },
    { type: 'text', text: ', ' },
    { type: 'text', text: 'not', marks: [{ type: 'strike' }] },
    { type: 'text', text: ' ' },
    { type: 'text', text: 'here', marks: [{ type: 'code' }] },
    { type: 'text', text: ', see ' },
    { type: 'text', text: 'the Act', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
    { type: 'text', text: '.' },
  ]);
  // The editor has three heading levels: a deeper one becomes a 3.
  assert.deepEqual(doc.content?.[2].attrs, { level: 3 });
});

test('lists keep their numbering start, and a table keeps its header row', () => {
  const doc = markdownToDoc('3. Third\n4. Fourth\n\n- One\n- Two\n\n| Item | Detail |\n| --- | --- |\n| Rent | ₦2,400,000 |');
  const [ordered, bullet, table] = doc.content ?? [];
  assert.equal(ordered.type, 'orderedList');
  assert.deepEqual(ordered.attrs, { start: 3 });
  assert.equal(ordered.content?.length, 2);
  assert.deepEqual(ordered.content?.[0], { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Third' }] }] });
  assert.equal(bullet.type, 'bulletList');
  assert.equal(bullet.attrs, undefined);
  assert.equal(table.type, 'table');
  assert.equal(table.content?.[0].content?.[0].type, 'tableHeader');
  assert.equal(table.content?.[1].content?.[1].type, 'tableCell');
  assert.deepEqual(table.content?.[1].content?.[1].content, [{ type: 'paragraph', content: [{ type: 'text', text: '₦2,400,000' }] }]);
});

test('markup in a draft stays text, and an empty draft is one empty paragraph', () => {
  const doc = markdownToDoc('<span style="color:red">TEST DATA</span>\n\nText <b>bold?</b>');
  // A span with no allowed font is dropped and its words kept, with no style and no mark.
  assert.equal(doc.content?.[0].content?.map((node) => node.text).join(''), 'TEST DATA');
  assert.ok(doc.content?.[0].content?.every((node) => node.type === 'text' && !node.marks));
  // Any other tag is text the reader can see and delete.
  assert.equal(doc.content?.[1].content?.map((node) => node.text).join(''), 'Text <b>bold?</b>');
  assert.ok(doc.content?.[1].content?.every((node) => !node.marks));
  assert.deepEqual(markdownToDoc(''), { type: 'doc', content: [{ type: 'paragraph' }] });
  assert.deepEqual(markdownToDoc('---').content, [{ type: 'horizontalRule' }]);
});

const fontOf = (node: { marks?: { type: string; attrs?: Record<string, unknown> }[] } | undefined) =>
  node?.marks?.find((mark) => mark.type === 'fontStyle')?.attrs ?? null;

test('the draft\'s own font goes on every run of text, and a span wins for its words', () => {
  const doc = markdownToDoc(
    '# TEST DATA Agreement\n\nMade <span data-font="Times New Roman" data-size="14">between **the parties**</span> today.\n\n- One\n\n`code`',
    { font: 'Georgia', size: 12 },
  );
  // The heading takes the draft's font and keeps its own size; the list takes both.
  assert.deepEqual(fontOf(doc.content?.[0].content?.[0]), { font: 'Georgia', size: null });
  const runs = doc.content?.[1].content ?? [];
  assert.deepEqual(runs.map((node) => node.text), ['Made ', 'between ', 'the parties', ' today.']);
  assert.deepEqual(fontOf(runs[0]), { font: 'Georgia', size: 12 });
  // Inside the span, bold included.
  assert.deepEqual(fontOf(runs[1]), { font: 'Times New Roman', size: 14 });
  assert.deepEqual(fontOf(runs[2]), { font: 'Times New Roman', size: 14 });
  assert.ok(runs[2].marks?.some((mark) => mark.type === 'bold'));
  // After the close, the draft's font again.
  assert.deepEqual(fontOf(runs[3]), { font: 'Georgia', size: 12 });
  assert.deepEqual(fontOf(doc.content?.[2].content?.[0].content?.[0].content?.[0]), { font: 'Georgia', size: 12 });
  // Code takes no font.
  assert.equal(fontOf(doc.content?.[3].content?.[0]), null);
});

test('only allowed fonts and sizes are kept; a span may set one and keep the other', () => {
  const doc = markdownToDoc('<span data-font="Comic Sans MS" data-size="13">kept words</span> and <span data-size="18">bigger</span>.');
  const runs = doc.content?.[0].content ?? [];
  assert.deepEqual(runs.map((node) => node.text), ['kept words', ' and ', 'bigger', '.']);
  assert.equal(fontOf(runs[0]), null);
  assert.deepEqual(fontOf(runs[2]), { font: null, size: 18 });
  // A stray close tag is dropped; no font means no mark.
  assert.deepEqual(markdownToDoc('Plain </span> text').content?.[0].content?.map((node) => node.text), ['Plain ', ' text']);
});

test('a line break inside a paragraph is a hard break, as the chat shows it', () => {
  const doc = markdownToDoc('[Your Name]\n[Property Address]\n[Date]\n\nDear Sir,');
  const block = doc.content?.[0].content ?? [];
  assert.deepEqual(block.map((node) => node.type), ['text', 'hardBreak', 'text', 'hardBreak', 'text']);
  assert.deepEqual(block.filter((node) => node.type === 'text').map((node) => node.text), ['[Your Name]', '[Property Address]', '[Date]']);
  // No newline is left inside any text, where a save would fold it into a space.
  assert.ok(JSON.stringify(doc).includes('Dear Sir,'));
  assert.ok(!(doc.content ?? []).some((node) => (node.content ?? []).some((child) => child.text?.includes('\n'))));
});

/* Alignment (Stay, 2 November 2026, thread 20a87a84; the shape agreed in 384c, 3cff2de9 and ee444601). */

const centred = (content: unknown[]) => ({ type: 'paragraph', attrs: { textAlign: 'center' }, content });

test('an aligned line in the editor’s own form becomes that paragraph or heading, its words read as Markdown', () => {
  const doc = markdownToDoc(
    '<h1 style="text-align: center">**TEST DATA BOARD RESOLUTION**</h1>\n\nResolved as follows.\n\n<p style="text-align: right">Dated *1 November*</p>\n\n<h3 style="text-align: justify">Notes</h3>',
  );
  assert.deepEqual(doc.content?.[0], {
    type: 'heading',
    attrs: { level: 1, textAlign: 'center' },
    content: [{ type: 'text', text: 'TEST DATA BOARD RESOLUTION', marks: [{ type: 'bold' }] }],
  });
  assert.deepEqual(doc.content?.[1], { type: 'paragraph', content: [{ type: 'text', text: 'Resolved as follows.' }] });
  assert.deepEqual(doc.content?.[2], {
    type: 'paragraph',
    attrs: { textAlign: 'right' },
    content: [
      { type: 'text', text: 'Dated ' },
      { type: 'text', text: '1 November', marks: [{ type: 'italic' }] },
    ],
  });
  assert.deepEqual(doc.content?.[3].attrs, { level: 3, textAlign: 'justify' });
});

test('the style is read forgivingly: case, spaces, a closing semicolon and either quote', () => {
  for (const line of [
    '<P STYLE="Text-Align:CENTER">TEST DATA</P>',
    "<p style='text-align : center;'>TEST DATA</p>",
    '<p style="text-align:center">TEST DATA</p>',
  ]) {
    assert.deepEqual(markdownToDoc(line).content, [centred([{ type: 'text', text: 'TEST DATA' }])], line);
  }
});

test('lines one under the other each become a block, and <br> inside one is a line break', () => {
  const doc = markdownToDoc(
    '<p style="text-align: center">A. TEST DATA Name<br>Director</p>\n<p style="text-align: center">B. TEST DATA Name<br/>Secretary</p>',
  );
  assert.deepEqual(doc.content, [
    centred([{ type: 'text', text: 'A. TEST DATA Name' }, { type: 'hardBreak' }, { type: 'text', text: 'Director' }]),
    centred([{ type: 'text', text: 'B. TEST DATA Name' }, { type: 'hardBreak' }, { type: 'text', text: 'Secretary' }]),
  ]);
});

test('bold, italic or a link may run across a <br>, and an escaped < reads as itself (review 20cedfc0)', () => {
  const bold = [{ type: 'bold' }];
  assert.deepEqual(markdownToDoc('<p style="text-align: center">**A. TEST DATA Name<br>Director**</p>').content, [
    centred([{ type: 'text', text: 'A. TEST DATA Name', marks: bold }, { type: 'hardBreak' }, { type: 'text', text: 'Director', marks: bold }]),
  ]);
  const link = [{ type: 'link', attrs: { href: 'https://example.com' } }];
  const linked = markdownToDoc('<p style="text-align: center">[TEST<br>DATA](https://example.com)<br><br>*end*</p>').content;
  assert.deepEqual(
    linked?.[0].content?.map((node) => (node.type === 'hardBreak' ? '|' : `${node.text}:${node.marks?.map((mark) => mark.type).join(',')}`)),
    ['TEST:link', '|', 'DATA:link', '|', '|', 'end:italic'],
  );
  assert.deepEqual(linked?.[0].content?.[0].marks?.[0].attrs?.href, link[0].attrs.href);
  // The server writes < and & inside an aligned line as &lt; and &amp;.
  assert.deepEqual(markdownToDoc('<p style="text-align: center">Smith &lt;Plaintiff&gt; &amp; Co</p>').content, [
    centred([{ type: 'text', text: 'Smith <Plaintiff> & Co' }]),
  ]);
  // The stand-in for <br> can't be smuggled in.
  assert.deepEqual(markdownToDoc('<p style="text-align: center">TEST\uE000DATA</p>').content, [centred([{ type: 'text', text: 'TESTDATA' }])]);
});

test('an aligned line with no blank line around it is still read, and the Markdown beside it stays Markdown', () => {
  const doc = markdownToDoc('<h2 style="text-align: center">TEST DATA Title</h2>\nThe **first** paragraph.\n- one\n- two');
  assert.deepEqual(doc.content?.[0], {
    type: 'heading',
    attrs: { level: 2, textAlign: 'center' },
    content: [{ type: 'text', text: 'TEST DATA Title' }],
  });
  assert.deepEqual(doc.content?.[1].content?.[1], { type: 'text', text: 'first', marks: [{ type: 'bold' }] });
  assert.equal(doc.content?.[2].type, 'bulletList');
});

test('the font span inside an aligned line keeps its font; the draft’s own font reaches a heading but not its size', () => {
  const doc = markdownToDoc(
    '<p style="text-align: center"><span data-font="Georgia" data-size="16">TEST DATA</span></p>\n\n<h1 style="text-align: center">Head</h1>',
    { font: 'Arial', size: 12 },
  );
  assert.deepEqual(doc.content?.[0], centred([{ type: 'text', text: 'TEST DATA', marks: [{ type: 'fontStyle', attrs: { font: 'Georgia', size: 16 } }] }]));
  assert.deepEqual(doc.content?.[1].content?.[0].marks, [{ type: 'fontStyle', attrs: { font: 'Arial', size: null } }]);
});

test('anything outside the agreed shape stays text, as before', () => {
  for (const line of [
    '<p style="text-align: left">TEST DATA</p>',
    '<p style="text-align: center; color: red">TEST DATA</p>',
    '<p class="x" style="text-align: center">TEST DATA</p>',
    '<h4 style="text-align: center">TEST DATA</h4>',
    '<section style="text-align: center">TEST DATA</section>',
  ]) {
    const doc = markdownToDoc(`${line}\n\nAfter.`);
    assert.deepEqual(doc.content?.[0], { type: 'paragraph', content: [{ type: 'text', text: line }] }, line);
  }
  // Not the draft's last block: an aligned line missing its closing tag is not read.
  const unclosed = '<p style="text-align: center">TEST DATA';
  assert.deepEqual(markdownToDoc(`${unclosed}\n\nAfter.`).content?.[0], { type: 'paragraph', content: [{ type: 'text', text: unclosed }] });
});

test('while the draft is being written, its last aligned line shows before its closing tag, and a half-typed tag shows nothing', () => {
  assert.deepEqual(markdownToDoc('Intro.\n\n<p style="text-align: center">**TEST DA').content?.[1], centred([{ type: 'text', text: '**TEST DA' }]));
  assert.deepEqual(markdownToDoc('Intro.\n\n<p style="text-al').content, [{ type: 'paragraph', content: [{ type: 'text', text: 'Intro.' }] }]);
});

/* The slips Lawexa makes around an aligned block (Tester's live check
 * 85466156; shapes agreed with woz, b2e6ef86 and 9282c136). */

const centredHeading = (level: number, content: unknown[]) => ({ type: 'heading', attrs: { level, textAlign: 'center' }, content });
const words = (text: string) => [{ type: 'text', text }];

test('a heading inside an aligned p on one line is that heading, aligned', () => {
  assert.deepEqual(markdownToDoc('<p style="text-align: center"><h2>TEST DATA RESOLUTION</h2></p>\nRESOLVED that.').content, [
    centredHeading(2, words('TEST DATA RESOLUTION')),
    { type: 'paragraph', content: words('RESOLVED that.') },
  ]);
  assert.deepEqual(markdownToDoc('<p style="text-align: right">### TEST DATA</p>').content, [
    { type: 'heading', attrs: { level: 3, textAlign: 'right' }, content: words('TEST DATA') },
  ]);
  // Inside the heading, the one-line rules: inline Markdown and <br>.
  assert.deepEqual(markdownToDoc('<p style="text-align: center"><h1>*TEST*<br>DATA</h1></p>').content, [
    centredHeading(1, [{ type: 'text', text: 'TEST', marks: [{ type: 'italic' }] }, { type: 'hardBreak' }, ...words('DATA')]),
  ]);
  // `#`s inside an aligned heading are dropped.
  assert.deepEqual(markdownToDoc('<h2 style="text-align: center">## TEST DATA</h2>').content, [centredHeading(2, words('TEST DATA'))]);
});

test('a block split over lines is read line by line, with no empty paragraphs', () => {
  assert.deepEqual(markdownToDoc('<p style="text-align: center">\n## TEST DATA RESOLUTION\n</p>\nRESOLVED.').content, [
    centredHeading(2, words('TEST DATA RESOLUTION')),
    { type: 'paragraph', content: words('RESOLVED.') },
  ]);
  assert.deepEqual(markdownToDoc('<p style="text-align: center">\n\n## TEST DATA\n\n**TEST DATA Ltd**\n\n</p>').content, [
    centredHeading(2, words('TEST DATA')),
    centred([{ type: 'text', text: 'TEST DATA Ltd', marks: [{ type: 'bold' }] }]),
  ]);
  // Inside an h1–h3, its lines are one heading.
  assert.deepEqual(markdownToDoc('<h2 style="text-align: center">\nTEST\n## DATA\n</h2>').content, [
    centredHeading(2, [...words('TEST'), { type: 'hardBreak' }, ...words('DATA')]),
  ]);
  assert.deepEqual(markdownToDoc('<p style="text-align: center">\n\n</p>\nTEST DATA').content, [{ type: 'paragraph', content: words('TEST DATA') }]);
});

test('anything else around an aligned block stays text', () => {
  const text = (markdown: string) => assert.deepEqual(markdownToDoc(markdown).content?.[0], { type: 'paragraph', content: words(markdown) }, markdown);
  // The alignment on the inner heading alone, or another tag inside.
  text('<p><h2 style="text-align: center">TEST DATA</h2></p>');
  // An h4 inside an aligned p stays its words as typed, as before.
  assert.deepEqual(markdownToDoc('<p style="text-align: center"><h4>TEST DATA</h4></p>').content, [centred(words('<h4>TEST DATA</h4>'))]);
  text('<p style="text-align: center">\n<p class="x">TEST DATA</p>\n</p>');
  text('<p style="text-align: center">\n<div>TEST DATA</div>\n</p>');
  // No closing tag, with more of the draft after it.
  assert.equal(markdownToDoc('<p style="text-align: center">\n## TEST\n\nDATA').content?.some((node) => node.attrs?.textAlign), false);
  // Inside a code fence, or indented as code.
  assert.equal(markdownToDoc('```\n<p style="text-align: center">\n## TEST\n</p>\n```').content?.[0].type, 'codeBlock');
  assert.equal(markdownToDoc('    <p style="text-align: center">## TEST</p>').content?.[0].type, 'codeBlock');
  // A fence line inside a split block, or a closing tag that doesn't match (review 9510d959).
  assert.equal(markdownToDoc('<p style="text-align: center">\n```\n</p>\n```').content?.some((node) => node.attrs?.textAlign), false);
  assert.equal(markdownToDoc('<h2 style="text-align: center">\nTEST\n</h3>\n\nDATA').content?.some((node) => node.attrs?.textAlign), false);
  // A script, or an attribute on the inner heading, inside shape 1.
  assert.deepEqual(markdownToDoc('<p style="text-align: center"><h2 class="x">TEST</h2></p>').content, [centred(words('<h2 class="x">TEST</h2>'))]);
  assert.deepEqual(markdownToDoc('<p style="text-align: center"><h2><script>alert(1)</script></h2></p>').content, [
    centredHeading(2, words('<script>alert(1)</script>')),
  ]);
  // A `#` the person typed, written back escaped, stays a `#` (review 9510d959, item 1).
  assert.deepEqual(markdownToDoc('<p style="text-align: center">&#35;# TEST</p>').content, [centred(words('## TEST'))]);
});

test('while a split block is being written, its lines show aligned before the closing tag', () => {
  assert.deepEqual(markdownToDoc('TEST.\n\n<p style="text-align: center">').content, [{ type: 'paragraph', content: words('TEST.') }]);
  assert.deepEqual(markdownToDoc('<p style="text-align: center">\n## TEST DATA RESOL').content, [centredHeading(2, words('TEST DATA RESOL'))]);
  // A closing tag still being typed shows nothing.
  assert.deepEqual(markdownToDoc('<p style="text-align: center">\nA. TEST<br>Director\n</').content, [
    centred([...words('A. TEST'), { type: 'hardBreak' }, ...words('Director')]),
  ]);
});

test('a line holding only <br>s is a gap, one empty paragraph (woz d3643d84)', () => {
  assert.deepEqual(markdownToDoc('RESOLVED.\n<br>\n<p style="text-align: center">A. TEST<br>Director</p>').content, [
    { type: 'paragraph', content: words('RESOLVED.') },
    { type: 'paragraph' },
    centred([...words('A. TEST'), { type: 'hardBreak' }, ...words('Director')]),
  ]);
  assert.deepEqual(markdownToDoc('TEST\n\n   <br/> <BR />\n\nDATA').content, [
    { type: 'paragraph', content: words('TEST') },
    { type: 'paragraph' },
    { type: 'paragraph', content: words('DATA') },
  ]);
  // Four spaces in, it is code.
  assert.equal(markdownToDoc('TEST\n\n    <br>').content?.[1].type, 'codeBlock');
  // A <br> with words beside it is not a gap.
  assert.equal(markdownToDoc('<br> TEST').content?.some((node) => !node.content), false);
});

/* Drafts judged HTML by a stray aligned line (Techlead ee4398e5; Tester's run
 * 2, b8417987; shapes 1966bfb1 and woz d03f0a6f). */

const body = { type: 'paragraph', content: [{ type: 'text', text: 'TEST DATA resolution', marks: [{ type: 'bold' }] }, ...words(' passed.')] };

test('bold, italic and underline tags inside an aligned line are marks, and the body below stays Markdown', () => {
  // Tester's run 2 shape.
  assert.deepEqual(markdownToDoc('<p style="text-align: center"><strong>TEST DATA Ltd</strong></p>\n **TEST DATA resolution** passed.').content, [
    centred([{ type: 'text', text: 'TEST DATA Ltd', marks: [{ type: 'bold' }] }]),
    body,
  ]);
  assert.deepEqual(markdownToDoc('<h2 style="text-align: center"><B>TEST</B> <i>DATA</i> <U>Ltd</U></h2>').content, [
    centredHeading(2, [
      { type: 'text', text: 'TEST', marks: [{ type: 'bold' }] },
      ...words(' '),
      { type: 'text', text: 'DATA', marks: [{ type: 'italic' }] },
      ...words(' '),
      { type: 'text', text: 'Ltd', marks: [{ type: 'underline' }] },
    ]),
  ]);
  // Nested, with Markdown and a line break inside.
  assert.deepEqual(markdownToDoc('<p style="text-align: center"><em>A. <strong>TEST</strong><br>*Director*</em></p>').content, [
    centred([
      { type: 'text', text: 'A. ', marks: [{ type: 'italic' }] },
      { type: 'text', text: 'TEST', marks: [{ type: 'italic' }, { type: 'bold' }] },
      { type: 'hardBreak' },
      { type: 'text', text: 'Director', marks: [{ type: 'italic' }, { type: 'italic' }] },
    ]),
  ]);
});

test('an open mark tag marks the rest of the line; with attributes or outside an aligned line, tags stay text', () => {
  const bold = [{ type: 'bold' }];
  assert.deepEqual(markdownToDoc('<p style="text-align: center">TEST <strong>DATA</p>').content, [
    centred([...words('TEST '), { type: 'text', text: 'DATA', marks: bold }]),
  ]);
  // A stray closing tag is dropped.
  assert.deepEqual(markdownToDoc('<p style="text-align: center"><b>TEST</i> DATA</b></p>').content, [
    centred([
      { type: 'text', text: 'TEST', marks: bold },
      { type: 'text', text: ' DATA', marks: bold },
    ]),
  ]);
  // An opening tag with an attribute stays text; its closing tag is then a stray one, dropped.
  assert.deepEqual(markdownToDoc('<p style="text-align: center"><b class="x">TEST</b></p>').content, [
    centred([...words('<b class="x">'), ...words('TEST')]),
  ]);
  assert.deepEqual(markdownToDoc('TEST <strong>DATA</strong>').content, [
    { type: 'paragraph', content: [...words('TEST '), ...words('<strong>'), ...words('DATA'), ...words('</strong>')] },
  ]);
  // An extra attribute on the aligned tag keeps the line text; the body below stays Markdown.
  const extra = markdownToDoc('<h2 style="text-align: center" class="title">TEST</h2>\n\n **TEST DATA resolution** passed.').content;
  assert.equal(extra?.[0].attrs?.textAlign, undefined);
  assert.deepEqual(extra?.[1], body);
});

test('an aligned div reads as an aligned p, on one line or split, with plain heading and p lines inside', () => {
  assert.deepEqual(markdownToDoc('<div style="text-align: center">**TEST** DATA</div>').content, [
    centred([{ type: 'text', text: 'TEST', marks: [{ type: 'bold' }] }, ...words(' DATA')]),
  ]);
  // woz's div wrapper around the title block.
  assert.deepEqual(
    markdownToDoc('<div style="text-align: center">\n<h2>TEST DATA RESOLUTION</h2>\n<p>TEST DATA Ltd</p>\n## Minutes\nOf the board\n</div>\n\n **TEST DATA resolution** passed.').content,
    [centredHeading(2, words('TEST DATA RESOLUTION')), centred(words('TEST DATA Ltd')), centredHeading(2, words('Minutes')), centred(words('Of the board')), body],
  );
  // The same plain lines inside a split p; a line with attributes keeps the block text.
  assert.deepEqual(markdownToDoc('<p style="text-align: right">\n<h3>TEST</h3>\n</p>').content, [
    { type: 'heading', attrs: { level: 3, textAlign: 'right' }, content: words('TEST') },
  ]);
  assert.equal(markdownToDoc('<div style="text-align: center">\n<p class="x">TEST</p>\n</div>').content?.some((node) => node.attrs?.textAlign), false);
  // While streaming, a div's opening tag shows nothing yet.
  assert.deepEqual(markdownToDoc('TEST.\n\n<div style="text-al').content, [{ type: 'paragraph', content: words('TEST.') }]);
});

test('Stay’s live draft (c48fc782): bold and the numbered points are kept around centred lines', () => {
  const doc = markdownToDoc(
    [
      '<h2 style="text-align: center"><strong>TEST DATA BOARD RESOLUTION</strong></h2>',
      '<p style="text-align: center"><strong>TEST DATA Holdings Ltd</strong></p>',
      '',
      '**WHEREAS:**',
      '1. The company needs a TEST DATA account.',
      '2. The board has met.',
      '',
      '**RESOLVED** that:',
      '1. The account is opened.',
      '',
      '<p style="text-align: center">A. TEST DATA<br>Director</p>',
      '<p style="text-align: center">B. TEST DATA<br>Secretary</p>',
    ].join('\n'),
  ).content;
  const bold = [{ type: 'bold' }];
  assert.deepEqual(
    doc?.map((node) => [node.type, node.attrs?.textAlign ?? '-']),
    [
      ['heading', 'center'],
      ['paragraph', 'center'],
      ['paragraph', '-'],
      ['orderedList', '-'],
      ['paragraph', '-'],
      ['orderedList', '-'],
      ['paragraph', 'center'],
      ['paragraph', 'center'],
    ],
  );
  assert.deepEqual(doc?.[0].content, [{ type: 'text', text: 'TEST DATA BOARD RESOLUTION', marks: bold }]);
  assert.deepEqual(doc?.[2].content, [{ type: 'text', text: 'WHEREAS:', marks: bold }]);
  assert.equal(doc?.[3].content?.length, 2);
  assert.deepEqual(doc?.[4].content?.[0], { type: 'text', text: 'RESOLVED', marks: bold });
  // The same with no blank lines anywhere: the body lines sit in the centred lines' HTML block, and still read as Markdown.
  const tight = markdownToDoc(
    '<p style="text-align: center"><strong>TEST DATA Holdings Ltd</strong></p>\n**WHEREAS:**\n1. The company needs a TEST DATA account.\n2. The board has met.\n<p style="text-align: center">A. TEST DATA<br>Director</p>',
  ).content;
  assert.deepEqual(
    tight?.map((node) => [node.type, node.attrs?.textAlign ?? '-']),
    [
      ['paragraph', 'center'],
      ['paragraph', '-'],
      ['orderedList', '-'],
      ['paragraph', 'center'],
    ],
  );
  assert.equal(tight?.[2].content?.length, 2);
});
