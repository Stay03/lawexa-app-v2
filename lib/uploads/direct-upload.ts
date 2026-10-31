/**
 * Direct upload: the file goes in parts straight to file storage, so a plan
 * can take files over the 100 MB a request to our server can carry (Stay's
 * "Ok", thread 1c93152c, 31 October 2026; contract agreed with Backend in
 * 384c, 527ce6a4 and b715e677).
 *
 *   1. start     POST /uploads            the server checks the limits and
 *                                         answers the part size and one URL
 *                                         per part
 *   2. parts     PUT  <url> per part      straight to storage, 3 at a time;
 *                                         each answer's ETag is kept
 *   3. complete  POST /uploads/{uuid}/complete
 *   4. checking  GET  /uploads/{uuid}     every 2 s while the server checks
 *                                         the joined file; on `completed` it
 *                                         answers the same file the target's
 *                                         upload answers today
 *
 * A refusal at start, at complete or after the checks has today's 422
 * `UPLOAD_LIMIT_REACHED` shape, so every caller's error handling reads it as
 * before. When the direct path itself cannot run (the storage's CORS rule not
 * set yet, a network fault, a server without the route), a file the old
 * upload can carry goes that way instead (techlead, 31 October 2026).
 *
 * No React and no HTTP client here: the network is passed in as a
 * `DirectUploadTransport`, so node:test drives every branch.
 */

/** Where the file goes, as the start call names it. */
export type UploadTarget =
  | { kind: 'my_files' }
  | { kind: 'space'; spaceUuid: string }
  | { kind: 'channel'; channelUuid: string };

export interface PartUrl {
  number: number;
  url: string;
}

export interface StartAnswer {
  upload_uuid: string;
  /** Bytes per part (10 MB); the last part holds the rest. */
  part_size: number;
  parts: PartUrl[];
  expires_at: string;
}

/** The answer of complete and of the status poll. */
export interface UploadStatus<F> {
  status: 'processing' | 'completed' | 'failed';
  file: F | null;
  /** The UPLOAD_LIMIT_REACHED payload when the checks refused the file. */
  refusal: Record<string, unknown> | null;
}

export interface StartBody {
  target: 'my_files' | 'space' | 'channel';
  space_uuid?: string;
  channel_uuid?: string;
  name: string;
  size: number;
  mime_type: string;
}

