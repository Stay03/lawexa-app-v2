import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAkn, type AknDocumentModel } from './akn';
import { buildServerOutline } from './server-outline';
import type { StatuteOutlineEntry } from '@/lib/api/statutes';

/* Treaties in Lawexa are "(Ratification and Enforcement) Acts": two sections
 * in the body, the treaty itself in a schedule whose Articles are
 * <paragraph>s. These pins hold the contents rule for those Articles against
 * a trimmed copy of the live export (the Nigeria and South Africa mutual
 * legal assistance treaty, Articles 1 to 4 kept as served) and prove an
 * ordinary Act's model is exactly what it was before the rule. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, name), 'utf8');

/* ── A minimal XML DOM ────────────────────────────────────────────────────
 * node:test has no DOMParser. This one builds exactly the surface parseAkn
 * reads: localName, children, getAttribute, textContent and the parsererror
 * probe. It understands what the AKN export contains (elements, attributes,
 * text, the XML declaration and the five named entities) and nothing more. */

class TestElement {
  readonly localName: string;
  readonly children: TestElement[] = [];
  private readonly attributes: ReadonlyMap<string, string>;
  private readonly nodes: Array<TestElement | string> = [];

  constructor(localName: string, attributes: ReadonlyMap<string, string>) {
    this.localName = localName;
    this.attributes = attributes;
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  get textContent(): string {
    return this.nodes
      .map((node) => (typeof node === 'string' ? node : node.textContent))
      .join('');
  }

  appendElement(child: TestElement): void {
    this.children.push(child);
    this.nodes.push(child);
  }

  appendText(text: string): void {
    this.nodes.push(text);
  }

  descendants(name: string): TestElement[] {
    return this.children.flatMap((child) => [
      ...(child.localName === name ? [child] : []),
      ...child.descendants(name),
    ]);
  }
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

const decode = (raw: string) =>
  raw.replace(/&(amp|lt|gt|quot|apos);/g, (_, name: string) => ENTITIES[name]);

const TOKEN =
  /<\?[\s\S]*?\?>|<\/[^>]+>|<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*"[^"]*")*)\s*(\/?)>|([^<]+)/g;

function parseXml(xml: string): TestElement {
  const root = new TestElement('#document', new Map());
  const open: TestElement[] = [root];
  for (const match of xml.matchAll(TOKEN)) {
    const [token, tag, attrs, selfClosing, text] = match;
    const parent = open[open.length - 1];
    if (text !== undefined) {
      parent.appendText(decode(text));
    } else if (tag !== undefined) {
      const attributes = new Map<string, string>();
      for (const attr of attrs.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) {
        attributes.set(attr[1], decode(attr[2]));
      }
      const element = new TestElement(tag.split(':').pop() ?? tag, attributes);
      parent.appendElement(element);
      if (!selfClosing) open.push(element);
    } else if (token.startsWith('</')) {
      open.pop();
    }
  }
  return root;
}

class TestDocument {
  private readonly root: TestElement;

  constructor(xml: string) {
    this.root = parseXml(xml);
  }

  get documentElement(): TestElement | null {
    return this.root.children[0] ?? null;
  }

