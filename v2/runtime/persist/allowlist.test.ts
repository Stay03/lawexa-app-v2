import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { casesQueries } from '../../features/cases/queries';
import { conversationsQueries } from '../../features/conversations/queries';
import { notesQueries } from '../../features/notes/queries';
import { subscriptionQueries } from '../../features/subscription/queries';
import { notificationsQueries } from '../../features/notifications/queries';

/**
 * The device cache keeps only what a leaf opts into, so the set of opted-in
 * leaves IS the privacy boundary. This test pins it to the plan's "In" table
 * (device_cache_plan.md, with the 6 October amendments): adding a leaf, or
 * changing one between 'list' and 'gated', must be a deliberate edit here.
 *
 * Read from the source so every factory in `v2/features/` is covered, including
 * ones no test imports. Each `meta: { persist: ... }` is attributed to the leaf
 * declared above it.
 */
const EXPECTED: Record<string, 'list' | 'gated'> = {
  'bookmarks.infiniteList': 'list',
  'bookmarks.list': 'list',
  'cases.citedByPreview': 'list',
  'cases.detail': 'gated',
  'cases.infiniteCitedBy': 'list',
  'cases.infiniteList': 'list',
  'cases.list': 'list',
  'cases.preview': 'gated',
  'cases.report': 'gated',
  'conversations.detail': 'gated',
  'conversations.infiniteList': 'list',
  'conversations.infiniteRecents': 'list',
  'conversations.list': 'list',
  'folders.detail': 'gated',
  'folders.items': 'gated',
  'folders.level': 'list',
  'jurisdictions.list': 'list',
  'notes.byId': 'gated',
  'notes.detail': 'gated',
  'notes.library': 'list',
  'notes.mine': 'list',
  'pricing.plans': 'list',
  'statutes.aknOutline': 'list',
  'statutes.countries': 'list',
  'statutes.detail': 'gated',
  'statutes.infiniteList': 'list',
};

const FEATURES = path.join(process.cwd(), 'v2', 'features');

/** A comment line: `*`, `//` or `/*` after indentation. Docblocks describe the
 *  flag (the exemplar factory does), and only code may set it. */
const COMMENT = /^\s*(\*|\/\/|\/\*)/;

/** The leaves one `queries.ts` source opts in, by leaf name. A flag in code
 *  before any leaf declaration is an error: it cannot be attributed. */
function optedInFrom(feature: string, source: string): Record<string, string> {
  const found: Record<string, string> = {};
  let leaf: string | null = null;
  for (const line of source.split('\n')) {
    if (COMMENT.test(line)) continue;
    const declared = /^ {2}(\w+): /.exec(line);
    if (declared) leaf = declared[1];
    const persist = /meta: \{[^}]*persist: '(\w+)'/.exec(line);
    if (persist) {
      assert.ok(leaf, `${feature}: a persist flag before any leaf`);
      found[`${feature}.${leaf}`] = persist[1];
    }
  }
  return found;
}

function optedInLeaves(): Record<string, string> {
  const found: Record<string, string> = {};
  for (const feature of fs.readdirSync(FEATURES)) {
    const file = path.join(FEATURES, feature, 'queries.ts');
    if (!fs.existsSync(file)) continue;
    Object.assign(found, optedInFrom(feature, fs.readFileSync(file, 'utf8')));
  }
  return found;
}

test('exactly the planned leaves are kept on the device, each in its planned mode', () => {
  assert.deepEqual(optedInLeaves(), EXPECTED);
});

test('the scan ignores the flag in a comment and still refuses a stray one in code', () => {
  const documented = [
    '/**',
    " * A leaf with `meta: { persist: 'list' | 'gated' }` is kept on the device.",
    ' */',
    "// meta: { persist: 'list' } in a line comment",
    "/* meta: { persist: 'gated' } */",
    'export const fooQueries = {',
    '  detail: (id: string) =>',
    '    queryOptions({',
    "      meta: { persist: 'gated' },",
    '    }),',
    '};',
  ].join('\n');
  assert.deepEqual(optedInFrom('foo', documented), { 'foo.detail': 'gated' });

  const stray = ["const shared = { meta: { persist: 'list' } };", 'export const fooQueries = {};'].join('\n');
  assert.throws(() => optedInFrom('foo', stray), /a persist flag before any leaf/);
});

test('the flag reaches the built options', () => {
  assert.equal(casesQueries.detail('a').meta?.persist, 'gated');
  assert.equal(casesQueries.list({ viewerId: 1 }).meta?.persist, 'list');
  assert.equal(conversationsQueries.detail({ conversationId: 'c', viewerId: 1 }).meta?.persist, 'gated');
  assert.equal(notesQueries.detail({ slug: 'n', viewerId: 1 }).meta?.persist, 'gated');
});

test('payment, notification and trending reads are never kept', () => {
  assert.equal(subscriptionQueries.current().meta?.persist, undefined);
  assert.equal(notificationsQueries.unreadCount().meta?.persist, undefined);
  assert.equal(notificationsQueries.detail('n').meta?.persist, undefined);
  assert.equal(casesQueries.infiniteTrending({ viewerId: 1 }).meta?.persist, undefined);
});
