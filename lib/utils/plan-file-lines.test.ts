import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IPlanLimit } from '@/types/subscription';

import { fileLines, storageSize, withFileLines } from './plan-file-lines';

/* The pricing card prints the plan's own file limits from `limits[]` (Stay's
 * B, thread 4a2029c5). */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const row = (type: IPlanLimit['type'], value: number): IPlanLimit => ({
  type, value, is_unlimited: value === -1, period: 'lifetime',
});
// Arthur's proposed Basic, as a fixture: 25 MB documents, 5 files, 2 GB.
const BASIC = { limits: [row('ai_messages', 50), row('upload_size_mb', 25), row('files_per_message', 5), row('storage_mb', 2048)] };

test('a plan’s rows become the card’s file lines', () => {
  assert.deepEqual(fileLines(BASIC), ['Chat with Document (25MB limit)', 'Up to 5 Files per Message', '2GB File Storage']);
  assert.deepEqual(fileLines({ limits: [row('files_per_message', 1), row('storage_mb', 500)] }), [
    'Chat with Document', 'One File per Message', '500MB File Storage',
  ]);
  assert.equal(storageSize(1536), '1.5GB');
  assert.equal(storageSize(10240), '10GB');
});

test('unlimited storage says so; unlimited or oversized capped values read as the server’s ceiling', () => {
  const top = { limits: [row('upload_size_mb', -1), row('files_per_message', -1), row('storage_mb', -1)] };
  assert.deepEqual(fileLines(top), ['Chat with Document (100MB limit)', 'Up to 20 Files per Message', 'Unlimited File Storage']);
  const over = { limits: [row('upload_size_mb', 500), row('files_per_message', 50)] };
  assert.deepEqual(fileLines(over), ['Chat with Document (100MB limit)', 'Up to 20 Files per Message']);
  // No storage for the plan: no storage line.
  assert.deepEqual(fileLines({ limits: [row('storage_mb', 0)] }), ['Chat with Document']);
});

test('v1’s document line is swapped in place, and the rest stays word for word', () => {
  const v1 = ['50 AI Messages', 'Unlimited Library Access', 'Chat with Document (10MB limit)', 'Chat with Statute'];
  assert.deepEqual(withFileLines(v1, BASIC), [
    '50 AI Messages', 'Unlimited Library Access', 'Chat with Document (25MB limit)', 'Up to 5 Files per Message',
    '2GB File Storage', 'Chat with Statute',
  ]);
  assert.deepEqual(withFileLines(['Chat with Statute'], BASIC).at(-1), '2GB File Storage');
  // The v1 table is untouched: v1's own card still reads it.
  assert.match(read('lib', 'constants', 'plan-features.ts'), /'Chat with Document \(10MB limit\)'/);
});
