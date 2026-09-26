/**
 * AuthedEventSource — an EventSource that sends the login token in a header.
 *
 * WHY THIS EXISTS. The browser's `EventSource` cannot send request headers, so the
 * chat stream used to carry the user's full login token in its web address
 * (`/api/chat/stream/{id}?token=…`). Addresses end up in server logs, proxy logs
 * and browser history, so the token could leak from any of them. This reader does
 * the same job over `fetch`, with `Authorization: Bearer …`, and nothing secret
 * in the address.
 *
 * WHY NOT A ONE-USE TICKET IN THE ADDRESS. A browser `EventSource` reconnects on
 * its own to the SAME address after a network drop; a ticket spent on the first
 * connection would fail on that reconnect and end the live answer.
 *
 * DROP-IN FOR THE THREE CALLERS (v2 chat engine, v1 `useChatStream`, v1 floating
 * prompt). It keeps the parts of the `EventSource` contract they rely on:
 *   - `addEventListener(type, fn)` receives a `MessageEvent` with `data` and
 *     `lastEventId` for every server event of that type;
 *   - a connection failure fires an `error` event WITHOUT `data` (the callers'
 *     `error` listeners skip those and leave them to `onerror`) and then `onerror`;
 *   - `readyState` is CONNECTING (0) while it reconnects on its own after a drop,
 *     and CLOSED (2) once it has given up; the callers only step in at CLOSED;
 *   - reconnects send `Last-Event-ID`, so the API replays what was missed.
 *
 * DIFFERENCE, BY DESIGN: `status` holds the HTTP status of the last failed
 * response, so a caller can tell an expired login (401) from a dropped network.
 * Like `EventSource`, a non-2xx answer or a body that is not an event stream is
 * final (CLOSED); only a connection that opened and then broke is retried.
 *
 * WIRE FORMAT (ChatStreamController::formatEvent, lawexa-api-v3): optional `id:`,
 * `event:`, one `data:` line, an optional `: xxx…` comment that pads fast events to
 * ~1300 bytes, then a blank line. Parsed per the HTML standard's SSE rules, so any
 * line ending, split chunk or multi-line `data` also works.
 */

export const CONNECTING = 0;
export const OPEN = 1;
export const CLOSED = 2;
export type ReadyState = typeof CONNECTING | typeof OPEN | typeof CLOSED;

export interface AuthedEventSourceOptions {
  /** Read on EVERY connect and reconnect, so a refreshed login is picked up. */
  getToken: () => string | null | undefined;
  /** Wait before reconnecting after a drop; the server's `retry:` overrides it. */
  reconnectDelayMs?: number;
}

type Listener = (event: MessageEvent<string>) => void;

/** Chrome's own `EventSource` default. */
const DEFAULT_RECONNECT_DELAY_MS = 3000;

export class AuthedEventSource {
  readonly url: string;
  readyState: ReadyState = CONNECTING;
  /** HTTP status of the last response that was not an event stream; 0 for a network failure. */
  status = 0;
  onerror: ((event: Event) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;

  private readonly getToken: () => string | null | undefined;
  private reconnectDelayMs: number;
  private readonly listeners = new Map<string, Set<Listener>>();
  private controller: AbortController | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastEventId = '';

  constructor(url: string, options: AuthedEventSourceOptions) {
    this.url = url;
    this.getToken = options.getToken;
    this.reconnectDelayMs = options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
    // Start on the next task, as `new EventSource()` does, so listeners attached
    // right after construction see the first events.
    this.reconnectTimer = setTimeout(() => this.connect(), 0);
  }

  addEventListener(type: string, listener: Listener): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  /**
   * Read through a method: `close()` can run from a listener while a read is
   * awaited, which TypeScript's narrowing of the field cannot see.
   */
  private isClosed(): boolean {
    return this.readyState === CLOSED;
  }

  close(): void {
    this.readyState = CLOSED;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.controller?.abort();
    this.controller = null;
  }

  private async connect(): Promise<void> {
    this.reconnectTimer = null;
    if (this.readyState === CLOSED) return;
    const token = this.getToken();
    if (!token) {
      this.status = 401;
      this.fail();
      return;
    }
    const controller = new AbortController();
    this.controller = controller;
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
    };
    if (this.lastEventId) headers['Last-Event-ID'] = this.lastEventId;

    let response: Response;
    try {
      response = await fetch(this.url, { headers, cache: 'no-store', signal: controller.signal });
    } catch {
      // Could not connect at all (offline, DNS, CORS). EventSource retries this.
      if (controller.signal.aborted) return;
      this.status = 0;
      this.drop();
      return;
    }
    if (controller.signal.aborted) return;

    const type = response.headers.get('content-type') ?? '';
    if (!response.ok || !type.includes('text/event-stream') || !response.body) {
      // Final, as for EventSource: a 401/403/404/500 does not get better by retrying.
      this.status = response.status;
      response.body?.cancel().catch(() => {});
      this.fail();
      return;
    }

    this.status = response.status;
    this.readyState = OPEN;
    const opened = new Event('open');
    this.onopen?.(opened);

    try {
      await this.read(response.body, controller.signal);
    } catch {
      // Falls through: a read that broke is a drop.
    }
    if (controller.signal.aborted || this.isClosed()) return;
    // The server ended the stream, or the connection broke: reconnect, as EventSource does.
    this.drop();
  }

