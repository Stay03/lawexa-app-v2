import type { UserBoxStatus } from '@/types/user-box';

/**
 * machine-model — the rules of the "Lawexa's machine" panel (Userbox v1,
 * thread f09347fd), with no React, no socket and no DOM, so a test pins each
 * one: what the panel shows, who drives, where a point on the panel lands on
 * the machine's display, and which keys go to it as what.
 *
 * THE DISPLAY is 1280 by 800 (the box's `BOX_WIDTH`/`BOX_HEIGHT`), and its
 * pictures are the whole display at that size, so a point in the picture is
 * the point to click (docs/api.md). The panel draws the picture scaled to its
 * width, and every point the person touches is scaled back.
 */

export const DISPLAY = { width: 1280, height: 800 } as const;

/** What the panel shows. */
export type MachinePhase =
  /** Reading the machine's state. */
  | { kind: 'loading' }
  /** The machines are off, or this account may not use one: nothing is shown. */
  | { kind: 'hidden' }
  /** Waking the machine (opening the panel wakes it). */
  | { kind: 'starting' }
  /** Asleep, and the wake did not happen or failed: a Wake button, and why. */
  | { kind: 'asleep'; problem: string | null }
  /** Awake: the live view. */
  | { kind: 'live' }
  /** The state could not be read. */
  | { kind: 'error'; message: string };

export interface MachineInputs {
  /** The state read: pending, refused with its status, or in. */
  read: { status: 'pending' } | { status: 'error'; httpStatus: number; message: string | null } | { status: 'ok'; box: UserBoxStatus };
  /** The wake asked for since the panel opened. */
  wake: { status: 'idle' | 'pending' } | { status: 'error'; httpStatus: number; reason: string | null; message: string | null } | { status: 'done' };
}

/** Why a wake failed, in the person's words. */
export function wakeProblem(httpStatus: number, reason: string | null, message: string | null): string {
  if (reason === 'cap' || httpStatus === 429) return 'Every machine is in use right now. Try again in a few minutes.';
  if (reason === 'off') return 'The machines are off.';
  return message?.trim() || 'The machine did not start. Try again.';
}

export function machinePhase({ read, wake }: MachineInputs): MachinePhase {
  if (read.status === 'pending') return { kind: 'loading' };
  if (read.status === 'error') {
    // 403: not Researcher or above. Nothing to show, like the machines being off.
    if (read.httpStatus === 403 || read.httpStatus === 404) return { kind: 'hidden' };
    return { kind: 'error', message: read.message?.trim() || 'Lawexa’s machine did not load. Try again.' };
  }
  const { box } = read;
  if (!box.enabled) return { kind: 'hidden' };
  // Live only while the read says awake: a wake's answer lands as awake, and a
  // machine that went to sleep since (15 idle minutes) offers Wake again.
  if (box.state === 'awake') return { kind: 'live' };
  if (wake.status === 'pending') return { kind: 'starting' };
  if (wake.status === 'error') return { kind: 'asleep', problem: wakeProblem(wake.httpStatus, wake.reason, wake.message) };
  return { kind: 'asleep', problem: null };
}

/** Who drives, and what the panel offers for it. */
export type MachineControl =
  /** Lawexa drives: the person may take it. */
  | { who: 'lawexa'; action: 'take-over' }
  /** The person drives because Lawexa asked: its request, and Done. */
  | { who: 'you'; reason: 'hand_over'; message: string; action: 'done' }
  /** The person drives because they acted: Done gives it back. */
  | { who: 'you'; reason: 'user_acted'; message: null; action: 'done' };

/** Lawexa's words when it hands the machine over without a message of its own. */
export const HAND_OVER_FALLBACK = 'Lawexa needs you to do this part. When you have finished, press Done.';

