import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chatErrorPayload, createReportGate, platformOf } from './report';

/* Chat errors the app shows go to POST /api/chat-errors (Stay, 20 October
 * 2026). A report carries an app-made message only, within the server's caps,
 * and goes at most once a minute per code and chat, ten a minute in all. */

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

test('the payload holds the code, a message cut to 300 characters, the chat and the build', () => {
  const payload = chatErrorPayload(
    { code: 'stream_stall', message: `  ${'x'.repeat(400)}  `, conversationId: '1af561e4-09ed-46b2-9e05-cdc8299ddeeb', httpStatus: 0 },
    { userAgent: ANDROID, appVersion: '0557f82145db3211450cd17ab6fe7f463c9ae4e7' },
  );
  assert.equal(payload.code, 'stream_stall');
  assert.equal(payload.message?.length, 300);
  assert.equal(payload.conversation_id, '1af561e4-09ed-46b2-9e05-cdc8299ddeeb');
  assert.equal(payload.http_status, 0);
  assert.equal(payload.platform, 'android-web');
  assert.equal(payload.app_version, '0557f82145db');
});

test('empty and out-of-range fields are left out', () => {
  const payload = chatErrorPayload(
    { code: 'send_network', message: '   ', httpStatus: 700, conversationId: null },
    { userAgent: DESKTOP, appVersion: null },
  );
  assert.deepEqual(payload, { code: 'send_network', platform: 'web' });
});

test('the platform comes from the user agent', () => {
  assert.equal(platformOf(ANDROID), 'android-web');
  assert.equal(platformOf(IPHONE), 'ios-web');
  assert.equal(platformOf(DESKTOP), 'web');
});

test('the same code for the same chat goes once a minute; another chat or code goes', () => {
  const allow = createReportGate();
  const stall = { code: 'stream_stall' as const, conversationId: 'chat-a' };
  assert.equal(allow(stall, 0), true);
  assert.equal(allow(stall, 59_999), false);
  assert.equal(allow({ ...stall, conversationId: 'chat-b' }, 1_000), true);
  assert.equal(allow({ code: 'picture_load_failed', conversationId: 'chat-a' }, 1_000), true);
  assert.equal(allow(stall, 60_000), true);
});

test('no more than ten reports a minute in all', () => {
  const allow = createReportGate();
  for (let i = 0; i < 10; i += 1) assert.equal(allow({ code: 'stream_stall', conversationId: `chat-${i}` }, i), true);
  assert.equal(allow({ code: 'stream_stall', conversationId: 'chat-10' }, 100), false);
  assert.equal(allow({ code: 'stream_stall', conversationId: 'chat-10' }, 60_000), true);
});
