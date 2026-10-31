import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  directUpload,
  DirectUploadUnavailableError,
  LEGACY_MAX_BYTES,
  mayFallBack,
  PartRejectedError,
  partRange,
  POLL_GIVE_UP_MS,
  startBody,
  UploadStillCheckingError,
  type DirectUploadTransport,
  type StartBody,
  type UploadStatus,
} from './direct-upload';

/* Direct upload (Stay's "Ok", thread 1c93152c; contract with Backend in 384c,
 * 527ce6a4 and b715e677): start, parts straight to storage 3 at a time,
 * complete, then wait while the server checks the file. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const MB = 1024 * 1024;
const PART = 10 * MB;

interface StoredFile {
  id: number;
  original_name: string;
}

class Refused extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(status: number, data: unknown = {}) {
    super(`HTTP ${status}`);
    this.status = status;
    this.data = data;
  }
}

/** A fake server and storage that records every call. */
function fake(over: Partial<DirectUploadTransport<StoredFile>> = {}, size = 25 * MB) {
  const calls: string[] = [];
  let inFlight = 0;
  let mostInFlight = 0;
  const count = Math.ceil(size / PART);
  const transport: DirectUploadTransport<StoredFile> = {
    start: async (body: StartBody) => {
      calls.push(`start ${body.target} ${body.size}`);
      return {
        upload_uuid: 'u-1',
        part_size: PART,
        parts: Array.from({ length: count }, (_, i) => ({ number: i + 1, url: `https://storage.test/p${i + 1}?v=1` })),
        expires_at: '2026-11-01T20:00:00Z',
      };
    },
    partUrls: async (_uuid, numbers) => {
      calls.push(`urls ${numbers.join(',')}`);
      return numbers.map((number) => ({ number, url: `https://storage.test/p${number}?v=2` }));
    },
    putPart: async (url, body, onSent) => {
      inFlight += 1;
      mostInFlight = Math.max(mostInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      onSent(body.size);
      inFlight -= 1;
      calls.push(`put ${new URL(url).pathname} ${body.size}`);
      return `"etag-${new URL(url).pathname.slice(2)}"`;
    },
    complete: async (_uuid, parts) => {
      calls.push(`complete ${parts.map((part) => `${part.number}:${part.etag}`).join(' ')}`);
      return { status: 'processing', file: null, refusal: null };
    },
    status: async () => {
      calls.push('status');
      return { status: 'completed', file: { id: 7, original_name: 'TEST DATA bundle.pdf' }, refusal: null };
    },
    cancel: async () => {
      calls.push('cancel');
    },
    sleep: async (_ms, signal) => {
      if (signal.aborted) throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
    },
    isRefusal: (error) => error instanceof Refused && [401, 403, 422].includes(error.status),
    refusalError: (refusal) => new Refused(422, refusal),
    ...over,
  };
  return { transport, calls, mostInFlight: () => mostInFlight };
}

const pdf = (size = 25 * MB) => new File([new Uint8Array(size)], 'TEST DATA bundle.pdf', { type: 'application/pdf' });

test('a file goes in 10 MB parts, 3 at a time, and comes back as the stored file after the checks', async () => {
  const { transport, calls, mostInFlight } = fake();
  const progress: number[] = [];
  const stored = await directUpload(pdf(), { kind: 'my_files' }, transport, { onProgress: (sent) => progress.push(sent) });
  assert.deepEqual(stored, { id: 7, original_name: 'TEST DATA bundle.pdf' });
  assert.equal(calls[0], `start my_files ${25 * MB}`);
  assert.deepEqual(calls.filter((call) => call.startsWith('put')).sort(), [`put /p1 ${PART}`, `put /p2 ${PART}`, `put /p3 ${5 * MB}`]);
  assert.ok(mostInFlight() <= 3);
  // The ETags go to complete in part order, then the poll runs until completed.
  assert.equal(calls.find((call) => call.startsWith('complete')), 'complete 1:"etag-1" 2:"etag-2" 3:"etag-3"');
  assert.deepEqual(calls.slice(-1), ['status']);
  assert.ok(!calls.includes('cancel'));
  assert.equal(progress.at(-1), 25 * MB);
});

test('the start body names the target, and the parts cover the file exactly', () => {
  const file = { name: 'TEST DATA a.pdf', size: 5, type: '' };
  assert.deepEqual(startBody(file, { kind: 'my_files' }), { target: 'my_files', name: 'TEST DATA a.pdf', size: 5, mime_type: '' });
  assert.deepEqual(startBody(file, { kind: 'space', spaceUuid: 's-1' }).space_uuid, 's-1');
  assert.deepEqual(startBody(file, { kind: 'channel', channelUuid: 'c-1' }).channel_uuid, 'c-1');
  assert.deepEqual(partRange(1, PART, 25 * MB), [0, PART]);
  assert.deepEqual(partRange(3, PART, 25 * MB), [2 * PART, 25 * MB]);
});

test('a refusal at start is the server’s answer, shown as today’s upload shows it', async () => {
  const refusal = new Refused(422, { code: 'UPLOAD_LIMIT_REACHED', message: 'Your plan takes files up to 25 MB.' });
  const { transport, calls } = fake({ start: async () => { throw refusal; } });
  await assert.rejects(directUpload(pdf(), { kind: 'my_files' }, transport), (error) => error === refusal);
  assert.ok(!calls.includes('cancel'));
  assert.equal(mayFallBack(refusal, MB), false);
});

test('when the direct path cannot run, a file up to 100 MB may go by today’s upload, and a bigger one may not', async () => {
  const { transport } = fake({ start: async () => { throw new TypeError('Failed to fetch'); } });
  const error = await directUpload(pdf(), { kind: 'my_files' }, transport).catch((caught: unknown) => caught);
  assert.ok(error instanceof DirectUploadUnavailableError);
  assert.equal(mayFallBack(error, LEGACY_MAX_BYTES), true);
  assert.equal(mayFallBack(error, LEGACY_MAX_BYTES + 1), false);
  // A server without the route yet (404) is the same: the path is not there.
  const missing = fake({ start: async () => { throw new Refused(404); } });
  assert.ok((await directUpload(pdf(), { kind: 'my_files' }, missing.transport).catch((caught: unknown) => caught)) instanceof DirectUploadUnavailableError);
});

test('a part that fails 3 times cancels the upload on the server, and the path counts as unavailable', async () => {
  let tries = 0;
  const { transport, calls } = fake({
    putPart: async () => {
      tries += 1;
      throw new TypeError('CORS');
    },
  }, 5 * MB);
  const error = await directUpload(pdf(5 * MB), { kind: 'my_files' }, transport).catch((caught: unknown) => caught);
  assert.ok(error instanceof DirectUploadUnavailableError);
  assert.equal(tries, 3);
  assert.equal(calls.at(-1), 'cancel');
  // In a bigger file, the other parts stop once one has failed 3 times.
  let bigTries = 0;
  const big = fake({ putPart: async () => { bigTries += 1; throw new TypeError('CORS'); } }, 100 * MB);
  assert.ok((await directUpload(pdf(100 * MB), { kind: 'my_files' }, big.transport).catch((caught: unknown) => caught)) instanceof DirectUploadUnavailableError);
  assert.ok(bigTries <= 3 * 3, `tried ${bigTries} times`);
});

test('an expired part URL is asked for again, and the part goes on the fresh one', async () => {
  const urls: string[] = [];
  const { transport, calls } = fake({
    putPart: async (url, body, onSent) => {
      urls.push(url);
      if (url.endsWith('v=1')) throw new PartRejectedError(403);
      onSent(body.size);
      return '"etag-1"';
    },
  }, 5 * MB);
  await directUpload(pdf(5 * MB), { kind: 'my_files' }, transport);
  assert.deepEqual(urls, ['https://storage.test/p1?v=1', 'https://storage.test/p1?v=2']);
  assert.ok(calls.includes('urls 1'));
});

test('a refusal at complete or after the checks is shown, and the upload is not cancelled again', async () => {
  const refusal = new Refused(422, { code: 'UPLOAD_LIMIT_REACHED', message: 'This file is not a PDF.' });
  const atComplete = fake({ complete: async () => { throw refusal; } });
  await assert.rejects(directUpload(pdf(), { kind: 'my_files' }, atComplete.transport), (error) => error === refusal);
  assert.ok(!atComplete.calls.includes('cancel'));

  const pages = { code: 'UPLOAD_LIMIT_REACHED', limit_type: 'max_pdf_pages', message: 'Your plan takes PDFs up to 250 pages.' };
  const afterChecks = fake({ status: async (): Promise<UploadStatus<StoredFile>> => ({ status: 'failed', file: null, refusal: pages }) });
  await assert.rejects(
    directUpload(pdf(), { kind: 'my_files' }, afterChecks.transport),
    (error) => error instanceof Refused && error.status === 422 && error.data === pages,
  );
  assert.ok(!afterChecks.calls.includes('cancel'));
});

test('a dropped complete is asked again, since a second complete gives the same answer', async () => {
  let completes = 0;
  const { transport } = fake({
    complete: async () => {
      completes += 1;
      if (completes === 1) throw new TypeError('network');
      return { status: 'completed', file: { id: 9, original_name: 'TEST DATA a.pdf' }, refusal: null };
    },
  });
  assert.deepEqual(await directUpload(pdf(), { kind: 'my_files' }, transport), { id: 9, original_name: 'TEST DATA a.pdf' });
  assert.equal(completes, 2);
});

test('cancelling while parts are sending stops and cancels the upload on the server', async () => {
  const controller = new AbortController();
  const { transport, calls } = fake({
    putPart: async () => {
      controller.abort();
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    },
  });
  await assert.rejects(directUpload(pdf(), { kind: 'my_files' }, transport, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls.at(-1), 'cancel');
});

test('a file the server is still checking after 15 minutes is said so, and left to finish', async () => {
  let polls = 0;
  const { transport, calls } = fake({
    status: async () => {
      polls += 1;
      return { status: 'processing', file: null, refusal: null };
    },
  });
  await assert.rejects(directUpload(pdf(), { kind: 'my_files' }, transport), (error) => error instanceof UploadStillCheckingError);
  assert.equal(polls, POLL_GIVE_UP_MS / 2000);
  assert.ok(!calls.includes('cancel'));
});

test('every upload path in the app goes direct, with today’s upload as the fallback', () => {
  const attach = read('v2', 'features', 'conversations', 'attachment-upload.ts');
  assert.match(attach, /uploadFile\(file, \{ kind: 'my_files' \}, \(\) => chatApi\.uploadDocument\(file\)\)/);
  assert.match(attach, /uploadFile\(file, \{ kind: 'space', spaceUuid \}, \(\) => spacesApi\.uploadFile\(spaceUuid, file\)\)/);
  assert.match(read('v2', 'features', 'folders', 'file-mutations.ts'), /uploadFile\(file, \{ kind: 'my_files' \}, \(\) => filesApi\.uploadDocument\(file\)\)/);
  const folder = read('v2', 'features', 'folders', 'detail', 'FolderAdd.tsx');
  assert.match(folder, /uploadFile\(file, \{ kind: 'space', spaceUuid: space\.uuid \}, \(\) => spacesApi\.uploadFile\(space\.uuid, file\)\)/);
  assert.match(folder, /uploadFile\(file, \{ kind: 'my_files' \}, \(\) => filesApi\.uploadDocument\(file\)\)/);
  assert.match(read('v2', 'features', 'spaces', 'content-mutations.ts'), /uploadFile\(file, \{ kind: 'space', spaceUuid \}, \(options\) => spacesApi\.uploadFile\(spaceUuid, file, options\), \{/);
  assert.match(read('v2', 'features', 'channels', 'lists-files-mutations.ts'), /uploadFile\(file, \{ kind: 'channel', channelUuid \}, \(options\) =>\s*channelFilesApi\.upload\(channelUuid, file, options\), \{ onProgress, signal \}\)/);
  // The part PUT sends no auth header and no Content-Type, and reads the ETag.
  const live = read('lib', 'api', 'uploads.ts');
  assert.match(live, /request\.open\('PUT', url\);/);
  assert.doesNotMatch(live, /setRequestHeader/);
  assert.match(live, /request\.getResponseHeader\('ETag'\)/);
});
