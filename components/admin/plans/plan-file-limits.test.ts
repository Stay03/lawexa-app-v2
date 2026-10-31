import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IPlanLimit, TUploadLimitType } from '@/types/subscription';

import {
  FILE_LIMIT_FIELDS,
  FILE_LIMIT_TYPES,
  fileLimitError,
  fileLimitHint,
  fileLimitRows,
  fileLimitValues,
  gigabytesHint,
} from './plan-file-limits';

/* Every file limit is set in the admin plan limits form (Arthur's spec;
 * techlead's go, thread 1c93152c), under the server's own rules
 * (UpdatePlanLimitsRequest::after, FileLimitService). */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const field = (type: TUploadLimitType) => {
  const found = FILE_LIMIT_FIELDS.find((f) => f.type === type);
  assert.ok(found, type);
  return found;
};
const row = (type: IPlanLimit['type'], value: number): IPlanLimit => ({ type, value, is_unlimited: value === -1, period: 'lifetime' });

test('the form holds all ten file limits, files first, then Spaces', () => {
  assert.deepEqual(FILE_LIMIT_TYPES, [
    'upload_size_mb', 'media_size_mb', 'files_per_message', 'storage_mb', 'scan_pages', 'max_pdf_pages',
    'space_storage_mb', 'space_upload_size_mb', 'files_per_space_upload', 'max_space_documents',
  ]);
  assert.deepEqual(FILE_LIMIT_FIELDS.filter((f) => f.group === 'spaces').map((f) => f.type), FILE_LIMIT_TYPES.slice(6));
});

test('each limit takes what the server takes and refuses what it refuses', () => {
  const take = (type: TUploadLimitType, ...values: number[]) => values.forEach((v) => assert.equal(fileLimitError(field(type), v), null, `${type} ${v}`));
  const refuse = (type: TUploadLimitType, ...values: number[]) => values.forEach((v) => assert.notEqual(fileLimitError(field(type), v), null, `${type} ${v}`));
  // Capped, no "no limit": 1 to the ceiling.
  take('upload_size_mb', 1, 25, 250, 500); refuse('upload_size_mb', -1, 0, 501);
  take('media_size_mb', 1, 500); refuse('media_size_mb', -1, 0, 501);
  take('files_per_message', 1, 20); refuse('files_per_message', -1, 0, 21);
  take('scan_pages', 1, 50); refuse('scan_pages', -1, 0, 51);
  // Storage: -1, 0 or any size.
  take('storage_mb', -1, 0, 51200);
  // -1 or at least 1.
  for (const type of ['max_pdf_pages', 'space_storage_mb', 'files_per_space_upload', 'max_space_documents'] as const) {
    take(type, -1, 1, 5000); refuse(type, 0, -2);
  }
  // A Space's file size: -1, or 1 to the request ceiling.
  take('space_upload_size_mb', -1, 1, 500); refuse('space_upload_size_mb', 0, 501);
  // An empty box is not a number.
  assert.equal(fileLimitError(field('storage_mb'), Number.NaN), 'Enter a whole number.');
});

test('the hints say the range, and a large size reads in GB', () => {
  assert.equal(fileLimitHint(field('upload_size_mb')), '1 to 500 MB');
  assert.equal(fileLimitHint(field('files_per_message')), '1 to 20 files');
  assert.equal(fileLimitHint(field('scan_pages')), '1 to 50 pages');
  assert.equal(fileLimitHint(field('storage_mb')), '-1 for no limit, 0 for none, or any size in MB');
  assert.equal(fileLimitHint(field('space_upload_size_mb')), '-1 for no limit, or 1 to 500 MB');
  assert.equal(fileLimitHint(field('max_space_documents')), '-1 for no limit, or 1 and up');
  assert.equal(gigabytesHint(field('storage_mb'), 51200), '50 GB');
  assert.equal(gigabytesHint(field('storage_mb'), 1536), '1.5 GB');
  assert.equal(gigabytesHint(field('storage_mb'), 500), null);
  assert.equal(gigabytesHint(field('max_space_documents'), 51200), null);
});

test('a save sends the plan’s own rows and the changed ones, as lifetime, and leaves untouched gaps alone', () => {
  const initial = fileLimitValues([row('upload_size_mb', 25), row('storage_mb', 2048)]);
  assert.deepEqual(initial.upload_size_mb, { limit_value: 25, set: true });
  // A row the plan lacks starts at the server's default.
  assert.deepEqual(initial.files_per_message, { limit_value: 10, set: false });
  assert.deepEqual(initial.max_space_documents, { limit_value: -1, set: false });
  assert.deepEqual(fileLimitRows(initial, initial), [
    { limit_type: 'upload_size_mb', limit_value: 25, period: 'lifetime' },
    { limit_type: 'storage_mb', limit_value: 2048, period: 'lifetime' },
  ]);
  const edited = { ...initial, files_per_message: { limit_value: 5, set: false } };
  assert.deepEqual(fileLimitRows(edited, initial).map((r) => r.limit_type), ['upload_size_mb', 'files_per_message', 'storage_mb']);
});

test('the form renders every field, checks them, and sends them with the counted limits on both routes', () => {
  const form = read('components', 'admin', 'plans', 'AdminPlanLimitsForm.tsx');
  assert.match(form, /const message = fileLimitError\(field, values\.files\[field\.type\]\.limit_value\);/);
  assert.match(form, /\.\.\.fileLimitRows\(data\.files, fileLimitValues\(plan\.limits\)\),/);
  assert.match(form, /files: fileLimitValues\(plan\.limits\),/);
  assert.match(form, />Files and uploads</);
  // The form's own messages show: the browser's number check does not stop the save first.
  assert.match(form, /<form noValidate onSubmit=\{form\.handleSubmit\(onSubmit\)\}/);
  assert.match(form, />Spaces</);
  // The free plan and a paid plan send the same payload, each through its own route.
  assert.match(form, /const mutation = plan\.is_free \? updateFreeLimitsMutation : updateLimitsMutation;/);
  assert.match(form, /const mutateArgs = plan\.is_free\s*\? payload\s*: \{ id: plan\.id, payload \};/);
});
