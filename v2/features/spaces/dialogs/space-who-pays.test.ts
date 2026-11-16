import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Space } from '@/types/collab';
import {
  UNIVERSITY_PAYS_LINE,
  payerStopsLine,
  whoPaysChoices,
  whoPaysField,
  whoPaysPatch,
} from './space-who-pays';

/* "Who pays for Lawexa" in the Space settings (16 November 2026, Backend space-who-pays). */

const space = (over: Partial<Space> = {}): Space =>
  ({ uuid: 's1', name: 'TEST DATA Torts group', my_role: 'owner', who_pays: 'owner', is_university: false, payer: null, ...over }) as Space;

test('the owner gets the choice; anyone else gets nothing', () => {
  assert.equal(whoPaysField(space(), true), 'choice');
  assert.equal(whoPaysField(space({ my_role: 'admin' }), false), null);
  assert.equal(whoPaysField(undefined, true), null);
});

test('in a university Space the owner reads the line instead of a choice', () => {
  assert.equal(whoPaysField(space({ is_university: true }), true), 'university');
  assert.equal(UNIVERSITY_PAYS_LINE, 'In a university Space each member pays for their own Lawexa use.');
  assert.deepEqual(whoPaysPatch(space({ is_university: true }), true, 'owner'), {});
});

test('a server from before who-pays draws no choice and is sent no key', () => {
  assert.equal(whoPaysField(space({ who_pays: undefined }), true), null);
  assert.deepEqual(whoPaysPatch(space({ who_pays: undefined }), true, 'each_member'), {});
});

test('the save sends who_pays only when the owner changed it', () => {
  assert.deepEqual(whoPaysPatch(space(), true, 'owner'), {});
  assert.deepEqual(whoPaysPatch(space(), true, 'each_member'), { who_pays: 'each_member' });
  assert.deepEqual(whoPaysPatch(space({ who_pays: 'each_member' }), true, 'owner'), { who_pays: 'owner' });
  assert.deepEqual(whoPaysPatch(space(), false, 'each_member'), {});
});

test('the one-payer card names whose plan pays today', () => {
  const owner = (payer: Space['payer']) => whoPaysChoices(payer)[0].description;
  assert.equal(owner({ uuid: 'u1', name: 'Ada', is_owner: true }), 'Your plan covers everyone’s Lawexa use here.');
  assert.equal(owner({ uuid: 'u2', name: 'Chidi Obi', is_owner: false }), 'Chidi Obi’s plan covers everyone’s Lawexa use here.');
  assert.equal(owner(null), 'One plan covers everyone’s Lawexa use here.');
  assert.deepEqual(whoPaysChoices(null).map((c) => c.title), ['One payer', 'Each member']);
});

test('switching to each member says when another member stops paying', () => {
  const paidByChidi = space({ payer: { uuid: 'u2', name: 'Chidi Obi', is_owner: false } });
  assert.equal(payerStopsLine(paidByChidi, 'each_member'), 'Chidi Obi will stop paying for this Space.');
  assert.equal(payerStopsLine(paidByChidi, 'owner'), null);
  assert.equal(payerStopsLine(space({ payer: { uuid: 'u1', name: 'Ada', is_owner: true } }), 'each_member'), null);
  assert.equal(payerStopsLine(space({ who_pays: 'each_member' }), 'each_member'), null);
});
