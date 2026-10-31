import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  attachmentCapError,
  attachmentHint,
  attachmentHintIn,
  attachmentSizeError,
  attachmentSizeLimit,
  megabytes,
  TODAY_UPLOAD_LIMITS,
  uploadLimitsFrom,
} from './upload-limits';
import { uploadPrecheck } from '@/v2/features/spaces/content-model';

/* The app checks a file against the person's own plan limits before it
 * uploads (techlead's go, thread 1c93152c; Backend f2eb6ff9: GET /users/limits
 * → `uploads`), with today's values when a number is missing. A plan an admin
 * sets higher would otherwise be refused here before the server saw the file. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const MB = 1024 * 1024;

// Arthur's proposed Basic plan, as a fixture: 25 MB documents, 5 files per message.
const BASIC = {
  upload_size_mb: 25,
  image_size_mb: 5,
  media_size_mb: 100,
  files_per_message: 5,
  storage_mb: 2048,
  storage_used_mb: 12.4,
  max_pdf_pages: 250,
};

test('the server’s numbers become the limits; anything missing or odd keeps today’s value', () => {
  assert.equal(uploadLimitsFrom(null), TODAY_UPLOAD_LIMITS);
  assert.equal(uploadLimitsFrom(undefined), TODAY_UPLOAD_LIMITS);
  assert.deepEqual(TODAY_UPLOAD_LIMITS, { documentBytes: 10 * MB, imageBytes: 5 * MB, mediaBytes: 100 * MB, filesPerMessage: 10 });
  assert.deepEqual(uploadLimitsFrom(BASIC), { documentBytes: 25 * MB, imageBytes: 5 * MB, mediaBytes: 100 * MB, filesPerMessage: 5 });
  // An older server, or a broken value, never makes the app stricter or looser than today.
  assert.deepEqual(uploadLimitsFrom({ upload_size_mb: 0, image_size_mb: -1, files_per_message: Number.NaN }), TODAY_UPLOAD_LIMITS);
  assert.equal(uploadLimitsFrom({ files_per_message: 7.6 }).filesPerMessage, 7);
});

test('the chat composers’ words carry the plan’s numbers', () => {
  const basic = uploadLimitsFrom(BASIC);
  assert.equal(megabytes(25 * MB), '25');
  assert.equal(megabytes(2.5 * MB), '2.5');
  assert.equal(attachmentSizeError(basic), 'Documents must be 25MB or less, and pictures 5MB or less.');
  assert.equal(attachmentHint(basic), 'PDF, DOC, RTF 25MB · JPG, PNG, WEBP 5MB');
  assert.equal(attachmentHintIn('redacted', basic), 'DOC, DOCX, RTF 25MB · no PDFs or pictures while redacted');
  assert.equal(attachmentCapError(basic), 'You can attach at most 5 files per message.');
  // Today's values read as they always have.
  assert.equal(attachmentSizeError(TODAY_UPLOAD_LIMITS), 'Documents must be 10MB or less, and pictures 5MB or less.');
  assert.equal(attachmentHint(TODAY_UPLOAD_LIMITS), 'PDF, DOC, RTF 10MB · JPG, PNG, WEBP 5MB');
  // A picture has its own cap.
  assert.equal(attachmentSizeLimit({ type: 'image/png' }, basic), 5 * MB);
  assert.equal(attachmentSizeLimit({ type: 'application/pdf' }, basic), 25 * MB);
});

test('a folder, My files and a space check against the limits they are given', () => {
  const pdf = (mb: number) => ({ name: 'TEST DATA brief.pdf', type: 'application/pdf', size: mb * MB });
  // 20 MB: too big today, fine on a 25 MB plan.
  assert.equal(uploadPrecheck(pdf(20), 'a folder'), '“TEST DATA brief.pdf” is larger than 10 MB, the most a folder takes.');
  assert.equal(uploadPrecheck(pdf(20), 'a folder', uploadLimitsFrom(BASIC)), null);
  assert.equal(uploadPrecheck(pdf(30), 'a folder', uploadLimitsFrom(BASIC)), '“TEST DATA brief.pdf” is larger than 25 MB, the most a folder takes.');
  // A space keeps today's values until its owner's limits are sent.
  assert.equal(uploadPrecheck(pdf(20)), '“TEST DATA brief.pdf” is larger than 10 MB, the most a space takes.');
});

test('every upload path reads the plan’s limits; a space’s uploads keep today’s for now', () => {
  const hook = read('v2', 'features', 'files', 'use-upload-limits.ts');
  assert.match(hook, /enabled: viewerId !== null && !inSpace,/);
  assert.match(hook, /select: \(response\) => response\.data\?\.uploads \?\? null,/);
  const chat = read('v2', 'features', 'conversations', 'conversation', 'ConversationComposer.tsx');
  assert.match(chat, /const uploadLimits = useUploadLimits\(\{ inSpace: spaceUuid !== null \}\);/);
  const home = read('v2', 'shell', 'designs', 'HomeComposer.tsx');
  assert.match(home, /const uploadLimits = useUploadLimits\(\{ inSpace: Boolean\(space\) \}\);/);
  for (const composer of [chat, home]) {
    assert.match(composer, /const remainingSlots = uploadLimits\.filesPerMessage - uploads\.length;/);
    assert.match(composer, /if \(file\.size > attachmentSizeLimit\(file, uploadLimits\)\) \{/);
    assert.match(composer, /attachmentSizeError\(uploadLimits\)/);
    assert.match(composer, /attachmentCapError\(uploadLimits\)/);
    assert.match(composer, /\{attachmentHintIn\(privateMode, uploadLimits\)\}/);
    // No fixed number is left to disagree with the plan.
    assert.doesNotMatch(composer, /MAX_FILES_PER_TURN|maxSizeFor\(|ATTACHMENT_SIZE_ERROR/);
  }
  const folder = read('v2', 'features', 'folders', 'detail', 'FolderAdd.tsx');
  assert.match(folder, /const limits = useUploadLimits\(\{ inSpace: folder\.space !== null \}\);/);
  const loose = read('v2', 'features', 'folders', 'list', 'LooseFilesSection.tsx');
  assert.match(loose, /const limits = useUploadLimits\(\{ inSpace: false \}\);/);
  assert.match(loose, /uploadPrecheck\(file, 'a folder', limits\)/);
});
