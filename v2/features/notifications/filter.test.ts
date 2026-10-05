import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiReadFilter, parseReadFilter, readParam } from './filter';

test('?read=unread is the Unread tab', () => {
  assert.equal(parseReadFilter('unread'), 'unread');
});

test('v1’s ?read=read lands on All, the view that holds those rows', () => {
  assert.equal(parseReadFilter('read'), 'all');
});

test('no param, an empty one or a hand-edited one is All', () => {
  assert.equal(parseReadFilter(null), 'all');
  assert.equal(parseReadFilter(''), 'all');
  assert.equal(parseReadFilter('junk'), 'all');
  assert.equal(parseReadFilter('UNREAD'), 'all');
});

test('All asks the API for no filter and writes no param', () => {
  assert.equal(apiReadFilter('all'), undefined);
  assert.equal(readParam('all'), null);
});

test('Unread asks the API for unread and writes ?read=unread', () => {
  assert.equal(apiReadFilter('unread'), 'unread');
  assert.equal(readParam('unread'), 'unread');
});
