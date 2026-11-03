import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { UserBoxStatus } from '@/types/user-box';
import {
  cursorPosition,
  HAND_OVER_FALLBACK,
  isBoxTool,
  machineControl,
  machinePhase,
  scrollDelta,
  toBoxKey,
  toDisplayPoint,
  viewRefreshIn,
  type KeyLike,
} from './machine-model';

/* The "Lawexa's machine" panel (Userbox v1, thread f09347fd): what it shows,
 * who drives, where a touch lands on the 1280x800 display, and which keys go
 * to the machine as what. */

const box = (extra: Partial<UserBoxStatus> = {}): UserBoxStatus => ({
  enabled: true,
  state: 'asleep',
  control: 'lawexa',
  control_reason: null,
  hand_over_message: null,
  view: { url: 'wss://userbox.test/boxes/u/view?token=t', expires_at: '2026-11-03T18:10:00Z' },
  ...extra,
});

test('the panel reads, wakes the machine, then shows it live', () => {
  assert.deepEqual(machinePhase({ read: { status: 'pending' }, wake: { status: 'idle' } }), { kind: 'loading' });
  const asleep = { status: 'ok' as const, box: box() };
  assert.deepEqual(machinePhase({ read: asleep, wake: { status: 'idle' } }), { kind: 'asleep', problem: null });
  assert.deepEqual(machinePhase({ read: asleep, wake: { status: 'pending' } }), { kind: 'starting' });
  // A machine that went back to sleep after a wake offers Wake again.
  assert.deepEqual(machinePhase({ read: asleep, wake: { status: 'done' } }), { kind: 'asleep', problem: null });
  // Already awake: live at once.
  assert.deepEqual(machinePhase({ read: { status: 'ok', box: box({ state: 'awake' }) }, wake: { status: 'idle' } }), { kind: 'live' });
});

test('a full house or an off switch says why; the machines off or a non-staff account show nothing', () => {
  const asleep = { status: 'ok' as const, box: box() };
  const full = machinePhase({ read: asleep, wake: { status: 'error', httpStatus: 429, reason: 'cap', message: null } });
  assert.equal(full.kind, 'asleep');
  assert.match(full.kind === 'asleep' ? (full.problem ?? '') : '', /Every machine is in use/);
  assert.deepEqual(machinePhase({ read: { status: 'ok', box: box({ enabled: false }) }, wake: { status: 'idle' } }), { kind: 'hidden' });
  assert.deepEqual(machinePhase({ read: { status: 'error', httpStatus: 403, message: null }, wake: { status: 'idle' } }), { kind: 'hidden' });
  const failed = machinePhase({ read: { status: 'error', httpStatus: 500, message: null }, wake: { status: 'idle' } });
  assert.equal(failed.kind, 'error');
});

test('who drives: Lawexa offers Take over; a hand-over shows its request and Done', () => {
  assert.deepEqual(machineControl(box()), { who: 'lawexa', action: 'take-over' });
  assert.deepEqual(machineControl(box({ control: 'user', control_reason: 'hand_over', hand_over_message: ' Log in to CAC, then press Done. ' })), {
    who: 'you',
    reason: 'hand_over',
    message: 'Log in to CAC, then press Done.',
    action: 'done',
  });
  assert.equal(machineControl(box({ control: 'user', control_reason: 'hand_over', hand_over_message: null })).who, 'you');
  assert.equal((machineControl(box({ control: 'user', control_reason: 'hand_over' })) as { message: string }).message, HAND_OVER_FALLBACK);
  assert.deepEqual(machineControl(box({ control: 'user', control_reason: 'user_acted' })), { who: 'you', reason: 'user_acted', message: null, action: 'done' });
});