export function machineControl(box: Pick<UserBoxStatus, 'control' | 'control_reason' | 'hand_over_message'>): MachineControl {
  if (box.control !== 'user') return { who: 'lawexa', action: 'take-over' };
  if (box.control_reason === 'hand_over') {
    return { who: 'you', reason: 'hand_over', message: box.hand_over_message?.trim() || HAND_OVER_FALLBACK, action: 'done' };
  }
  return { who: 'you', reason: 'user_acted', message: null, action: 'done' };
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Where a point on the drawn picture lands on the display, in whole display
 * pixels, or `null` outside the picture. `rect` is the picture's box on the
 * page (the canvas keeps the display's shape, so it is never letterboxed).
 */
export function toDisplayPoint(clientX: number, clientY: number, rect: Rect): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const fx = (clientX - rect.left) / rect.width;
  const fy = (clientY - rect.top) / rect.height;
  if (fx < 0 || fy < 0 || fx > 1 || fy > 1) return null;
  return {
    x: Math.min(DISPLAY.width - 1, Math.floor(fx * DISPLAY.width)),
    y: Math.min(DISPLAY.height - 1, Math.floor(fy * DISPLAY.height)),
  };
}

/** Where Lawexa's cursor sits over the picture, as percentages of its box. */
export function cursorPosition(x: number, y: number): { left: string; top: string } {
  const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));
  return {
    left: `${(clamp(x, DISPLAY.width) / DISPLAY.width) * 100}%`,
    top: `${(clamp(y, DISPLAY.height) / DISPLAY.height) * 100}%`,
  };
}

/** A key the person pressed over the picture, as the box takes it. */
export type BoxKey = { type: 'key'; key: string } | { type: 'type'; text: string };

/** The keys the box names (docs/api.md: 'Enter', 'ctrl+l', 'alt+Left'). */
const NAMED_KEYS: Record<string, string> = {
  Enter: 'Enter',
  Escape: 'Escape',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
};

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

/**
 * The key as the box takes it, or `null` for one it does not (a modifier on
 * its own, a dead key). A printable character with no Ctrl, Alt or Cmd is
 * typed; a named key or a combo is pressed, with its modifiers first. Cmd is
 * sent as Ctrl, since the machine is Linux and Cmd+C on a Mac means Ctrl+C
 * there.
 */
export function toBoxKey(event: KeyLike): BoxKey | null {
  const named = NAMED_KEYS[event.key] ?? (/^F([1-9]|1[0-2])$/.test(event.key) ? event.key : null);
  const ctrl = event.ctrlKey || event.metaKey;
  const combo = ctrl || event.altKey;
  if (!named && event.key.length !== 1) return null;
  if (!named && !combo) return { type: 'type', text: event.key };
  const main = named ?? (event.key === ' ' ? 'space' : event.key.toLowerCase());
  if (!/^[A-Za-z0-9_]+$/.test(main)) return null;
  const modifiers = [ctrl ? 'ctrl' : null, event.altKey ? 'alt' : null, event.shiftKey ? 'shift' : null].filter(Boolean);
  return { type: 'key', key: [...modifiers, main].join('+') };
}

/** A wheel turn as the box takes it: whole pixels, never zero. */
export function scrollDelta(deltaY: number, deltaMode: number): number | null {
  // deltaMode 1 is lines, 2 pages: a line is about 40px, a page about the display.
  const pixels = deltaMode === 1 ? deltaY * 40 : deltaMode === 2 ? deltaY * DISPLAY.height : deltaY;
  const dy = Math.round(pixels);
  return dy === 0 ? null : Math.max(-100_000, Math.min(100_000, dy));
}

/** The view token lasts 10 minutes; a fresh one is read this long before it ends. */
export const VIEW_REFRESH_LEAD_MS = 2 * 60 * 1000;

/** When to read a fresh view address, in ms from now (0 when it is already due). */
export function viewRefreshIn(expiresAt: string | null | undefined, now: number): number | null {
  if (!expiresAt) return null;
  const at = Date.parse(expiresAt);
  if (Number.isNaN(at)) return null;
  return Math.max(0, at - VIEW_REFRESH_LEAD_MS - now);
}

/** A tool step Lawexa ran on the machine. */
export function isBoxTool(toolName: string | null | undefined): boolean {
  return typeof toolName === 'string' && toolName.startsWith('box_');
}
