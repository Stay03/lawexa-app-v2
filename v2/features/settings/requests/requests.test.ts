import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ContentRequest, ContentRequestListResponse } from '@/types/content-request';
import {
  contentHref,
  fieldErrors,
  flattenRequests,
  prependRequest,
  requestHistory,
  requestHref,
  STATUS_PILL,
  statusTone,
  statusWord,
  submitBody,
  typeWord,
} from './model';

/* My requests (Stay, 24 October 2026, v2 Stage 1 item 10 part B). */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

const request = (over: Partial<ContentRequest>): ContentRequest => ({
  id: 1,
  uuid: 'r-1',
  user: null,
  type: 'case',
  title: 'Okonkwo v State',
  additional_notes: null,
  created_content_type: null,
  created_content_id: null,
  created_content: null,
  status: 'pending',
  status_label: 'Pending',
  fulfilled_by: null,
  fulfilled_at: null,
  rejected_by: null,
  rejected_at: null,
  rejection_reason: null,
  created_at: '2026-10-20T09:00:00+00:00',
  updated_at: '2026-10-20T09:00:00+00:00',
  ...over,
});

const page = (rows: ContentRequest[], current = 1, last = 1, total = rows.length): ContentRequestListResponse => ({
  success: true,
  message: '',
  data: rows,
  pagination: { current_page: current, per_page: 15, total, last_page: last, from: 1, to: rows.length },
  links: { first: '', last: '', prev: null, next: null },
});

test("the status words are the server's four values, in sentence case", () => {
  assert.equal(statusWord({ status: 'pending', status_label: 'Pending' }), 'Pending');
  assert.equal(statusWord({ status: 'in_progress', status_label: 'In Progress' }), 'In progress');
  assert.equal(statusWord({ status: 'fulfilled', status_label: 'Fulfilled' }), 'Fulfilled');
  assert.equal(statusWord({ status: 'rejected', status_label: 'Rejected' }), 'Rejected');
});

test('the status pills are greys only, an outline while open and a fill once closed', () => {
  assert.equal(statusTone('pending'), 'waiting');
  assert.equal(statusTone('in_progress'), 'working');
  assert.equal(statusTone('fulfilled'), 'closed');
  assert.equal(statusTone('rejected'), 'closed');
  // No colour family on any of them (Stay's rule: no coloured badges; gold is for actions).
  assert.doesNotMatch(Object.values(STATUS_PILL).join(' '), /amber|emerald|green|red|destructive|primary|orange/);
  // In progress is told from Pending by a small grey dot.
  const pill = read('v2', 'features', 'settings', 'requests', 'RequestStatus.tsx');
  assert.match(pill, /\{tone === 'working' \? <span aria-hidden className="size-1\.5 rounded-full bg-muted-foreground" \/> : null\}/);
});

test("a status this build does not know prints the server's own label", () => {
  const unknown = { status: 'on_hold', status_label: 'On Hold' } as unknown as Pick<ContentRequest, 'status' | 'status_label'>;
  assert.equal(statusWord(unknown), 'On Hold');
});

test("the form posts v1's three fields, trimmed, and leaves empty notes out", () => {
  assert.deepEqual(submitBody({ type: 'case', title: '  Okonkwo v State ', notes: ' SC 2020 ' }), {
    type: 'case',
    title: 'Okonkwo v State',
    additional_notes: 'SC 2020',
  });
  assert.deepEqual(submitBody({ type: 'note', title: 'Land Use Act', notes: '   ' }), {
    type: 'note',
    title: 'Land Use Act',
  });
});

test('the form sends nothing without a kind and a title', () => {
  assert.equal(submitBody({ type: null, title: 'Okonkwo', notes: '' }), null);
  assert.equal(submitBody({ type: 'case', title: '   ', notes: 'x' }), null);
});

test('the form opens with A case chosen, and the chosen kind is a grey fill, never gold', () => {
  const panel = read('v2', 'features', 'settings', 'requests', 'NewRequestPanel.tsx');
  assert.match(panel, /const EMPTY_DRAFT: RequestDraft = \{ type: 'case', title: '', notes: '' \};/);
  const chosen = /draft\.type === option\.value\s*\?\s*'([^']+)'/.exec(panel)?.[1] ?? '';
  assert.match(chosen, /bg-foreground\/10/);
  assert.doesNotMatch(chosen, /primary|amber|gold/);
});

