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

/*
 * A message the person types gives the machine back to Lawexa, as Done does
 * (Stay, 12 November 2026, card 9bab169f; the server's takeBackOnMessage), so
 * the panel offers both ways.
 */

/** Lawexa's words when it hands the machine over without a message of its own. */
export const HAND_OVER_FALLBACK = 'Lawexa needs you to do this part. When you have finished, tell Lawexa or press Done.';

/** The panel's words while the person has the machine because they acted on it. */
export const YOU_HAVE_THE_MACHINE = 'You have the machine. Tell Lawexa what to do next, or press Done.';

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

const CLOCK = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });

/** "11:12 am" for an ISO time, or '' when it cannot be read. */
export function clockAt(iso: string): string {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? '' : CLOCK.format(time);
}

/**
 * What the panel says while Lawexa waits for the person after a hand-over
 * (Arthur's 3, thread 38ad195b): calm before the 10-minute reminder, a
 * stronger line after it. Null when Lawexa is not waiting.
 */
export function waitingLine(
  waiting: { remind_at: string; stops_at: string } | null | undefined,
  now: number,
): { tone: 'calm' | 'reminded'; text: string } | null {
  if (!waiting) return null;
  const stops = clockAt(waiting.stops_at);
  if (!stops) return null;
  if (now >= Date.parse(waiting.remind_at)) {
    return { tone: 'reminded', text: `Lawexa has waited 10 minutes. It stops waiting at ${stops}.` };
  }
  return { tone: 'calm', text: `Lawexa waits for you until ${stops}.` };
}

/** The line on a chat whose answer needs the machine while another chat holds it (Arthur's 5). */
export function inUseLine(title: string): string {
  return `Lawexa’s machine is in use in “${title}”. Finish there, or free it here.`;
}

/** A tool step Lawexa ran on the machine. */
export function isBoxTool(toolName: string | null | undefined): boolean {
  return typeof toolName === 'string' && toolName.startsWith('box_');
}

/**
 * What the chat's hand-over step offers (thread 38ad195b):
 * - `waiting`: Lawexa handed the machine over in THIS chat and waits for
 *   Done, so the step offers "Open the machine and press Done";
 * - `over`: Done, a message, the 30-minute stop or another chat's hand-over
 *   has moved it on, and Done here would do nothing, so the step offers
 *   nothing more;
 * - `unread`: the status has not arrived, so the step offers only the plain
 *   way in, which is right in both cases (the e2e stack took 6 s to answer).
 * A server before `held_by` (absent) is trusted on control alone.
 */
export function handOverState(
  box: Pick<UserBoxStatus, 'control' | 'control_reason' | 'held_by'> | null,
  conversationUuid: string | null,
): 'waiting' | 'over' | 'unread' {
  if (!box) return 'unread';
  if (box.control !== 'user' || box.control_reason !== 'hand_over') return 'over';
  if (box.held_by && conversationUuid && box.held_by.conversation_uuid !== conversationUuid) return 'over';
  return 'waiting';
}

/** The footer's line when no chat holds the machine (Lucy's live test, 20 November 2026). */
export const MACHINE_FREE_LINE = 'The machine is free. Take over to use it yourself.';

/** Freed, with nothing to carry on (the person already wrote again there). */
export const FREED_CARD_LINE = 'The machine is free. Send a message to carry on.';

/** The in-use card once its button freed the machine and Lawexa carries on (Arthur's a). */
export const CARRIED_ON_LINE = 'You freed the machine. Lawexa is carrying on.';

/** The in-use card once the chat it named no longer holds the machine, after a reload too. */
export function noLongerInUseLine(title: string): string {
  return `Lawexa’s machine is no longer in use in “${title}”.`;
}

/**
 * A release's answer, split: the machine for the read, and whether a chat
 * carries on (and which turn to follow).
 */
export function splitRelease<T extends { resumed?: boolean; execution_id?: string; conversation_uuid?: string }>(
  answer: T,
): { status: Omit<T, 'resumed' | 'execution_id' | 'conversation_uuid'>; resumedTurn: { executionId: string; conversationUuid: string | null } | null } {
  const { resumed, execution_id: executionId, conversation_uuid: conversationUuid, ...status } = answer;
  return {
    status,
    resumedTurn: resumed && executionId ? { executionId, conversationUuid: conversationUuid ?? null } : null,
  };
}

/**
 * Lawexa has the machine but no chat is using it: a reply ended, or a chat
 * freed it. The panel then says "Not in use" instead of "Lawexa is using it".
 * A server before `held_by` (absent) keeps the old words.
 */
export function machineFree(box: Pick<UserBoxStatus, 'control' | 'held_by'> | null): boolean {
  return box !== null && box.control !== 'user' && box.held_by === null;
}

/**
 * What the in-use card under an answer offers (thread 38ad195b):
 * - `held`: the chat it names still holds the machine, so "Open that chat" and
 *   "Free it and use it here";
 * - `freed`: that chat no longer holds it (freed here or elsewhere, Done, the
 *   30-minute stop), so a plain line and no buttons, after a reload too;
 * - `unread`: the status has not arrived; the card shows as the answer saved it.
 * A server before `held_by` (absent) is trusted to still hold it.
 */
export function inUseCardState(
  box: Pick<UserBoxStatus, 'held_by'> | null,
  holderUuid: string,
): 'held' | 'freed' | 'unread' {
  if (!box) return 'unread';
  if (box.held_by === undefined) return 'held';
  return box.held_by?.conversation_uuid === holderUuid ? 'held' : 'freed';
}

/**
 * What a refused "Free it" says, and whether the machine was freed anyway
 * (Backend, 20 November 2026):
 * - 409 `machine_busy`: the chat holding it is still answering; nothing freed;
 * - 422 (`no_balance`, `not_resumable`) or another 409 (`busy`: this chat's
 *   own send holds it): the machine IS freed, but this chat does not carry on;
 * - anything else (404: not a chat the person can send in): nothing freed.
 * The server's own sentence is shown when it sends one.
 */
export function releaseRefusal(
  status: number,
  reason: string | null,
  message: string | null,
  holderTitle: string | null,
): { text: string; machineFreed: boolean } {
  if (status === 409 && reason === 'machine_busy') {
    return {
      text: holderTitle
        ? `Lawexa is still answering in “${holderTitle}”. Free the machine when it has finished.`
        : 'Lawexa is still answering in that chat. Free the machine when it has finished.',
      machineFreed: false,
    };
  }
  if (status === 422 || status === 409) {
    return { text: message || 'The machine is free, but Lawexa could not carry on here. Send a message to carry on.', machineFreed: true };
  }
  return { text: message || 'The machine was not freed. Try again.', machineFreed: false };
}