test('a touch on the drawn picture lands on the display in whole pixels, scaled', () => {
  // The picture drawn at 640x400, 100px in and 50px down.
  const rect = { left: 100, top: 50, width: 640, height: 400 };
  assert.deepEqual(toDisplayPoint(100, 50, rect), { x: 0, y: 0 });
  assert.deepEqual(toDisplayPoint(420, 250, rect), { x: 640, y: 400 });
  // The far corner stays on the display.
  assert.deepEqual(toDisplayPoint(740, 450, rect), { x: 1279, y: 799 });
  // Outside the picture: nothing.
  assert.equal(toDisplayPoint(99, 60, rect), null);
  assert.equal(toDisplayPoint(200, 451, rect), null);
  assert.equal(toDisplayPoint(1, 1, { left: 0, top: 0, width: 0, height: 0 }), null);
  // Lawexa's cursor goes back the other way, as percentages.
  assert.deepEqual(cursorPosition(640, 200), { left: '50%', top: '25%' });
  assert.deepEqual(cursorPosition(-5, 9000), { left: '0%', top: '100%' });
});

const key = (k: string, mods: Partial<KeyLike> = {}): KeyLike => ({ key: k, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...mods });

test('keys go to the machine as the box names them', () => {
  assert.deepEqual(toBoxKey(key('a')), { type: 'type', text: 'a' });
  assert.deepEqual(toBoxKey(key('A', { shiftKey: true })), { type: 'type', text: 'A' });
  assert.deepEqual(toBoxKey(key('@', { shiftKey: true })), { type: 'type', text: '@' });
  assert.deepEqual(toBoxKey(key('Enter')), { type: 'key', key: 'Enter' });
  assert.deepEqual(toBoxKey(key('ArrowLeft', { altKey: true })), { type: 'key', key: 'alt+Left' });
  assert.deepEqual(toBoxKey(key('l', { ctrlKey: true })), { type: 'key', key: 'ctrl+l' });
  // Cmd on a Mac is Ctrl on the machine.
  assert.deepEqual(toBoxKey(key('v', { metaKey: true })), { type: 'key', key: 'ctrl+v' });
  assert.deepEqual(toBoxKey(key('T', { ctrlKey: true, shiftKey: true })), { type: 'key', key: 'ctrl+shift+t' });
  assert.deepEqual(toBoxKey(key('Tab', { shiftKey: true })), { type: 'key', key: 'shift+Tab' });
  assert.deepEqual(toBoxKey(key('F5')), { type: 'key', key: 'F5' });
  // A modifier alone, a dead key, a punctuation combo the box cannot name: nothing.
  assert.equal(toBoxKey(key('Shift', { shiftKey: true })), null);
  assert.equal(toBoxKey(key('Dead')), null);
  assert.equal(toBoxKey(key('/', { ctrlKey: true })), null);
});

test('a wheel turn is whole pixels, never zero; the view address is read again before it lapses', () => {
  assert.equal(scrollDelta(120, 0), 120);
  assert.equal(scrollDelta(3, 1), 120);
  assert.equal(scrollDelta(0.2, 0), null);
  assert.equal(scrollDelta(-1, 2), -800);
  const now = Date.parse('2026-11-03T18:00:00Z');
  assert.equal(viewRefreshIn('2026-11-03T18:10:00Z', now), 8 * 60 * 1000);
  assert.equal(viewRefreshIn('2026-11-03T18:01:00Z', now), 0);
  assert.equal(viewRefreshIn(null, now), null);
  assert.equal(isBoxTool('box_click'), true);
  assert.equal(isBoxTool('search_cases'), false);
});

test('the chat’s side panel opens Lawexa’s machine as machine:live, and nothing else of that kind', async () => {
  const { parseSidePanelValue, sidePanelValue } = await import('@/v2/features/conversations/conversation/side-panel/side-panel-value');
  assert.equal(sidePanelValue({ kind: 'machine' }), 'machine:live');
  assert.deepEqual(parseSidePanelValue('machine:live'), { kind: 'machine' });
  assert.equal(parseSidePanelValue('machine:other'), null);
});
