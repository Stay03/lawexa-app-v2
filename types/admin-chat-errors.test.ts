import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  chatErrorsQueryString,
  hasChatErrorFilters,
  readChatErrorFilters,
  readChatErrorsParams,
} from './admin-chat-errors';

/* The admin chat error log (backend 005714a9, built 20 October 2026): the
 * filters live in the URL, and the same reader parses the filter form. */

const fromQuery = (query: string) => {
  const search = new URLSearchParams(query);
  return (key: string) => search.get(key);
};

test('a plain URL is page 1 of 25 with no filter', () => {
  const params = readChatErrorsParams(fromQuery(''));
  assert.deepEqual(params, {
    stage: undefined,
    source: undefined,
    code: undefined,
    user_id: undefined,
    space_id: undefined,
    from: undefined,
    to: undefined,
    page: 1,
    per_page: 25,
  });
  assert.equal(hasChatErrorFilters(params), false);
  assert.equal(chatErrorsQueryString(params), '');
});

test('every filter the API takes is read back, and page and per_page with it', () => {
  const params = readChatErrorsParams(
    fromQuery('stage=provider&source=app&code=rate_limited&user_id=42&space_id=7&from=2026-10-19&to=2026-10-20&page=3&per_page=50')
  );
  assert.deepEqual(params, {
    stage: 'provider',
    source: 'app',
    code: 'rate_limited',
    user_id: 42,
    space_id: 7,
    from: '2026-10-19',
    to: '2026-10-20',
    page: 3,
    per_page: 50,
  });
  assert.equal(hasChatErrorFilters(params), true);
});

test('a value the API would reject is dropped rather than sent', () => {
  const params = readChatErrorsParams(
    fromQuery('stage=nope&source=browser&code=%20%20&user_id=0&space_id=abc&from=yesterday&to=2026-1-2&page=-1&per_page=x')
  );
  assert.deepEqual(params, {
    stage: undefined,
    source: undefined,
    code: undefined,
    user_id: undefined,
    space_id: undefined,
    from: undefined,
    to: undefined,
    page: 1,
    per_page: 25,
  });
  // "99999999999999999999" passes the digit pattern and becomes 1e20.
  assert.equal(readChatErrorFilters(fromQuery('user_id=99999999999999999999')).user_id, undefined);
});

test('per_page is capped at the API maximum of 100', () => {
  assert.equal(readChatErrorsParams(fromQuery('per_page=100')).per_page, 100);
  assert.equal(readChatErrorsParams(fromQuery('per_page=500')).per_page, 100);
});

test('the query string keeps a fixed order and leaves the defaults out', () => {
  assert.equal(
    chatErrorsQueryString({
      per_page: 25,
      page: 1,
      to: '2026-10-20',
      stage: 'stream',
      code: 'E_STREAM',
    }),
    'stage=stream&code=E_STREAM&to=2026-10-20'
  );
  assert.equal(chatErrorsQueryString({ page: 2, per_page: 50 }), 'page=2&per_page=50');
  // A code with reserved characters survives the round trip.
  const round = readChatErrorsParams(fromQuery(chatErrorsQueryString({ code: 'a b&c=d' })));
  assert.equal(round.code, 'a b&c=d');
});

test('the filter form reads through the same parser, trimming what was typed', () => {
  const form = new Map<string, string>([
    ['code', '  timeout '],
    ['user_id', ' 12 '],
    ['space_id', ''],
    ['from', '2026-10-01'],
    ['to', ''],
  ]);
  const filters = readChatErrorFilters((key) => form.get(key) ?? null);
  assert.deepEqual(filters, {
    stage: undefined,
    source: undefined,
    code: 'timeout',
    user_id: 12,
    space_id: undefined,
    from: '2026-10-01',
    to: undefined,
  });
});
