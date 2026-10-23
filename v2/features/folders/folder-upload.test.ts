import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FiledAfterUploadError, sendFolderUpload, type UploadNotices } from './detail/folder-upload';

/* Lucy, live, 23 October 2026: two files picked at once into a folder both
 * uploaded, but only the last one's toast turned into "Added"; the first
 * stayed on "Uploading". Each file now awaits its own upload. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

/** A stand-in for sonner that remembers what each toast id ended on. */
function fakeNotices() {
  let next = 0;
  const ended = new Map<string | number, string>();
  const shown: string[] = [];
  const notices: UploadNotices = {
    loading(message) {
      next += 1;
      ended.set(next, `loading: ${message}`);
      return next;
    },
    success(message, { id }) {
      ended.set(id, `success: ${message}`);
    },
    error(message, options) {
      if (options) ended.set(options.id, `error: ${message}`);
      else shown.push(`error: ${message}`);
    },
  };
  return { notices, ended, shown };
}

const pdf = (name: string) => new File(['%PDF-1.4 TEST DATA'], name, { type: 'application/pdf' });
const folder = { name: 'TEST DATA Disputes', space: { uuid: 's-1', name: 'TEST DATA Space' } };

test('two files uploading at once both end on "Added", each on its own toast', async () => {
  const { notices, ended } = fakeNotices();
  // The second upload finishes first, the way a smaller file would.
  const delays: Record<string, number> = { 'receipt.pdf': 30, 'notice.pdf': 5 };
  const upload = (file: File) => new Promise<void>((resolve) => setTimeout(resolve, delays[file.name]));
  await Promise.all([
    sendFolderUpload(pdf('receipt.pdf'), { folder, upload, notices }),
    sendFolderUpload(pdf('notice.pdf'), { folder, upload, notices }),
  ]);
  assert.deepEqual([...ended.values()], [
    'success: Added “receipt.pdf” to TEST DATA Disputes',
    'success: Added “notice.pdf” to TEST DATA Disputes',
  ]);
});

test('a refused file says so and starts no toast; a filing refusal says where the file is', async () => {
  const { notices, ended, shown } = fakeNotices();
  await sendFolderUpload(new File(['x'], 'tool.exe', { type: 'application/x-msdownload' }), {
    folder,
    upload: () => Promise.resolve(),
    notices,
  });
  assert.equal(ended.size, 0);
  assert.equal(shown.length, 1);
  await sendFolderUpload(pdf('order.pdf'), {
    folder,
    upload: () => Promise.reject(new FiledAfterUploadError(new Error('403'))),
    notices,
  });
  assert.match([...ended.values()][0], /^error: “order\.pdf” uploaded, but couldn’t be added to TEST DATA Disputes\. It is in TEST DATA Space\.$/);
});

test('the folder page awaits each file (mutateAsync), never per-call mutate callbacks', () => {
  const add = read('detail', 'FolderAdd.tsx');
  assert.match(add, /const uploadAsync = upload\.mutateAsync;/);
  assert.match(add, /void sendFolderUpload\(file, \{ folder, upload: uploadAsync, notices: toast \}\);/);
  assert.doesNotMatch(add, /\.mutate\(file, \{|uploadMutate\(/);
});

test('"Time\'s up" stays on one line in the frozen rail (Tester, live, 23 October 2026)', () => {
  const timer = readFileSync(join(here, '..', 'quiz', 'solo', 'player', 'AttemptTimer.tsx'), 'utf8');
  assert.match(timer, /<span className=\{cn\(DIGITS, 'w-auto min-w-11 whitespace-nowrap'\)\}>\{label\}<\/span>/);
});
