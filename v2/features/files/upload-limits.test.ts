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
  spaceFilesPerUpload,
  spaceFilesPerUploadError,
  spaceUploadLimitsFrom,
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
  // A space with no limits sent keeps today's values.
  assert.equal(uploadPrecheck(pdf(20)), '“TEST DATA brief.pdf” is larger than 10 MB, the most a space takes.');
});

// A space whose owner is on a plan with 50 MB files and 5 files a pick (Backend 2a209254).
const SPACE = {
  upload_size_mb: 50,
  media_size_mb: 250,
  files_per_upload: 5,
  storage_mb: 10240,
  storage_used_mb: null,
  max_pdf_pages: 500,
  max_documents: null,
  documents_count: null,
};

test('a space’s uploads take its own sizes, and the person keeps their own count per chat message', () => {
  const basic = uploadLimitsFrom(BASIC);
  const inSpace = spaceUploadLimitsFrom(SPACE, basic);
  assert.deepEqual(inSpace, { documentBytes: 50 * MB, imageBytes: 5 * MB, mediaBytes: 250 * MB, filesPerMessage: 5 });
  // No limits sent (an older server): the person's own.
  assert.equal(spaceUploadLimitsFrom(null, basic), basic);
  assert.deepEqual(spaceUploadLimitsFrom({ upload_size_mb: 0 }, basic), basic);
  // A 40 MB PDF: too big for Basic, fine in this space.
  const pdf = { name: 'TEST DATA bundle.pdf', type: 'application/pdf', size: 40 * MB };
  assert.match(uploadPrecheck(pdf, 'a folder', basic) ?? '', /larger than 25 MB/);
  assert.equal(uploadPrecheck(pdf, 'a space', inSpace), null);
  // Files per pick: the app holds it, as the server takes one file a request.
  assert.equal(spaceFilesPerUpload(SPACE), 5);
  assert.equal(spaceFilesPerUpload({ ...SPACE, files_per_upload: null }), null);
  assert.equal(spaceFilesPerUpload(null), null);
  assert.equal(spaceFilesPerUploadError(5), 'This space takes 5 files at a time, so only the first 5 were added.');
  assert.equal(spaceFilesPerUploadError(1), 'This space takes one file at a time, so only the first was added.');
});

test('every upload path reads the plan’s limits, and a space’s uploads the space’s', () => {
  const hook = read('v2', 'features', 'files', 'use-upload-limits.ts');
  assert.match(hook, /select: \(response\) => response\.data\?\.uploads \?\? null,/);
  // A space's limits come from the detail its frame already holds.
  assert.match(hook, /\.\.\.spacesQueries\.detail\(spaceUuid \?\? '', \{ viewerId \}\),\s*enabled: spaceUuid !== null,\s*select: \(response\) => response\.data\?\.upload_limits \?\? null,/);
  assert.match(hook, /return spaceLimits \? spaceUploadLimitsFrom\(spaceLimits, own\) : own;/);
  const chat = read('v2', 'features', 'conversations', 'conversation', 'ConversationComposer.tsx');
  assert.match(chat, /const uploadLimits = useUploadLimits\(\{ spaceUuid \}\);/);
  const home = read('v2', 'shell', 'designs', 'HomeComposer.tsx');
  assert.match(home, /const uploadLimits = useUploadLimits\(\{ spaceUuid: space\?\.uuid \?\? null \}\);/);
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
  assert.match(folder, /const limits = useUploadLimits\(\{ spaceUuid: folder\.space\?\.uuid \?\? null \}\);/);
  const loose = read('v2', 'features', 'folders', 'list', 'LooseFilesSection.tsx');
  assert.match(loose, /const limits = useUploadLimits\(\{ spaceUuid: null \}\);/);
  // A space's Files tab: its sizes on every file, its count on every pick and drop.
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  assert.match(panel, /const validate = useCallback\(\(file: File\) => uploadPrecheck\(file, 'a space', limits\), \[limits\]\);/);
  assert.match(panel, /if \(perUpload !== null && list\.length > perUpload\) \{\s*toast\.error\(spaceFilesPerUploadError\(perUpload\)\);\s*queue\.add\(list\.slice\(0, perUpload\)\);/);
  assert.match(panel, /<FileDropZone spaceName=\{space\.name\} onDrop=\{addFiles\}>/);
  assert.match(panel, /if \(event\.target\.files\) addFiles\(event\.target\.files\);/);
  assert.match(loose, /uploadPrecheck\(file, 'a folder', limits\)/);
});
