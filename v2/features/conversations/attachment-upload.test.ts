import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { uploadAttachment, type AttachmentUploads } from './attachment-upload';

/* A file attached in a space belongs to the space (Stay, 15 October 2026), so
 * it is uploaded to the space; anywhere else it is the sender's, as before. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

const fakeUploads = () => {
  const calls: string[] = [];
  const row = { id: 7, original_name: 'lease.pdf', size: 1200, mime_type: 'application/pdf' };
  const uploads: AttachmentUploads = {
    uploadDocument: async () => {
      calls.push('documents');
      return { data: row };
    },
    uploadSpaceFile: async (spaceUuid) => {
      calls.push(`space:${spaceUuid}`);
      return { data: { ...row, id: 8 } };
    },
  };
  return { calls, uploads };
};

test('in a space the file is uploaded to the space; outside one, to the sender’s own files', async () => {
  const file = new File(['x'], 'lease.pdf', { type: 'application/pdf' });
  const inSpace = fakeUploads();
  assert.deepEqual(await uploadAttachment(file, 's-1', inSpace.uploads), { id: 8, original_name: 'lease.pdf', size: 1200, mime_type: 'application/pdf' });
  assert.deepEqual(inSpace.calls, ['space:s-1']);
  const personal = fakeUploads();
  assert.equal((await uploadAttachment(file, null, personal.uploads)).id, 7);
  assert.deepEqual(personal.calls, ['documents']);
});

test('both composers upload through it, with their space', () => {
  const chat = read('v2', 'features', 'conversations', 'conversation', 'ConversationComposer.tsx');
  assert.match(chat, /const uploaded = await uploadAttachment\(file, spaceUuid\);/);
  assert.doesNotMatch(chat, /chatApi\.uploadDocument/);
  const home = read('v2', 'shell', 'designs', 'HomeComposer.tsx');
  assert.match(home, /const uploaded = await uploadAttachment\(file, space\?\.uuid \?\? null\);/);
  assert.doesNotMatch(home, /chatApi\.uploadDocument/);
  assert.match(read('v2', 'features', 'conversations', 'conversation', 'ConversationScreen.tsx'), /spaceUuid=\{controller\.spaceUuid\}/);
});
