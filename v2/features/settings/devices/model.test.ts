import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Session } from '@/types/auth';
import { deviceKind, deviceLabel, splitSessions } from './model';

const session = (over: Partial<Session> & { device?: Session['device'] }): Session => ({
  id: 1,
  name: 'token',
  device: null,
  last_used_at: '2026-09-28T03:00:00Z',
  created_at: '2026-08-05T19:48:53Z',
  is_current: false,
  ...over,
});
const device = (over: Partial<NonNullable<Session['device']>>): Session['device'] => ({
  name: null,
  type: null,
  browser: null,
  platform: null,
  location: null,
  ip_address: null,
  ...over,
});

test('a browser on a platform is named by both', () => {
  assert.equal(deviceLabel(session({ device: device({ browser: 'Chrome', platform: 'Windows' }) })), 'Chrome on Windows');
});

test('a script token is named by the API, as the live answer showed ("Curl", type bot)', () => {
  const s = session({ name: 'Curl', device: device({ name: 'Curl', type: 'bot' }) });
  assert.equal(deviceLabel(s), 'Curl');
  assert.equal(deviceKind(s), 'other');
});

test('no device row falls back to the token name, then to "Unknown device"', () => {
  assert.equal(deviceLabel(session({ name: 'iPhone app', device: null })), 'iPhone app');
  assert.equal(deviceLabel(session({ name: '  ', device: null })), 'Unknown device');
});

test('the known kinds keep their icon; anything else is "other"', () => {
  assert.equal(deviceKind(session({ device: device({ type: 'phone' }) })), 'phone');
  assert.equal(deviceKind(session({ device: null })), 'other');
});

test('the current device is split out, and the others run most recent first', () => {
  const list = [
    session({ id: 1, last_used_at: '2026-09-20T10:00:00Z' }),
    session({ id: 2, is_current: true }),
    session({ id: 3, last_used_at: '2026-09-27T10:00:00Z' }),
    session({ id: 4, last_used_at: null }),
  ];
  const { current, others } = splitSessions(list);
  assert.equal(current?.id, 2);
  assert.deepEqual(others.map((s) => s.id), [3, 1, 4]);
});

test('with no current session, every session is an "other"', () => {
  const { current, others } = splitSessions([session({ id: 1 }), session({ id: 2 })]);
  assert.equal(current, null);
  assert.equal(others.length, 2);
});
