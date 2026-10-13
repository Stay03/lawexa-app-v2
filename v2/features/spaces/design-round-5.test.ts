import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* Spaces design round 5 (13 October 2026, results/spaces-r5/critique.md): the
 * one NICE item. Pinned by source. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test("an invitation's age is the facts line's trailing fact, not an item of the role row", () => {
  const card = read('v2', 'features', 'invitations', 'InvitationCard.tsx');
  // Beside a long role meaning, the age as its own flex item wrapped onto a
  // line of its own between the role line and the buttons on a phone.
  assert.match(card, /trail=\{age \? \[<span key="age" className="tabular-nums">\{age\}<\/span>\] : undefined\}/);
  // The facts line shows whenever there is an age, so no invitation loses it.
  assert.match(card, /\{row\.facts\.length > 0 \|\| age \? \(\s*<MetaLine/);
  // The role row carries the chip, its meaning, the faces and the buttons only.
  const roleRow = card.slice(card.indexOf('sm:ml-13'));
  assert.doesNotMatch(roleRow.slice(0, roleRow.indexOf('<Button')), /\{age\}/);
});
