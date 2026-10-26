import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildRadarPayload, emptyRadarFormValues, mapServerErrors } from '@/v2/features/radars/create/form-model';
import { chosenMembersLine, spaceReportsLine } from '@/v2/features/radars/create/email-audience';
import { pushedScreenFor } from '@/v2/shell/pushed-route';

/* A Radar made in a space (Radar in Spaces, first part, 26 October 2026). The
 * space routes refuse `channels` (StoreSpaceRadarRequest drops the rule, so a
 * stray one is an unknown key), and its reports go to the space's members. */
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const resolved = { jurisdictions: ['nigeria'], timezone: 'Africa/Lagos' };

test('a space Radar sends no channels; a personal one still does', () => {
  const values = { ...emptyRadarFormValues(), name: 'TEST DATA Fintech watch', emailChannel: true };
  const inSpace = buildRadarPayload(values, resolved, { includeFirstScan: true, inSpace: true });
  assert.equal('channels' in inSpace, false);
  assert.equal(inSpace.name, 'TEST DATA Fintech watch');
  const personal = buildRadarPayload(values, resolved, { includeFirstScan: true });
  assert.deepEqual(personal.channels, ['in_app', 'email']);
});

test('the space create form asks who gets the email in place of the personal switch, and names whose plan pays', () => {
  const form = read('v2', 'features', 'radars', 'create', 'RadarForm.tsx');
  // "Email reports to" (plan 6.2) for a space; the personal switch otherwise.
  assert.match(form, /\{space \? \(\s*<EmailAudienceField\s+spaceUuid=\{space\.uuid\}\s+audience=\{values\.emailAudience\}\s+members=\{values\.emailMembers\}/);
  assert.match(form, /\) : \(\s*<div className="flex items-center justify-between gap-4 px-4 py-3">\s*<div>\s*<label\s+htmlFor=\{`\$\{uid\}-email`\}/);
  assert.match(form, /\{ includeFirstScan: mode === 'create', inSpace: space !== undefined \}/);
  const review = read('v2', 'features', 'radars', 'create', 'ReviewDialog.tsx');
  assert.match(review, /spaceReportsLine\(space\.name, values\.emailAudience, values\.emailMembers\.length\)/);
  assert.match(review, /"Each scan uses 1 AI message from the space owner's plan"/);
  // The reader's own balance is not the one that pays, so it is not read.
  assert.match(review, /enabled: values !== null && space === undefined,/);
});

test('New Radar in a space is its own page, with the pushed bar going up to the Radars pill', () => {
  assert.match(
    read('app', 'v2', '(collab)', 'spaces', '[spaceId]', 'radars', 'new', 'page.tsx'),
    /return <SpaceRadarCreateScreen key=\{spaceId\} spaceUuid=\{spaceId\} \/>;/,
  );
  for (const prefix of ['', '/v2']) {
    assert.deepEqual(pushedScreenFor(`${prefix}/spaces/s1/radars/new`), {
      backHref: '/spaces/s1?tab=radars',
      backLabel: 'Back to the space',
      title: { kind: 'fixed', text: 'New Radar' },
    });
    assert.deepEqual(pushedScreenFor(`${prefix}/spaces/s1/radars/r1`), {
      backHref: '/spaces/s1?tab=radars',
      backLabel: 'Back to the space',
      title: { kind: 'none' },
    });
    assert.deepEqual(pushedScreenFor(`${prefix}/spaces/s1/radars/r1/scans/c1`), {
      backHref: '/spaces/s1/radars/r1',
      backLabel: 'Back to the Radar',
      title: { kind: 'none' },
    });
  }
  // The space itself keeps the collab header, so it is still no pushed screen.
  assert.equal(pushedScreenFor('/spaces/s1'), null);
});

test('a created space Radar opens inside the space, and a refusal stays in the form', () => {
  const screen = read('v2', 'features', 'spaces', 'detail', 'radars', 'SpaceRadarCreateScreen.tsx');
  assert.match(screen, /router\.push\(spaceRadarHref\(spaceUuid, radar\.uuid\)\);/);
  assert.match(screen, /if \(apiError\.errors && helpers\.applyServerErrors\(apiError\.errors\)\) return;/);
  // The owner's balance stopped the first scan: no purchase offered to someone else.
  assert.match(screen, /const ownerPays = reason\.payer === 'space_owner';/);
  const hook = read('v2', 'features', 'spaces', 'detail', 'radars', 'use-create-space-radar.ts');
  assert.match(hook, /invalidates: \[spacesQueries\.radarsOf\(spaceUuid\)\],/);
});

test('a space Radar sends who gets the email: everyone, or the chosen members whole', () => {
  const resolved = { jurisdictions: ['nigeria'], timezone: 'Africa/Lagos' };
  const everyone = buildRadarPayload({ ...emptyRadarFormValues(), emailMembers: ['u-1'] }, resolved, {
    includeFirstScan: true,
    inSpace: true,
  });
  assert.equal(everyone.email_audience, 'everyone');
  assert.equal('email_member_uuids' in everyone, false);
  const chosen = buildRadarPayload(
    { ...emptyRadarFormValues(), emailAudience: 'chosen', emailMembers: ['u-1', 'u-2'] },
    resolved,
    { includeFirstScan: false, inSpace: true },
  );
  assert.equal(chosen.email_audience, 'chosen');
  assert.deepEqual(chosen.email_member_uuids, ['u-1', 'u-2']);
  // A personal Radar sends its channels, never an audience.
  const personal = buildRadarPayload({ ...emptyRadarFormValues(), emailAudience: 'chosen' }, resolved, {
    includeFirstScan: true,
  });
  assert.equal('email_audience' in personal, false);
});

test('a refused member lands on the email field, and the words say what a choice means', () => {
  assert.deepEqual(mapServerErrors({ 'email_member_uuids.0': ['That person is not a member of this Space.'] }).fields, {
    email_member_uuids: 'That person is not a member of this Space.',
  });
  assert.equal(chosenMembersLine(0), 'No one chosen yet: reports show in the Space and nobody gets an email.');
  assert.equal(chosenMembersLine(1), '1 member chosen');
  assert.equal(spaceReportsLine('TEST DATA Chambers', 'everyone', 0), 'In TEST DATA Chambers, and by email to every member');
  assert.equal(spaceReportsLine('TEST DATA Chambers', 'chosen', 2), 'In TEST DATA Chambers, and by email to 2 chosen members');
  assert.equal(spaceReportsLine('TEST DATA Chambers', 'chosen', 0), 'In TEST DATA Chambers; no email');
});

test('an edit starts from the Radar’s saved audience and members', () => {
  const field = read('v2', 'features', 'radars', 'create', 'form-model.ts');
  assert.match(field, /emailAudience: radar\.email_audience \?\? 'everyone',\s*emailMembers: \(radar\.email_members \?\? \[\]\)\.map\(\(member\) => member\.uuid\),/);
});
