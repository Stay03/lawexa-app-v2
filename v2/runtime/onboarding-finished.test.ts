import { test } from 'node:test';
import assert from 'node:assert/strict';

import { onboardingFinished } from './onboarding-finished';

/* Tester Claude, 19 October 2026 (live, Tester Signup 2): a lawyer who stopped
 * at onboarding step 8 got into the new design, because the lawyer path sets
 * the profession at step 1 and v1's rule counts a profession as done. */

test('a lawyer who stopped part-way is not finished, though the profession is set', () => {
  assert.equal(onboardingFinished({ profession: 'lawyer', onboarding_step: 7, onboarding_completed_at: null }), false);
});

test('a student who stopped part-way is not finished', () => {
  assert.equal(onboardingFinished({ profession: null, onboarding_step: 2, onboarding_completed_at: null }), false);
  assert.equal(onboardingFinished({ profession: 'student', onboarding_step: 3, onboarding_completed_at: null }), false);
  // Tester Signup 4 (19 October 2026): left at step 5, profession set at step 4.
  assert.equal(onboardingFinished({ profession: 'student', onboarding_step: 4, onboarding_completed_at: null }), false);
});

test('finished, by the last step or by Skip on it: the completion date decides', () => {
  assert.equal(onboardingFinished({ profession: 'lawyer', onboarding_step: 8, onboarding_completed_at: '2026-10-19T11:58:00Z' }), true);
  // A skip that completes leaves a date even with no profession.
  assert.equal(onboardingFinished({ profession: null, onboarding_step: 2, onboarding_completed_at: '2026-10-19T12:00:00Z' }), true);
});

test('an account that onboarded before the completion date existed is finished by its profession', () => {
  assert.equal(onboardingFinished({ profession: 'lawyer', onboarding_step: null, onboarding_completed_at: null }), true);
  assert.equal(onboardingFinished({ profession: 'lawyer', onboarding_completed_at: null }), true);
});

test('a new account, or no profile at all, is not finished', () => {
  assert.equal(onboardingFinished({ profession: null, onboarding_step: null, onboarding_completed_at: null }), false);
  assert.equal(onboardingFinished({ profession: '', onboarding_step: null }), false);
  assert.equal(onboardingFinished(null), false);
  assert.equal(onboardingFinished(undefined), false);
});
