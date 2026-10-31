import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AxiosError, AxiosHeaders } from 'axios';

import { extractUploadLimit } from '@/lib/utils/api-error';
import { sendFolderUpload, type UploadNotices } from '@/v2/features/folders/detail/folder-upload';
import { askAgainRefusal, sendRefusal } from '@/v2/features/conversations/conversation/space-turn';

/* Upload limits per plan (Backend eeceb2b2, thread 1c93152c): every upload
 * path shows the server's own sentence for a refusal at a limit, and the way
 * to the plans when a bigger plan allows more (`upgrade`). Every plan has the
 * same limits today, so `upgrade` is false everywhere until an admin sets
 * numbers; these fixtures stand in for that day. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

function refusal(status: number, data: unknown): AxiosError {
  return new AxiosError('Unprocessable', String(status), undefined, undefined, {
    status,
    statusText: 'Unprocessable',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data,
  } as never);
}

const SIZE = 'Your plan takes files up to 10 MB. This one is 10.1 MB.';
const sizeLimit = (upgrade: boolean) =>
  refusal(422, {
    success: false,
    code: 'UPLOAD_LIMIT_REACHED',
    limit_type: 'upload_size_mb',
    limit: 10,
    used: 10.1,
    upgrade,
    message: upgrade ? `${SIZE} Upgrade your plan for more.` : SIZE,
    errors: { file: [upgrade ? `${SIZE} Upgrade your plan for more.` : SIZE] },
  });

test('a refusal at a plan limit is read from its code; anything else is left to the screen', () => {
  assert.deepEqual(extractUploadLimit(sizeLimit(false)), { message: SIZE, upgrade: false, limitType: 'upload_size_mb' });
  assert.deepEqual(extractUploadLimit(sizeLimit(true)), {
    message: `${SIZE} Upgrade your plan for more.`,
    upgrade: true,
    limitType: 'upload_size_mb',
  });
  // The files rule's own 422 (a type the server refuses) is not a plan limit.
  assert.equal(extractUploadLimit(refusal(422, { success: false, message: 'The file must be a PDF.', errors: { file: ['x'] } })), null);
  // Only a 422 with words to show counts.
  assert.equal(extractUploadLimit(refusal(500, { code: 'UPLOAD_LIMIT_REACHED', message: SIZE })), null);
  assert.equal(extractUploadLimit(refusal(422, { code: 'UPLOAD_LIMIT_REACHED', message: '' })), null);
  assert.equal(extractUploadLimit(new Error('offline')), null);
});

function recordingNotices() {
  const errors: { message: string; options?: { id: string | number; plans?: boolean } }[] = [];
  const notices: UploadNotices = {
    loading: () => 't1',
    success: () => undefined,
    error: (message, options) => errors.push({ message, options }),
  };
  return { notices, errors };
}

test('a folder upload refused at a limit says the server’s words, with the plans only when a bigger plan allows it', async () => {
  const file = new File(['x'], 'TEST DATA brief.pdf', { type: 'application/pdf' });
  const folder = { name: 'TEST DATA folder', space: null };
  for (const upgrade of [false, true]) {
    const { notices, errors } = recordingNotices();
    await sendFolderUpload(file, { folder, upload: () => Promise.reject(sizeLimit(upgrade)), notices });
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /^Couldn’t upload “TEST DATA brief\.pdf”\. Your plan takes files up to 10 MB\./);
    assert.deepEqual(errors[0].options, { id: 't1', plans: upgrade });
  }
});

test('a send over the files limit gives the words back with the server’s sentence', () => {
  const limit = { kind: 'upload-limit' as const, message: 'Your plan takes 3 files on one message. This one has 4.', upgrade: true };
  assert.equal(sendRefusal(limit, 1), limit.message);
  assert.equal(askAgainRefusal(limit, 1), limit.message);

  const engine = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  assert.match(
    engine,
    /const uploadLimit = extractUploadLimit\(err\);\s*if \(uploadLimit\) \{\s*removeMessage\(optimisticMsg\.id\);[\s\S]*?return \{ kind: 'upload-limit', message: uploadLimit\.message, upgrade: uploadLimit\.upgrade \};/,
  );
  const controller = read('v2', 'features', 'conversations', 'conversation', 'useConversationController.ts');
  assert.match(controller, /\.\.\.\(refusal\.kind === 'upload-limit' && \{ limit: \{ plans: refusal\.upgrade \} \}\)/);
  // Nothing was saved, so nothing is read again.
  assert.match(controller, /refusal\.kind !== 'upload-limit'\) \{/);
  const composer = read('v2', 'features', 'conversations', 'conversation', 'ConversationComposer.tsx');
  assert.match(composer, /showError\(outcome\.refused, outcome\.limit \? 'error' : 'notice', outcome\.limit\?\.plans === true\)/);
  assert.match(composer, /\{errorText\}\s*\{errorPlans \? \(/);
});

test('every upload path shows the server’s sentence, and the plans when a bigger plan allows the file', () => {
  // Chat attachments, in a chat and on the home box.
  for (const file of [
    read('v2', 'features', 'conversations', 'conversation', 'ConversationComposer.tsx'),
    read('v2', 'shell', 'designs', 'HomeComposer.tsx'),
  ]) {
    assert.match(file, /error: limit\?\.message \?\? extractApiError\(error\)\.message,\s*plans: limit\?\.upgrade === true,/);
    assert.match(file, /\.key === entry\.key \? failedUpload\(u, err\) : u/);
    assert.match(file, /\.plans \? \(\s*<>\s*\{' '\}\s*<PlansLink \/>/);
  }
  // A new chat from the home box sent with more files than the plan takes.
  const home = read('v2', 'shell', 'designs', 'HomeComposer.tsx');
  assert.match(home, /\} else if \(limit\) \{\s*[\s\S]*?setError\(limit\.message\);\s*setPlansFor\(limit\.upgrade \? limit\.message : null\);/);
  assert.match(home, /plansFor !== null && plansFor === error \?/);
  // A folder, and My files.
  assert.match(read('v2', 'features', 'folders', 'detail', 'FolderAdd.tsx'), /\.\.\.\(options\?\.plans && \{ action: plansToastAction\(\(href\) => router\.push\(href\)\) \}\)/);
  assert.match(
    read('v2', 'features', 'folders', 'list', 'LooseFilesSection.tsx'),
    /limit\?\.message \?\? extractApiError\(error\)\.message[\s\S]*?\.\.\.\(limit\?\.upgrade && \{ action: plansToastAction\(\(href\) => router\.push\(href\)\) \}\)/,
  );
  // A space's files: no Retry (a 422), and the plans on the row.
  assert.match(
    read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx'),
    /return extractUploadLimit\(error\)\?\.upgrade \? \{ \.\.\.refusal, plans: true \} : refusal;/,
  );
  assert.match(read('v2', 'features', 'channels', 'files', 'use-upload-queue.ts'), /plans: note\.plans === true,/);
  assert.match(read('v2', 'features', 'channels', 'files', 'UploadTray.tsx'), /\{entry\.plans \? \(\s*<>\s*\{' '\}\s*<PlansLink \/>/);
  // The plans are the pricing screen, as Billing and Usage link them.
  assert.match(read('v2', 'features', 'files', 'PlansLink.tsx'), /export const PLANS_HREF = '\/pricing';/);
});
