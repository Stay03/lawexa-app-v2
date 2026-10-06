import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientIpFrom } from './client-ip';

const from = (values: Record<string, string>) => clientIpFrom(new Headers(values));

test('a forged X-Forwarded-For from the visitor is never forwarded; the proxy entry is', () => {
  assert.equal(from({ 'x-forwarded-for': '8.8.8.8, 102.89.33.4' }), '102.89.33.4');
});

test('a single entry written by the proxy is the visitor', () => {
  assert.equal(from({ 'x-forwarded-for': '102.89.33.4' }), '102.89.33.4');
});

test('the proxy-written X-Forwarded-For entry beats a visitor-sent X-Real-IP', () => {
  assert.equal(from({ 'x-real-ip': '8.8.8.8', 'x-forwarded-for': '8.8.8.8, 102.89.33.4' }), '102.89.33.4');
  assert.equal(from({ 'x-real-ip': '8.8.8.8', 'x-forwarded-for': '102.89.33.4' }), '102.89.33.4');
});

test('X-Real-IP is the fallback when X-Forwarded-For is missing or malformed', () => {
  assert.equal(from({ 'x-real-ip': '102.89.33.4' }), '102.89.33.4');
  assert.equal(from({ 'x-real-ip': '102.89.33.4', 'x-forwarded-for': '8.8.8.8, garbage' }), '102.89.33.4');
});

test('an IPv6 address passes', () => {
  assert.equal(from({ 'x-forwarded-for': '8.8.8.8, 2a02:c7c::1' }), '2a02:c7c::1');
  assert.equal(from({ 'x-real-ip': '2a02:c7c::1' }), '2a02:c7c::1');
});

test('a malformed X-Real-IP with no X-Forwarded-For gives no address', () => {
  assert.equal(from({ 'x-real-ip': 'garbage' }), null);
});

test('a malformed value gives no address rather than a wrong one', () => {
  assert.equal(from({ 'x-forwarded-for': '8.8.8.8, not-an-ip' }), null);
  assert.equal(from({ 'x-forwarded-for': '999.1.1.1' }), null);
  assert.equal(from({}), null);
});
