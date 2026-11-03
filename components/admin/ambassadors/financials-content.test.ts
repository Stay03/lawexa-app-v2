import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sortRows, type FinancialsRow } from './financials';
import { financialsCsv } from './financials-csv';

/* The financials table and its CSV with what the referrals made (Arthur's
 * option A, 3 November 2026): sorting by Spaces and quizzes, and the four
 * CSV columns, zeros from a server before them. */

const row = (uuid: string, extra: Partial<FinancialsRow> = {}): FinancialsRow => ({
  user_uuid: uuid,
  application_uuid: null,
  name: `TEST DATA ${uuid}`,
  email: `${uuid}@example.test`,
  code: null,
  referred_count: 0,
  paid_count: 0,
  revenue: {},
  gifted_messages: 0,
  last_referral_at: null,
  busiest_day: { date: null, signups: 0 },
  unusual_activity: false,
  university: null,
  level: null,
  country: null,
  haystack: uuid,
  ...extra,
});

test('the table sorts by how many Spaces or quizzes the referrals made', () => {
  const rows = [
    row('a', { spaces: { count: 1, members: 40 }, quizzes: { count: 5, plays: 2 } }),
    row('b', { spaces: { count: 4, members: 4 } }),
    row('c'),
  ];
  const ids = (sorted: FinancialsRow[]) => sorted.map((r) => r.user_uuid);
  assert.deepEqual(ids(sortRows(rows, { column: 'spaces', currency: null, direction: 'desc' })), ['b', 'a', 'c']);
  assert.deepEqual(ids(sortRows(rows, { column: 'spaces', currency: null, direction: 'asc' })), ['c', 'a', 'b']);
  // A row from a server before the tallies sorts as zero.
  assert.deepEqual(ids(sortRows(rows, { column: 'quizzes', currency: null, direction: 'desc' })), ['a', 'b', 'c']);
});

test('the CSV carries the Spaces, their members, the quizzes and their plays', () => {
  const csv = financialsCsv([row('a', { spaces: { count: 2, members: 9 }, quizzes: { count: 3, plays: 14 } }), row('b')], []);
  const [header, first, second] = csv.replace(/^﻿/, '').trim().split(/\r?\n/);
  const columns = header.split(',');
  const at = (name: string) => columns.findIndex((column) => column.replace(/"/g, '') === name);
  for (const name of ["Their referrals' Spaces", 'Members in those Spaces', "Their referrals' quizzes", 'Plays of those quizzes']) {
    assert.notEqual(at(name), -1, name);
  }
  const cell = (line: string, name: string) => line.split(',')[at(name)];
  assert.equal(cell(first, "Their referrals' Spaces"), '2');
  assert.equal(cell(first, 'Plays of those quizzes'), '14');
  // None made, or a server before it: zeros, never blank.
  assert.equal(cell(second, 'Members in those Spaces'), '0');
});