/** A part PUT that storage answered with an HTTP status. */
export class PartRejectedError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Storage refused a part (${status}).`);
    this.name = 'PartRejectedError';
    this.status = status;
  }
}

/** The direct path cannot run here; the caller may use today's upload. */
export class DirectUploadUnavailableError extends Error {
  constructor(cause: unknown) {
    super('Direct upload is not available.', { cause });
    this.name = 'DirectUploadUnavailableError';
  }
}

/** The server was still checking the file when the app stopped waiting. */
export class UploadStillCheckingError extends Error {
  constructor() {
    super('The file is uploaded and still being checked. It will appear when the check finishes.');
    this.name = 'UploadStillCheckingError';
  }
}

export interface DirectUploadTransport<F> {
  start: (body: StartBody) => Promise<StartAnswer>;
  partUrls: (uploadUuid: string, numbers: number[]) => Promise<PartUrl[]>;
  complete: (uploadUuid: string, parts: { number: number; etag: string }[]) => Promise<UploadStatus<F>>;
  status: (uploadUuid: string) => Promise<UploadStatus<F>>;
  cancel: (uploadUuid: string) => Promise<void>;
  /**
   * PUT one part's bytes with no auth and no Content-Type; resolve with the
   * answer's ETag. Reject with `PartRejectedError` for an HTTP refusal, and
   * with anything else for a network or CORS fault.
   */
  putPart: (url: string, body: Blob, onSent: (bytes: number) => void, signal: AbortSignal) => Promise<string>;
  /** Wait `ms`, or reject when `signal` aborts. */
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  /** Whether an error from start or complete is a refusal to show (a 4xx answer). */
  isRefusal: (error: unknown) => boolean;
  /** Turn a `failed` status's refusal into the error today's upload throws. */
  refusalError: (refusal: Record<string, unknown>) => Error;
}

export const PARALLEL_PARTS = 3;
export const PART_ATTEMPTS = 3;
export const POLL_EVERY_MS = 2000;
/** How long the app waits for the server's checks before it says so. */
export const POLL_GIVE_UP_MS = 15 * 60 * 1000;
/** The most today's single-request upload carries (the server's request ceiling). */
export const LEGACY_MAX_BYTES = 100 * 1024 * 1024;

export interface DirectUploadOptions {
  /** Bytes stored so far, of `total`. Reaches `total` before the checks run. */
  onProgress?: (sent: number, total: number) => void;
  signal?: AbortSignal;
}

/** The start call's body for a file and a target. */
export function startBody(file: Pick<File, 'name' | 'size' | 'type'>, target: UploadTarget): StartBody {
  const base = { name: file.name, size: file.size, mime_type: file.type };
  if (target.kind === 'space') return { target: 'space', space_uuid: target.spaceUuid, ...base };
  if (target.kind === 'channel') return { target: 'channel', channel_uuid: target.channelUuid, ...base };
  return { target: 'my_files', ...base };
}

/** The byte range of part `number` (1-based) of a file of `size` bytes. */
export function partRange(number: number, partSize: number, size: number): [number, number] {
  const from = (number - 1) * partSize;
  return [from, Math.min(from + partSize, size)];
}

/** Whether a failed direct upload may go by today's upload instead. */
export function mayFallBack(error: unknown, size: number): boolean {
  return error instanceof DirectUploadUnavailableError && size <= LEGACY_MAX_BYTES;
}

function abortError(): Error {
  const error = new Error('The upload was cancelled.');
  error.name = 'AbortError';
  return error;
}

/**
 * Upload `file` by the direct path and resolve with the stored file. Rejects
 * with the server's refusal as today's upload would, with an AbortError when
 * `signal` aborts, and with `DirectUploadUnavailableError` when the path
 * itself could not run (see `mayFallBack`). An upload that fails or is
 * cancelled after start is cancelled on the server, so its parts go.
 */
export async function directUpload<F>(
  file: Blob & Pick<File, 'name' | 'type'>,
  target: UploadTarget,
  transport: DirectUploadTransport<F>,
  options: DirectUploadOptions = {},
): Promise<F> {
  const signal = options.signal ?? new AbortController().signal;
  if (signal.aborted) throw abortError();

  let started: StartAnswer;
  try {
    started = await transport.start(startBody(file, target));
  } catch (error) {
    if (transport.isRefusal(error)) throw error;
    throw new DirectUploadUnavailableError(error);
  }

  const uuid = started.upload_uuid;
  let first: UploadStatus<F>;
  try {
    const etags = await sendParts(file, started, transport, signal, options.onProgress);
    if (signal.aborted) throw abortError();
    const parts = [...etags.entries()].sort(([a], [b]) => a - b).map(([number, etag]) => ({ number, etag }));
    first = await completeWithRetry(uuid, parts, transport, signal);
  } catch (error) {
    // A refusal at complete already deleted the parts; anything else leaves
    // them on storage, so the upload is cancelled on the server.
    if (!transport.isRefusal(error)) await transport.cancel(uuid).catch(() => undefined);
    throw error;
  }
  // Complete has answered: the file is the server's now, and is never cancelled from here.
  return waitForChecks(uuid, first, transport, signal);
}

async function sendParts<F>(
  file: Blob,
  started: StartAnswer,
  transport: DirectUploadTransport<F>,
  signal: AbortSignal,
  onProgress?: (sent: number, total: number) => void,
): Promise<Map<number, string>> {
  const urls = new Map(started.parts.map((part) => [part.number, part.url]));
  const numbers = [...urls.keys()].sort((a, b) => a - b);
  const sentByPart = new Map<number, number>();
  const etags = new Map<number, string>();
  // One part failing for good stops the others: the upload is cancelled anyway.
  const stop = new AbortController();
  const stopAll = () => stop.abort();
  signal.addEventListener('abort', stopAll, { once: true });
  const report = () => {
    let sent = 0;
    for (const bytes of sentByPart.values()) sent += bytes;
    onProgress?.(Math.min(sent, file.size), file.size);
  };
  report();

  const sendOne = async (number: number) => {
    const [from, to] = partRange(number, started.part_size, file.size);
    const body = file.slice(from, to);
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= PART_ATTEMPTS; attempt += 1) {
      if (stop.signal.aborted) throw abortError();
      try {
        const etag = await transport.putPart(urls.get(number) ?? '', body, (bytes) => {
          sentByPart.set(number, bytes);
          report();
        }, stop.signal);
        sentByPart.set(number, to - from);
        report();
        etags.set(number, etag);
        return;
      } catch (error) {
        if (stop.signal.aborted) throw abortError();
        lastError = error;
        sentByPart.set(number, 0);
        report();
        // A 403 is an expired URL: ask for a fresh one before the next try.
        if (error instanceof PartRejectedError && error.status === 403) {
          const [fresh] = await transport.partUrls(started.upload_uuid, [number]);
          if (fresh) urls.set(number, fresh.url);
        }
      }
    }
    stop.abort();
    throw new DirectUploadUnavailableError(lastError);
  };

  let next = 0;
  const worker = async () => {
    while (next < numbers.length) {
      const number = numbers[next];
      next += 1;
      await sendOne(number);
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(PARALLEL_PARTS, numbers.length) }, worker));
  } finally {
    signal.removeEventListener('abort', stopAll);
  }
  return etags;
}

async function completeWithRetry<F>(
  uuid: string,
  parts: { number: number; etag: string }[],
  transport: DirectUploadTransport<F>,
  signal: AbortSignal,
): Promise<UploadStatus<F>> {
  let lastError: unknown = null;
  // Complete is safe to repeat (Backend, 527ce6a4 (e)), so a dropped answer is asked again.
  for (let attempt = 1; attempt <= PART_ATTEMPTS; attempt += 1) {
    if (signal.aborted) throw abortError();
    try {
      return await transport.complete(uuid, parts);
    } catch (error) {
      if (transport.isRefusal(error)) throw error;
      lastError = error;
      if (attempt < PART_ATTEMPTS) await transport.sleep(POLL_EVERY_MS, signal);
    }
  }
  throw new DirectUploadUnavailableError(lastError);
}

async function waitForChecks<F>(
  uuid: string,
  first: UploadStatus<F>,
  transport: DirectUploadTransport<F>,
  signal: AbortSignal,
): Promise<F> {
  let current = first;
  let waited = 0;
  for (;;) {
    if (current.status === 'completed' && current.file) return current.file;
    if (current.status === 'failed') {
      throw transport.refusalError(current.refusal ?? { message: 'The file could not be added.' });
    }
    if (waited >= POLL_GIVE_UP_MS) throw new UploadStillCheckingError();
    await transport.sleep(POLL_EVERY_MS, signal);
    waited += POLL_EVERY_MS;
    try {
      current = await transport.status(uuid);
    } catch {
      // A dropped poll is asked again on the next tick; the upload is the server's now.
      if (signal.aborted) throw abortError();
    }
  }
}
