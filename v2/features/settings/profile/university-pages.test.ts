import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  UNIVERSITY_MAX_PAGES,
  mergeUniversityPages,
  remainingUniversityPages,
  type University,
  type UniversityResponse,
} from '@/lib/api/universities';

/* A country's university list reaches every university (Arthur, 16 November 2026): one page of 100 sorted by
 * name stopped Nigeria's 167 at the letter T, so Topfaith (#136) showed only to someone who typed. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const uni = (id: number): University => ({ id, name: `TEST DATA University ${id}`, slug: `u${id}`, country_code: 'NG', country: 'Nigeria' });
const page = (ids: number[], current: number, last: number): UniversityResponse => ({
  success: true, message: 'ok', data: ids.map(uni),
  pagination: { current_page: current, per_page: 100, total: 167, last_page: last, from: 1, to: ids.length },
  links: { first: '', last: '', prev: null, next: null },
});

test('after the first page, every other page is asked for, up to the cap', () => {
  assert.deepEqual(remainingUniversityPages(1), []);
  assert.deepEqual(remainingUniversityPages(undefined), []);
  assert.deepEqual(remainingUniversityPages(2), [2]);
  assert.deepEqual(remainingUniversityPages(4), [2, 3, 4]);
  assert.equal(remainingUniversityPages(50).length, UNIVERSITY_MAX_PAGES - 1);
});

test('the pages read as one list: all 167, each once, in the server’s order', () => {
  const first = Array.from({ length: 100 }, (_, i) => i + 1);
  const second = Array.from({ length: 67 }, (_, i) => i + 101);
  const merged = mergeUniversityPages([page(first, 1, 2), page([100, ...second], 2, 2)]);
  assert.equal(merged.data.length, 167);
  assert.equal(merged.data[135].id, 136, 'number 136 (Topfaith on the live list) is in it');
  assert.deepEqual(merged.data.map((u) => u.id), [...first, ...second]);
});

test('onboarding and settings both read every page of a country, and search is unchanged', () => {
  const hook = read('lib', 'hooks', 'useUniversities.ts');
  assert.match(hook, /export function useUniversitiesByCountry[\s\S]{0,400}universityApi\.getEveryPage\(\{\s*country_code: countryCode,/);
  assert.match(hook, /export function useGlobalUniversitySearch[\s\S]{0,400}per_page: 50,/);
  const settings = read('v2', 'features', 'settings', 'profile', 'queries.ts');
  assert.match(settings, /byCountry:[\s\S]{0,400}universityApi\.getEveryPage\(\{\s*country_code: countryCode,/);
  assert.doesNotMatch(settings.slice(settings.indexOf('byCountry:'), settings.indexOf('lawSchools:')), /per_page: 100/);
});
