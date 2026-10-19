import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* Tester Claude, 19 October 2026: on onboarding step 8 (the lawyer path, the
 * old onboarding screens both designs use) a failed POST
 * /lawyer-verification/profile made the effect run itself again, about 16
 * times a second. One try per visit now, then the error and "Try again". */

const page = readFileSync(join(process.cwd(), 'app', '(onboarding)', 'onboarding', 'step-8', 'page.tsx'), 'utf8').replace(/\r\n/g, '\n');

test('the profile is created once per visit, not again on every failure', () => {
  assert.match(page, /if \(profileCreated \|\| createAttempted\.current\) return;\s*createAttempted\.current = true;/);
  // The effect no longer depends on the in-flight flag that a failure resets.
  assert.match(page, /\}, \[userType, communicationStyle, profileCreated, createRound, setVerificationData\]\);/);
  assert.doesNotMatch(page, /\}, \[userType, communicationStyle, profileCreated, isCreatingProfile, setVerificationData\]\);/);
});

test('a failure says so, and only "Try again" tries once more', () => {
  assert.match(page, /We couldn&apos;t set up your verification profile\./);
  assert.match(page, /createAttempted\.current = false;\s*setCreateFailed\(false\);\s*setCreateRound\(\(round\) => round \+ 1\);/);
});
