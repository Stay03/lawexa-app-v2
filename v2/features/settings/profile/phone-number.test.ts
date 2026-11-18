import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PHONE_PROBLEM, formatPhone, phoneDigits, phoneProblem, storedPhone } from '@/lib/utils/phone-number';
import { buildProfilePayload, profileFormValuesFromUser, settleProfileValues, validateProfileForm, visibilityFor } from './form-model';
import type { User } from '@/types/auth';

/* The optional phone number (Arthur, 18 November 2026, thread bbdef040;
 * Backend's contract). TEST DATA: made-up numbers. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test('the server’s rule: optional, "+" then 8 to 15 digits, or a Nigerian 0 and 10 digits', () => {
  assert.equal(phoneProblem(''), null, 'optional');
  assert.equal(phoneProblem('   '), null);
  assert.equal(phoneProblem('+2348031234567'), null);
  assert.equal(phoneProblem('+234 803 123 4567'), null, 'spaces are ignored');
  assert.equal(phoneProblem('(0803) 123-4567'), null, 'brackets and dashes too');
  assert.equal(phoneProblem('0803.123.4567'), null, 'and dots');
  assert.equal(phoneProblem('+4420712345'), null, '10 digits abroad');
  assert.equal(phoneProblem('+1234567'), PHONE_PROBLEM, '7 digits is too short');
  assert.equal(phoneProblem('+1234567890123456'), PHONE_PROBLEM, '16 digits is too long');
  assert.equal(phoneProblem('8031234567'), PHONE_PROBLEM, 'no country code and no leading 0');
  assert.equal(phoneProblem('080312345'), PHONE_PROBLEM, 'a short local number');
  assert.equal(phoneProblem('phone me'), PHONE_PROBLEM);
});

test('a number is kept as the server stores it, and shown as people read it', () => {
  assert.equal(phoneDigits('+234 (803) 123-4567'), '+2348031234567');
  assert.equal(storedPhone('0803 123 4567'), '+2348031234567', 'a Nigerian local number gets its country code');
  assert.equal(storedPhone('+44 20 7123 4567'), '+442071234567');
  assert.equal(storedPhone(''), '');
  assert.equal(storedPhone(' 12ab '), '12ab', 'a refused number stays as typed, for the refusal to name');
  assert.equal(formatPhone('+2348031234567'), '+234 803 123 4567');
  assert.equal(formatPhone('+442071234567'), '+442071234567');
  assert.equal(formatPhone(null), '');
});

const user = (phone: string | null): User =>
  ({ id: 1, uuid: 'u', name: 'TEST DATA Reader', username: 'reader', email: 'reader@example.test', profile: { phone } }) as unknown as User;

test('Settings > Profile: the number is read, checked, settled and sent only when it changed', () => {
  const original = profileFormValuesFromUser(user('+2348031234567'));
  assert.equal(original.phone, '+2348031234567');
  assert.equal(profileFormValuesFromUser(user(null)).phone, '');

  const typed = { ...original, phone: '0803 999 0000' };
  assert.equal(validateProfileForm(typed, visibilityFor(typed)).fields.phone, undefined);
  const settled = settleProfileValues(typed, original);
  assert.equal(settled.phone, '+2348039990000');
  assert.equal(buildProfilePayload(settled, original).phone, '+2348039990000');

  const cleared = settleProfileValues({ ...original, phone: '' }, original);
  assert.equal(buildProfilePayload(cleared, original).phone, '', '"" clears it');
  assert.equal('phone' in buildProfilePayload(original, original), false, 'unchanged, not sent');

  const wrong = { ...original, phone: '12345' };
  assert.equal(validateProfileForm(wrong, visibilityFor(wrong)).fields.phone, PHONE_PROBLEM);
});

test('the wiring: onboarding step 3, the Profile row, and the admin user views', () => {
  const step = read('app', '(onboarding)', 'onboarding', 'step-3', 'page.tsx');
  assert.match(step, /if \(phoneError \|\| heardError\) \{\s*setPhoneTouched\(true\);\s*setHeardTouched\(true\);\s*return;\s*\}/, 'a refused number holds Next');
  assert.match(step, /if \(phone !== null\) stepFields\.phone = storedPhone\(phone\);/, 'sent only when typed');
  assert.match(step, /<Label htmlFor="onboarding-phone">Phone number<\/Label>/);
  const fields = read('v2', 'features', 'settings', 'profile', 'text-fields.ts');
  assert.match(fields, /phone: \{\s*icon: Phone,\s*label: 'Phone number',/);
  assert.match(read('v2', 'features', 'settings', 'profile', 'ProfileScreen.tsx'), /<SettingsFormGroup id="contact" label="Contact">\s*\{textRow\('phone'\)\}/);
  assert.match(read('components', 'admin', 'UserDetailHeader.tsx'), /\{user\.profile\?\.phone \? \(/);
  assert.match(read('components', 'admin', 'AdminUsersTable.tsx'), /\{user\.phone && \(/);
});

/* "How did you hear about us?" (Arthur, 18 November 2026, thread bbdef040;
 * Backend's contract), on the same onboarding step. */