  getElementsByTagNameNS(namespace: string, name: string): TestElement[] {
    if (namespace !== '*') throw new Error('the test DOM reads the wildcard namespace only');
    return this.root.descendants(name);
  }
}

class TestDOMParser {
  parseFromString(xml: string): TestDocument {
    return new TestDocument(xml);
  }
}

Object.defineProperty(globalThis, 'DOMParser', { value: TestDOMParser, configurable: true });

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function parseFixture(name: string): AknDocumentModel {
  const model = parseAkn(read(name));
  assert.ok(model, `${name} did not parse`);
  return model;
}

/** What StatuteDocument hands the scroll spy: every division id, then its
 *  sections' ids. */
function spyIds(model: AknDocumentModel): string[] {
  return model.outline.flatMap((division) => [
    division.id,
    ...division.sections.map((section) => section.id),
  ]);
}

/** One line per block: kind, anchor, depth and element, in render order. */
function blockLines(model: AknDocumentModel): string[] {
  return model.blocks.map(
    (block) => `${block.kind} ${block.id} ${block.depth} ${block.element.localName}`,
  );
}

/** The words the blocks render, in order: a division block renders only its
 *  own num and heading; every other block renders its whole element. */
function renderedWords(model: AknDocumentModel): string[] {
  return model.blocks.flatMap((block) => {
    const elements =
      block.kind === 'division'
        ? Array.from(block.element.children).filter((child) =>
            ['num', 'heading', 'subheading'].includes(child.localName),
          )
        : [block.element];
    return elements.flatMap((element) => (element.textContent ?? '').split(/\s+/));
  }).filter(Boolean);
}

/** Every word of the document outside <meta>, in document order. */
function documentWords(xml: string): string[] {
  const act = parseXml(xml.replace(/<meta>[\s\S]*?<\/meta>/, '')).children[0];
  return act.textContent.split(/\s+/).filter(Boolean);
}

/* ── The treaty ──────────────────────────────────────────────────────────── */

test('a treaty schedule lists its Articles under the schedule heading', () => {
  const model = parseFixture('treaty-schedule.fixture.xml');
  const schedule = model.outline.find((division) => division.id === 'akn-att-1');
  assert.ok(schedule, 'the schedule is not in the outline');
  assert.deepEqual(
    schedule.sections.map((section) => [section.id, section.label]),
    [
      ['akn-att-1__spara-t1', 'Article 1 Scope of Assistance'],
      ['akn-att-1__spara-t2', 'Article 2 Central Authorities'],
      ['akn-att-1__spara-t3', 'Article 3 Limitations on Assistance'],
      ['akn-att-1__spara-t4', 'Article 4 Form and Contents of Requests'],
    ],
  );
});

test("an Article's nested (a), (b) paragraphs are not contents entries", () => {
  const ids = spyIds(parseFixture('treaty-schedule.fixture.xml'));
  assert.ok(ids.every((id) => !id.includes('__para-')), ids.join(', '));
  assert.ok(!ids.includes('akn-att-1__group-treaty'));
  assert.ok(!ids.includes('akn-att-1__list-1'));
});

test('the treaty earns the Contents button (4 or more spy ids)', () => {
  const ids = spyIds(parseFixture('treaty-schedule.fixture.xml'));
  // Two sections, the schedule and four Articles. Before the rule it was 3,
  // under StatuteDocument's threshold of 4, which is why no button showed.
  assert.equal(ids.length, 7);
  assert.ok(ids.length >= 4);
});

test('each Article stays one body block with its eId anchor', () => {
  const lines = blockLines(parseFixture('treaty-schedule.fixture.xml'));
  for (const n of [1, 2, 3, 4]) {
    assert.equal(
      lines.filter((line) => line.includes(`akn-att-1__spara-t${n} `)).length,
      1,
      `Article ${n}`,
    );
    assert.ok(lines.includes(`body akn-att-1__spara-t${n} 1 paragraph`), `Article ${n}`);
  }
});

test('the treaty renders every word once, in document order', () => {
  const xml = read('treaty-schedule.fixture.xml');
  assert.deepEqual(renderedWords(parseFixture('treaty-schedule.fixture.xml')), documentWords(xml));
});

/* ── An ordinary Act ─────────────────────────────────────────────────────── */

test('an ordinary Act renders every word once, in document order', () => {
  const xml = read('ordinary-act.fixture.xml');
  assert.deepEqual(renderedWords(parseFixture('ordinary-act.fixture.xml')), documentWords(xml));
});

test("an ordinary Act's blocks and outline are exactly what they were before the rule", () => {
  // Captured from aa9b689, before treaty Articles earned entries. The
  // schedule's "1. Fees" paragraph is a paragraph with a heading but no
  // "Article" num, so it stays out of the outline.
  const model = parseFixture('ordinary-act.fixture.xml');
  assert.deepEqual(blockLines(model), [
    'body akn-x1 0 longTitle',
    'body akn-x2 0 heading',
    'body akn-x3 0 p',
    'division akn-chp-1 0 chapter',
    'division akn-chp-1__part-1 1 part',
    'body akn-chp-1__part-1__sec-1 2 section',
    'crossheading akn-chp-1__part-1__crossheading-1 2 crossheading',
    'body akn-chp-1__part-1__sec-2 2 section',
    'division akn-chp-1__part-2 1 part',
    'body akn-chp-1__part-2__hcontainer-1 2 hcontainer',
    'body akn-chp-1__part-2__sec-3 2 section',
    'body akn-sec-4 0 section',
    'division akn-att-1 0 attachment',
    'body akn-att-1__hcontainer-1 1 hcontainer',
    'body akn-att-1__para-1 1 paragraph',
    'body akn-att-1__para-2 1 paragraph',
  ]);
  assert.deepEqual(model.outline, [
    { id: 'akn-chp-1', label: 'Chapter I — Establishment', depth: 0, sections: [] },
    {
      id: 'akn-chp-1__part-1',
      label: 'Part I — Superior Courts',
      depth: 1,
      sections: [
        { id: 'akn-chp-1__part-1__sec-1', label: '1. Composition of the Court' },
        { id: 'akn-chp-1__part-1__sec-2', label: '2. Original jurisdiction' },
      ],
    },
    { id: 'akn-chp-1__part-2', label: 'Part II — Lower Courts', depth: 1, sections: [] },
    {
      id: 'akn-chp-1__part-2__hcontainer-1',
      label: 'II-A — Magistrates',
      depth: 2,
      sections: [{ id: 'akn-chp-1__part-2__sec-3', label: "3. Magistrates' courts" }],
    },
    { id: 'akn-sec-4', label: '4. Short title', sections: [] },
    { id: 'akn-att-1', label: 'FIRST SCHEDULE — Section 1.', depth: 0, sections: [] },
  ]);
});

test("the treaty's blocks are exactly what they were before the rule", () => {
  // Captured from aa9b689: the rule adds outline entries and no blocks.
  assert.deepEqual(blockLines(parseFixture('treaty-schedule.fixture.xml')), [
    'body akn-x1 0 longTitle',
    'body akn-sec-1 0 section',
    'body akn-sec-2 0 section',
    'division akn-att-1 0 attachment',
    'body akn-att-1__list-1 1 hcontainer',
    'body akn-att-1__group-treaty 1 hcontainer',
    'body akn-att-1__spara-t1 1 paragraph',
    'body akn-att-1__spara-t2 1 paragraph',
    'body akn-att-1__spara-t3 1 paragraph',
    'body akn-att-1__spara-t4 1 paragraph',
  ]);
});

/* ── The server outline (partial documents) ──────────────────────────────── */

const entry = (
  position: number,
  depth: number,
  node_type: StatuteOutlineEntry['node_type'],
  eId: string,
  number: string | null,
  title: string | null,
): StatuteOutlineEntry => ({
  eId,
  node_type,
  node_type_label: node_type,
  number,
  title,
  depth,
  position,
  locked: false,
});

test('the server outline lists the same Articles the walk does', () => {
  // The live /akn/outline entries for the same treaty, Article 2's items cut.
  const { divisions } = buildServerOutline({
    outline: [
      entry(0, 0, 'section', 'sec-1', '1.', 'Enforcement of the Treaty'),
      entry(1, 0, 'section', 'sec-2', '2.', 'Short title'),
      entry(2, 0, 'schedule', 'att-1', 'SCHEDULE', 'TREATY BETWEEN THE GOVERNMENTS'),
      entry(3, 1, 'hcontainer', 'att-1__list-1', null, 'Table of Contents'),
      entry(4, 1, 'hcontainer', 'att-1__group-treaty', null, 'TREATY BETWEEN THE GOVERNMENTS'),
      entry(5, 1, 'paragraph', 'att-1__spara-t1', 'Article 1', 'Scope of Assistance'),
      entry(6, 2, 'item', 'att-1__spara-t1__item-1', '1.', ''),
      entry(7, 2, 'item', 'att-1__spara-t1__item-2', '2.', ''),
      entry(8, 3, 'paragraph', 'att-1__spara-t1__item-2__para-a', '(a)', ''),
      entry(9, 3, 'paragraph', 'att-1__spara-t1__item-2__para-b', '(b)', ''),
      entry(10, 2, 'item', 'att-1__spara-t1__item-3', '3.', ''),
      entry(11, 1, 'paragraph', 'att-1__spara-t2', 'Article 2', 'Central Authorities'),
    ],
    total_count: 12,
    total_sections: 2,
    partial: true,
  });
  const schedule = divisions.find((division) => division.id === 'akn-att-1');
  assert.ok(schedule, 'the schedule is not in the server outline');
  assert.deepEqual(schedule.sections, [
    { id: 'akn-att-1__spara-t1', label: 'Article 1 Scope of Assistance' },
    { id: 'akn-att-1__spara-t2', label: 'Article 2 Central Authorities' },
  ]);
  assert.equal(divisions.length, 3);
});

test('the server outline still ignores a schedule paragraph that is not an Article', () => {
  const { divisions } = buildServerOutline({
    outline: [
      entry(0, 0, 'section', 'sec-1', '1.', 'Short title'),
      entry(1, 0, 'schedule', 'att-1', 'FIRST SCHEDULE', 'Fees'),
      entry(2, 1, 'paragraph', 'att-1__para-1', '1.', 'Fees'),
      entry(3, 1, 'paragraph', 'att-1__para-2', 'Article 2', ''),
      entry(4, 0, 'section', 'sec-2', '2.', 'Commencement'),
    ],
    total_count: 5,
    total_sections: 2,
    partial: true,
  });
  assert.deepEqual(divisions, [
    { id: 'akn-sec-1', label: '1. Short title', sections: [] },
    { id: 'akn-att-1', label: 'FIRST SCHEDULE — Fees', depth: 0, sections: [] },
    { id: 'akn-sec-2', label: '2. Commencement', sections: [] },
  ]);
});