  /** Reads the body and dispatches each event. Resolves when the body ends. */
  private async read(body: ReadableStream<Uint8Array>, signal: AbortSignal): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let firstChunk = true;
    let eventType = '';
    let data = '';
    let hasData = false;
    let pendingId: string | null = null;

    const dispatch = () => {
      if (pendingId !== null) this.lastEventId = pendingId;
      pendingId = null;
      if (hasData) {
        const type = eventType || 'message';
        const text = data.endsWith('\n') ? data.slice(0, -1) : data;
        this.emit(type, new MessageEvent<string>(type, { data: text, lastEventId: this.lastEventId }));
      }
      eventType = '';
      data = '';
      hasData = false;
    };

    const line = (raw: string) => {
      if (raw === '') {
        dispatch();
        return;
      }
      if (raw.startsWith(':')) return; // comment: the API's padding and keep-alives
      const colon = raw.indexOf(':');
      const field = colon === -1 ? raw : raw.slice(0, colon);
      let value = colon === -1 ? '' : raw.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      switch (field) {
        case 'event':
          eventType = value;
          break;
        case 'data':
          data += value + '\n';
          hasData = true;
          break;
        case 'id':
          if (!value.includes('\0')) pendingId = value;
          break;
        case 'retry':
          if (/^\d+$/.test(value)) this.reconnectDelayMs = Number(value);
          break;
        default:
          break; // unknown fields are ignored
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (signal.aborted || this.readyState === CLOSED) {
        reader.cancel().catch(() => {});
        return;
      }
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (firstChunk) {
        if (buffer.charCodeAt(0) === 0xfeff) buffer = buffer.slice(1);
        firstChunk = false;
      }
      // Split on CRLF, LF or CR. A CR at the very end may be half of a CRLF that
      // the next chunk completes, so it waits for more bytes.
      let start = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const ch = buffer[i];
        if (ch !== '\n' && ch !== '\r') continue;
        if (ch === '\r' && i === buffer.length - 1) break;
        line(buffer.slice(start, i));
        if (ch === '\r' && buffer[i + 1] === '\n') i += 1;
        start = i + 1;
        if (this.isClosed()) return; // a listener closed us mid-chunk
      }
      buffer = buffer.slice(start);
    }
    // An event not ended by a blank line when the stream ends is discarded (per spec).
  }

  private emit(type: string, event: MessageEvent<string> | Event): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const listener of [...set]) {
      if (this.readyState === CLOSED && type !== 'error') return;
      listener(event as MessageEvent<string>);
    }
  }

  /** The connection broke after opening, or could not open: retry after the delay. */
  private drop(): void {
    this.controller = null;
    this.readyState = CONNECTING;
    this.announceError();
    if (this.readyState !== CONNECTING) return; // a handler closed it
    this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelayMs);
  }

  /** A final failure: no retry. */
  private fail(): void {
    this.controller = null;
    this.readyState = CLOSED;
    this.announceError();
  }

  /** Mirrors EventSource: an `error` event with no data, then `onerror`. */
  private announceError(): void {
    const event = new Event('error');
    this.emit('error', event);
    this.onerror?.(event);
  }
}
