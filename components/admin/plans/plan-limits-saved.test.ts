import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IPlanLimit } from '@/types/subscription';

import { limitsSavedToast } from './plan-limits-saved';

/* The admin's save confirmation names the file lines the plan's pricing card
 * now prints (Stay's B, thread 4a2029c5). */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const row = (type: IPlanLimit['type'], value: number): IPlanLimit => ({
  type, value, is_unlimited: value === -1, period: 'lifetime',
});
const BASIC = { limits: [row('ai_messages', 50), row('upload_size_mb', 25), row('files_per_message', 5), row('storage_mb', 2048)] };

test('the admin’s save confirmation names what the pricing card now prints', () => {
  assert.deepEqual(limitsSavedToast(false, { id: 80, limits: BASIC.limits }), {
    title: 'Plan limits saved.',
    description: 'The pricing page now shows: Chat with Document (25MB limit), Up to 5 Files per Message, 2GB File Storage.',
  });
  assert.equal(limitsSavedToast(false, BASIC.limits).description?.startsWith('The pricing page now shows:'), true);
  assert.deepEqual(limitsSavedToast(false, null), { title: 'Plan limits saved.', description: 'The pricing page shows the new values.' });
  // The free plan has no pricing card.
  assert.deepEqual(limitsSavedToast(true, { limits: BASIC.limits }), { title: 'Plan limits saved.' });
  const form = read('components', 'admin', 'plans', 'AdminPlanLimitsForm.tsx');
  assert.match(form, /const saved = limitsSavedToast\(plan\.is_free, response\.data\);\s*toast\.success\(saved\.title, \{ description: saved\.description \}\);/);
});
