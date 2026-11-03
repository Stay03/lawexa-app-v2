import type { BoxKey } from './machine-model';

/**
 * view-socket — the live view of Lawexa's machine (Userbox v1): one
 * WebSocket to `wss://userbox.lawexa.com/boxes/{uuid}/view?token=…`
 * (docs/api.md, "Live view").
 *
 *   machine → panel, binary  a JPEG of the whole display, sent when it changed
 *   machine → panel, text    {type:'lawexa_action', kind, x, y}: draw Lawexa's
 *                            cursor (x and y are null for typing and keys);
 *                            {type:'mode', mode} when control changes
 *   panel → machine, text    the person's own clicks, moves, presses, wheel
 *                            turns, keys and typing, in display pixels
 *
 * No React here, and the WebSocket class is passed in, so a test drives it
 * with a fake one. Reconnecting is the caller's (`MachineScreen.tsx`): it
 * holds the fresh address.
 */

export type ViewerEvent =
  | { type: 'move'; x: number; y: number }
  | { type: 'down' | 'up'; x: number; y: number; button: 'left' | 'middle' | 'right' }
  | { type: 'scroll'; x: number; y: number; dy: number }
  | BoxKey;

export interface LawexaAction {
  kind: string;
  x: number | null;
  y: number | null;
}

export interface ViewHandlers {
  onFrame: (frame: Blob) => void;
  onLawexaAction: (action: LawexaAction) => void;
  onMode: (mode: 'lawexa' | 'user') => void;
  /** `open` once connected; `closed` when it ends, for any reason. */
  onStatus: (status: 'open' | 'closed') => void;
}

/** The slice of the browser's WebSocket the view uses. */
export type ViewSocketLike = Pick<WebSocket, 'binaryType' | 'readyState' | 'onopen' | 'onclose' | 'onerror' | 'onmessage' | 'send' | 'close'>;

export type ViewSocketFactory = (url: string) => ViewSocketLike;

const OPEN = 1;

/** One text message from the machine, or `null` for one the panel does not use. */
export function parseMachineMessage(
  raw: string,
): { type: 'lawexa_action'; action: LawexaAction } | { type: 'mode'; mode: 'lawexa' | 'user' } | null {
  let message: unknown;
  try {
    message = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof message !== 'object' || message === null) return null;
  const record = message as Record<string, unknown>;
  if (record.type === 'mode' && (record.mode === 'lawexa' || record.mode === 'user')) return { type: 'mode', mode: record.mode };
  if (record.type === 'lawexa_action' && typeof record.kind === 'string') {
    const coordinate = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
    return { type: 'lawexa_action', action: { kind: record.kind, x: coordinate(record.x), y: coordinate(record.y) } };
  }
  return null;
}

export function openMachineView(url: string, handlers: ViewHandlers, create: ViewSocketFactory) {
  const socket = create(url);
  socket.binaryType = 'blob';
  let ended = false;

  socket.onopen = () => handlers.onStatus('open');
  socket.onmessage = (event) => {
    const data = event.data;
    if (typeof data === 'string') {
      const message = parseMachineMessage(data);
      if (message?.type === 'lawexa_action') handlers.onLawexaAction(message.action);
      else if (message?.type === 'mode') handlers.onMode(message.mode);
      return;
    }
    if (typeof Blob !== 'undefined' && data instanceof Blob) handlers.onFrame(data);
  };
  const end = () => {
    if (ended) return;
    ended = true;
    handlers.onStatus('closed');
  };
  socket.onclose = end;
  socket.onerror = end;

  return {
    /** Send one of the person's inputs; false while the view is not open. */
    send(event: ViewerEvent): boolean {
      if (socket.readyState !== OPEN) return false;
      socket.send(JSON.stringify(event));
      return true;
    },
    close() {
      ended = true;
      socket.onopen = socket.onclose = socket.onerror = null;
      socket.onmessage = null;
      socket.close();
    },
  };
}

export type MachineView = ReturnType<typeof openMachineView>;