test('the heard-about answer: optional, one of the listed choices, and "Other" needs a few words', async () => {
  const { HEARD_ABOUT_OPTIONS, heardAboutLabel, heardAboutPayload, heardAboutProblem } = await import('@/lib/utils/heard-about');
  assert.deepEqual(
    HEARD_ABOUT_OPTIONS.map((option) => option.value),
    ['friend_or_colleague', 'instagram', 'x', 'linkedin', 'tiktok', 'whatsapp', 'university_or_law_school', 'event', 'search_engine', 'other'],
    'Backend’s keys, in Backend’s order',
  );
  assert.equal(heardAboutProblem(null, ''), null, 'optional');
  assert.equal(heardAboutProblem('instagram', ''), null);
  assert.equal(heardAboutProblem('radio', ''), 'Choose one of the listed options.');
  assert.equal(heardAboutProblem('other', '  '), 'Tell us where you heard about Lawexa.');
  assert.equal(heardAboutProblem('other', 'x'.repeat(101)), 'Keep this to 100 characters or fewer.');
  assert.equal(heardAboutProblem('other', 'A TEST DATA conference'), null);
  assert.deepEqual(heardAboutPayload(null, ''), {}, 'unanswered: nothing sent');
  assert.deepEqual(heardAboutPayload('linkedin', 'stale words'), { heard_about: 'linkedin' }, 'the words go only with Other');
  assert.deepEqual(heardAboutPayload('other', ' A TEST DATA conference '), { heard_about: 'other', heard_about_other: 'A TEST DATA conference' });
  assert.equal(heardAboutLabel('university_or_law_school'), 'University or law school');
  assert.equal(heardAboutLabel('other', 'A TEST DATA conference'), 'Other: A TEST DATA conference');
  assert.equal(heardAboutLabel(null), null);
});

test('the wiring: no line under the phone field, the question on step 3, and admins see the answer', () => {
  const step = read('app', '(onboarding)', 'onboarding', 'step-3', 'page.tsx');
  assert.doesNotMatch(step, /PHONE_HINT/, 'no line under the phone field (Arthur: "use none")');
  assert.doesNotMatch(read('v2', 'features', 'settings', 'profile', 'text-fields.ts'), /PHONE_HINT|hint: .*phone/i);
  assert.match(step, /<Label htmlFor="onboarding-heard-about">How did you hear about us\?<\/Label>/);
  assert.match(step, /if \(phoneError \|\| heardError\) \{/, 'a refused answer holds Next');
  assert.match(step, /saveStep\(\{ step: 3, \.\.\.stepFields, \.\.\.heardAboutPayload\(heardAbout, heardAboutOther\) \}\);/);
  assert.match(read('components', 'admin', 'UserDetailHeader.tsx'), /Heard about Lawexa: \{heardAboutLabel\(user\.profile\?\.heard_about, user\.profile\?\.heard_about_other\)\}/);
  assert.match(read('components', 'admin', 'AdminUsersTable.tsx'), /Heard via \{heardAboutLabel\(user\.heard_about\)\}/);
});
