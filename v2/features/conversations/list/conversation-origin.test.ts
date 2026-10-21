import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ConversationReference } from '@/types/chat';
import { conversationOrigin, fullTime } from './conversation-origin';

/* Tester, 20 October 2026 (finding 4): two chats with the same name in the
 * Conversations list could not be told apart. */

const statute: ConversationReference = {
  type: 'statute',
  content: { id: 1, title: 'Tenancy Law of Lagos State 2011', short_title: 'Tenancy Law 2011', slug: 't', year: '2011', status: null, is_bookmarked: false, bookmarks_count: 0 },
};
const kase: ConversationReference = {
  type: 'case',
  content: { id: 2, title: 'ADEYEMI v STATE', display_title: 'Adeyemi v State', slug: 'a', judgment_date: null, citation: null, is_bookmarked: false, bookmarks_count: 0, views_count: 0 },
};

test('a chat names the case, statute or note it was started from', () => {
  assert.equal(conversationOrigin([statute]), 'Tenancy Law 2011');
  assert.equal(conversationOrigin([kase]), 'Adeyemi v State');
  assert.equal(conversationOrigin([{ type: 'note', content: { id: 3, title: ' My  notes ', read_at: null, created_at: '' } }]), 'My notes');
});

test('a deleted item, a radar, or no references give no second line', () => {
  assert.equal(conversationOrigin([{ type: 'case', content: null }]), null);
  assert.equal(conversationOrigin([{ type: 'case', content: null }, statute]), 'Tenancy Law 2011');
  assert.equal(conversationOrigin(undefined), null);
  assert.equal(conversationOrigin([]), null);
});

test('the time on hover is the same text on the server and in the browser (Lagos time)', () => {
  assert.equal(fullTime('2026-10-21T13:05:00Z'), '21 Oct 2026, 14:05');
  assert.equal(fullTime('not a date'), undefined);
  assert.equal(fullTime(null), undefined);
});

test('the row shows the origin only where nothing else fills its second line', () => {
  const row = readFileSync(join(process.cwd(), 'v2', 'features', 'conversations', 'list', 'ConversationRow.tsx'), 'utf8');
  assert.match(row, /const origin = is_confidential \? null : conversationOrigin\(conversation\.references\);/);
  assert.match(row, /\) : spaceName \? \([\s\S]*?\) : origin \? \(\s*<span className="truncate text-xs text-muted-foreground">\{origin\}<\/span>\s*\) : null\}/);
  assert.match(row, /title=\{fullTime\(lastActivityAt\(conversation\)\)\}/);
});
