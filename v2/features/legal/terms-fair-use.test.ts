import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* Fair use on unlimited plans (Arthur's wording B, 18 November 2026, thread
 * dfa0d9b8). v1 /terms and v2 /terms both render app/(legal)/terms/page.tsx,
 * so one file carries the words. TEST DATA free: this reads the source. */

const terms = readFileSync(join(process.cwd(), 'app', '(legal)', 'terms', 'page.tsx'), 'utf8').replace(/\r\n/g, '\n');
// The page as a reader sees it: tags, JSX comments and line breaks gone, entities spelled out.
const visible = terms
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&rsquo;/g, '’')
  .replace(/\s+/g, ' ');

const WORDING_B =
  'Plans with unlimited messages are for normal personal or professional use. ' +
  'If an account’s use is far above what is usual for its plan, we may slow its responses so Lawexa stays fast for everyone. ' +
  'We will tell the account holder before we do, we will not charge extra for it, and the plan keeps its unlimited messages.';

test('the terms carry Arthur’s fair-use wording, word for word', () => {
  assert.ok(visible.includes(WORDING_B));
  assert.equal(visible.split(WORDING_B).length - 1, 1, 'once');
});

test('it sits at the end of "Trial Offers, Auto-Renewals and Paid Accounts", before "Payment Obligations"', () => {
  const section = visible.indexOf('Trial Offers, Auto-Renewals and Paid Accounts');
  const billing = visible.indexOf('maintain current billing information with Lawexa.');
  const fairUse = visible.indexOf(WORDING_B);
  const next = visible.indexOf('Payment Obligations:');
  assert.ok(section < billing && billing < fairUse && fairUse < next);
});

test('the page says when it last changed', () => {
  assert.match(terms, /Last modified: November 18, 2026/);
});