test('the form offers the two kinds the server accepts, case and note', () => {
  const model = read('v2', 'features', 'settings', 'requests', 'model.ts');
  // And the panel posts exactly what `submitBody` built.
  const panel = read('v2', 'features', 'settings', 'requests', 'NewRequestPanel.tsx');
  assert.match(panel, /const body = submitBody\(draft\);/);
  assert.match(panel, /submit\.mutate\(body, \{/);
  assert.match(model,/\{ value: 'case', label: 'A case' \},\n\s+\{ value: 'note', label: 'A note' \},\n\];/);
});

test("a 422's messages go under their own fields, and an unknown field's under the form", () => {
  assert.deepEqual(
    fieldErrors({
      type: ['Please specify the type of content you need.'],
      title: ['Please provide a title for your request.', 'second'],
      captcha: ['Try again.'],
    }),
    {
      fields: {
        type: 'Please specify the type of content you need.',
        title: 'Please provide a title for your request.',
      },
      other: 'Try again.',
    },
  );
  assert.deepEqual(fieldErrors(null), { fields: {}, other: null });
});

test('a request opens at its own address under v1\'s /content-requests', () => {
  assert.equal(requestHref('559c838d-278d-47b4-9fcc-89d0e408d361'), '/content-requests/559c838d-278d-47b4-9fcc-89d0e408d361');
  const page = read('app', 'v2', 'content-requests', '[uuid]', 'page.tsx');
  assert.match(page, /return <RequestScreen uuid=\{uuid\} \/>;/);
  assert.match(read('app', 'v2', 'content-requests', '(list)', 'page.tsx'), /return <RequestsScreen \/>;/);
});

test('a fulfilled case or note links to the content; anything else does not', () => {
  const content = { id: 9, title: '4 Eng Ltd v Harper', slug: '4-eng-ltd-v-harper' };
  assert.equal(
    contentHref(request({ status: 'fulfilled', created_content_type: 'case', created_content: content })),
    '/cases/4-eng-ltd-v-harper',
  );
  assert.equal(
    contentHref(request({ status: 'fulfilled', created_content_type: 'note', created_content: content })),
    '/notes/4-eng-ltd-v-harper',
  );
  assert.equal(contentHref(request({ status: 'fulfilled', created_content_type: 'provision', created_content: content })), null);
  assert.equal(contentHref(request({ status: 'fulfilled', created_content_type: 'case', created_content: null })), null);
  assert.equal(contentHref(request({ status: 'pending', created_content_type: 'case', created_content: content })), null);
});

test('the kinds print as words, and an unknown kind as the server sent it', () => {
  assert.equal(typeWord('case'), 'Case');
  assert.equal(typeWord('statute'), 'Statute');
  assert.equal(typeWord('lecture'), 'lecture');
});

test('the history shows only the steps the API keeps a record of', () => {
  assert.deepEqual(
    requestHistory(request({ status: 'in_progress' })).map((step) => [step.key, step.day]),
    [['asked', '20 October 2026'], ['working', null]],
  );
  const rejected = requestHistory(
    request({
      status: 'rejected',
      rejected_at: '2026-10-22T10:00:00+00:00',
      rejected_by: { id: 2, name: 'Research Team', email: 'r@example.com', avatar_url: null },
    }),
  );
  assert.deepEqual(rejected[1], { key: 'rejected', label: 'Rejected', day: '22 October 2026', by: 'Research Team' });
});

test('loaded pages flatten newest first, each request once', () => {
  const a = request({ uuid: 'a' });
  const b = request({ uuid: 'b' });
  const c = request({ uuid: 'c' });
  assert.deepEqual(
    flattenRequests([page([a, b], 1, 2), page([b, c], 2, 2)]).map((row) => row.uuid),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(flattenRequests(undefined), []);
});

test('a new request goes to the top of the cached list and the count moves by one', () => {
  const data = { pages: [page([request({ uuid: 'old' })], 1, 1, 1)], pageParams: [1] };
  const next = prependRequest(data, request({ uuid: 'new' }));
  assert.deepEqual(next?.pages[0].data.map((row) => row.uuid), ['new', 'old']);
  assert.equal(next?.pages[0].pagination.total, 2);
  // Already there (a refetch won the race): unchanged.
  assert.equal(prependRequest(next, request({ uuid: 'new' })), next);
  // Nothing cached yet: the first read will carry it.
  assert.equal(prependRequest(undefined, request({ uuid: 'new' })), undefined);
});
