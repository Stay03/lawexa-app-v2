import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  REQUEST_AVATAR,
  REQUEST_BUTTON,
  REQUEST_ICON,
  REQUEST_ITEM,
  REQUEST_LINE,
  REQUEST_LIST,
  REQUEST_NAME,
} from './request-row';

/* A waiting request on a phone is a roster row, not a card (techlead, 16
 * October 2026): avatar, name, two small buttons on one line, a divider
 * between rows. From md: up the card stays as the desktop pictures had it. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const classes = (value: string) => value.split(/\s+/);

test('below md a request has no border, no padding block, and a divider between rows', () => {
  assert.ok(classes(REQUEST_LIST).includes('divide-y'));
  assert.ok(classes(REQUEST_LIST).includes('md:divide-y-0'));
  for (const name of classes(REQUEST_ITEM)) {
    if (/^(rounded|border|p-)/.test(name)) assert.fail(`${name} draws a card on a phone`);
  }
  assert.ok(classes(REQUEST_ITEM).includes('md:border'));
});

test('below md the name and the buttons share one line, and the name gives way first', () => {
  assert.ok(!classes(REQUEST_LINE).includes('flex-wrap'), 'the line never wraps on a phone');
  assert.ok(classes(REQUEST_LINE).includes('max-md:min-h-11'));
  assert.ok(classes(REQUEST_NAME).includes('min-w-0'));
  assert.ok(!classes(REQUEST_NAME).some((name) => name.startsWith('basis-')), 'no basis on a phone');
  assert.ok(classes(REQUEST_AVATAR).includes('size-6'), 'the roster avatar on a phone');
  assert.deepEqual(classes(REQUEST_BUTTON), ['max-md:h-8', 'max-md:px-3', 'max-md:text-xs']);
  assert.ok(classes(REQUEST_ICON).includes('max-md:hidden'));
});

test('both request lists use the shared row, and the spinner still shows on a phone', () => {
  for (const file of [
    read('v2', 'features', 'invites', 'JoinRequestsPanel.tsx'),
    read('v2', 'features', 'spaces', 'detail', 'people', 'RoleRequests.tsx'),
  ]) {
    for (const name of ['REQUEST_LIST', 'REQUEST_ITEM', 'REQUEST_LINE', 'REQUEST_NAME', 'REQUEST_AVATAR']) {
      assert.match(file, new RegExp(`className=\{${name}\}`), name);
    }
    assert.equal((file.match(/className=\{REQUEST_BUTTON\}/g) ?? []).length, 2);
    assert.match(file, /<Loader2 aria-hidden className="size-4 animate-spin" \/>/);
    assert.doesNotMatch(file, /rounded-xl border border-border\/60 p-3/);
  }
});
