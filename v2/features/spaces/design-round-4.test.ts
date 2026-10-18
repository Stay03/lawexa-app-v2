import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SpaceInvitation } from '@/types/collab';
import { SHARED_INVITE_ROLES, TEAM_INVITE_ROLES } from '@/v2/features/collab/membership/invite-roles';
import { invitationRoleMeaning } from '@/v2/features/invitations/row-model';
import { spaceKindMark } from './model';

/* Spaces design round 4 (12 October 2026): the list carried since rounds 0
 * and 1 (results/spaces-r4/critique.md, "carried"). Pure rules first, then
 * the wiring, pinned by source. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

/* ── Round 1 NICE 15: the chat bar on a phone ─────────────────────────────── */

test('below md the bar title fills the centre track and takes two lines', () => {
  const header = read('v2', 'shell', 'V2Header.tsx');
  // The viewport less 24px padding, two 8px gaps and two 92px side tracks.
  assert.match(
    header,
    /hasContent\s*\? 'w-\[calc\(100vw-14rem\)\] md:w-72 lg:w-\[26rem\] xl:w-\[32rem\]'\s*: 'w-0',/,
  );
  assert.doesNotMatch(header, /w-24 min-\[400px\]:w-44/);
  assert.match(
    header,
    /<span className="min-w-0 text-center font-medium text-foreground max-md:line-clamp-2 max-md:text-balance max-md:text-\[13px\] max-md:leading-4 md:truncate md:text-sm">\s*\{title\}/,
  );
  // The place line still sits under it, and still truncates only as a last resort.
  assert.match(header, /<HeaderPlaceLine place=\{showTitle \? place : null\} \/>/);
  assert.match(header, /<span className="min-w-0 truncate">\{shown\.label\}<\/span>/);
});

/* ── Round 1 NICE 12, round 0 #26: one kind mark in the list and the picker ── */

test('the list row and the move picker name a space’s kind with one rule', () => {
  assert.equal(spaceKindMark({ kind: 'shared' }, false), 'Shared');
  assert.equal(spaceKindMark({ kind: 'team' }, true), 'Team');
  assert.equal(spaceKindMark({ kind: 'team' }, false), null);
  // The list row lost its kind box (Stay, 15 October 2026: Work or Study as
  // an icon instead); the move picker keeps the mark.
  const row = read('v2', 'features', 'spaces', 'list', 'SpaceRow.tsx');
  assert.doesNotMatch(row, /spaceKindMark|showsTeamMark\(/);
  const dialog = read('v2', 'features', 'spaces', 'move', 'MoveToSpaceDialog.tsx');
  assert.match(dialog, /const kind = spaceKindMark\(space, teamChannelsOpen\);/);
});

/* ── Round 0 #27: an invitation's role says what it means ─────────────────── */

const spaceInvitation = (
  kind: 'shared' | 'team' | undefined,
  role: SpaceInvitation['role'],
  content_role?: SpaceInvitation['content_role'],
) => ({
  kind: 'space' as const,
  invitation: {
    role,
    content_role,
    space: { uuid: 's', name: 'S', type: 'study' as const, description: null, kind },
  },
});

test('an invitation’s role carries its meaning, in the dialog’s words where they read alone', () => {
  const dialog = (roles: readonly { value: string; description?: string }[], value: string) =>
    roles.find((option) => option.value === value)?.description;

  assert.equal(
    invitationRoleMeaning(spaceInvitation('shared', 'member', 'viewer')),
    dialog(SHARED_INVITE_ROLES, 'viewer'),
  );
  assert.equal(
    invitationRoleMeaning(spaceInvitation('shared', 'member', 'editor')),
    'Can read, add to the space and continue its conversations',
  );
  // A shared space's invitation with no content role does not guess one.
  assert.equal(invitationRoleMeaning(spaceInvitation('shared', 'member')), null);

  assert.equal(
    invitationRoleMeaning(spaceInvitation('team', 'member')),
    'Can read and join the space’s open channels',
  );
  // An absent kind is a team space, as everywhere else.
  assert.equal(
    invitationRoleMeaning(spaceInvitation(undefined, 'member')),
    'Can read and join the space’s open channels',
  );
  assert.equal(
    invitationRoleMeaning(spaceInvitation('team', 'admin')),
    dialog(TEAM_INVITE_ROLES, 'admin'),
  );
  assert.equal(
    invitationRoleMeaning({ kind: 'channel', invitation: { role: 'member' } }),
    'Can read and post in the channel',
  );
  assert.equal(
    invitationRoleMeaning({ kind: 'channel', invitation: { role: 'admin' } }),
    dialog(TEAM_INVITE_ROLES, 'admin'),
  );
  // No meaning the product does not define.
  assert.equal(
    invitationRoleMeaning({ kind: 'organization', invitation: { role: 'member' } }),
    null,
  );
  assert.equal(invitationRoleMeaning({ kind: 'channel', invitation: { role: 'owner' } }), null);
});

test('the invitation card prints the meaning beside the role chip', () => {
  const card = read('v2', 'features', 'invitations', 'InvitationCard.tsx');
  assert.match(
    card,
    /\{row\.roleLabel\}\s*<\/span>\s*\{row\.roleMeaning \? \(\s*<span className="min-w-0 text-pretty text-xs text-muted-foreground">\s*\{row\.roleMeaning\}/,
  );
  const model = read('v2', 'features', 'invitations', 'row-model.ts');
  for (const kind of ['organization', 'space', 'channel']) {
    assert.match(model, new RegExp(`roleMeaning: invitationRoleMeaning\\(\\{ kind: '${kind}', invitation \\}\\),`));
  }
  assert.doesNotMatch(model, /const [A-Z_]+_MEANING = '[^']*[—–]/);
});

/* ── Round 0 #28: a picture file wears a picture, never a flat block ──────── */

test('a picture file shows its thumbnail, else the picture glyph on the neutral ground', () => {
  const mark = read('v2', 'features', 'channels', 'files', 'FileMark.tsx');
  assert.match(mark, /case 'image':\s*return <ImageIcon aria-hidden className=\{className\} \/>;/);
  // A thumbnail that fails falls back to the glyph, and one still loading
  // shows the skeleton over the same ground as the other type glyphs.
  assert.match(mark, /if \(settled === 'failed'\) return <GlyphMark kind="image" box=\{box\} \/>;/);
  assert.match(mark, /const GROUND = 'bg-secondary text-muted-foreground';/);
  assert.match(mark, /<span className=\{cn\(box, 'relative block bg-secondary'\)\}>/);
  // A space's list draws every kind with a plain icon and no tile (version
  // A, Stay, 17 October 2026, 22:19 UTC), so its file rows wear no mark.
  const row = read('v2', 'features', 'spaces', 'detail', 'content', 'feed-rows.tsx');
  assert.match(row, /icon: opening \? Loader2 : FileText,/);
  assert.doesNotMatch(row, /FileMark/);
});
