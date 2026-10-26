import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { uploadPrecheck } from './content-model';

/* Spaces design round 3 (12 October 2026): the fixes to the round 3
 * critique (results/spaces-r3/critique.md). Pure rules first, then the
 * wiring, pinned by source. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

const MB = 1024 * 1024;
const file = (name: string, type: string, size: number) => ({ name, type, size });

/* ── The space upload takes what POST /spaces/{uuid}/files takes ─────────── */

test('a picture over 5 MB is refused before it is sent, a document up to 10 MB is not', () => {
  // backend bd76241: the space request extends the document upload request.
  assert.match(
    uploadPrecheck(file('Site photo.jpg', 'image/jpeg', 6 * MB)) ?? '',
    /“Site photo\.jpg” is larger than 5 MB, the most a space takes for a picture\./,
  );
  assert.equal(uploadPrecheck(file('Site photo.jpg', 'image/jpeg', 4 * MB)), null);
  // A picture sent with no type is judged by its name.
  assert.match(uploadPrecheck(file('scan.png', '', 6 * MB)) ?? '', /larger than 5 MB/);
  // A document between the two caps passes.
  assert.equal(uploadPrecheck(file('Bundle.pdf', 'application/pdf', 8 * MB)), null);
  assert.match(uploadPrecheck(file('Bundle.pdf', 'application/pdf', 11 * MB)) ?? '', /larger than 10 MB/);
  // The types the server refuses with a 422.
  assert.match(uploadPrecheck(file('Data room.zip', 'application/zip', MB)) ?? '', /can’t be added/);
  assert.match(
    uploadPrecheck(
      file('Schedule.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', MB),
    ) ?? '',
    /can’t be added/,
  );
});

test('the space precheck reads the chat composer’s rules, not a copy', () => {
  const model = read('v2', 'features', 'spaces', 'content-model.ts');
  assert.match(
    model,
    /import \{\s*ACCEPTED_FILE_TYPES,\s*ALLOWED_FILE_TYPES,\s*isImageAttachment,\s*MAX_DOCUMENT_SIZE,\s*MAX_IMAGE_SIZE,\s*PICTURE_EXTENSIONS,\s*\} from '@\/v2\/features\/conversations\/attachment-rules';/,
  );
  assert.doesNotMatch(model, /1024 \* 1024/);
});

/* ── NICE 1: the move picker's current row keeps its name on a phone ─────── */

test('below sm the current row shows the check alone; the words come back from sm up', () => {
  const dialog = read('v2', 'features', 'spaces', 'move', 'MoveToSpaceDialog.tsx');
  assert.match(
    dialog,
    /<Check aria-hidden className="size-3\.5" \/>\s*<span className="sr-only sm:not-sr-only">In it now<\/span>/,
  );
  // The name still truncates as a last resort, never the mark first.
  assert.match(dialog, /<span className="min-w-0 truncate text-sm font-medium text-foreground">\s*\{space\.name\}/);
});

/* ── NICE 2: a waiting face shows two letters, like every other face ─────── */

test('the waiting list draws its face with MemberAvatar', () => {
  const requests = read('v2', 'features', 'invites', 'JoinRequestsPanel.tsx');
  assert.match(requests, /<MemberAvatar user=\{request\.user\} className=\{REQUEST_AVATAR\} \/>/);
  assert.doesNotMatch(requests, /slice\(0, 1\)/);
  assert.doesNotMatch(requests, /@\/components\/ui\/avatar/);
});

/* ── NICE 3: the exit to the old app (removed 26 October 2026) ─────────────── */

test('no "Switch to classic Lawexa" in the sidebar, the drawer or the bar; the Developer switch stays', () => {
  // Stay, 26 October 2026, with the new design everyone's default: "remove that
  // switch to classic lawexa at the bottom", then "ok keep the dev switch".
  for (const file of ['V2Sidebar.tsx', 'V2Drawer.tsx', 'V2HeaderMenu.tsx', 'V2UserFooter.tsx']) {
    const source = read('v2', 'shell', file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(source, /Switch to classic|SwitchBackButton|switchBackToV1/, file);
  }
  const exit = read('app', 'v2', 'switch-back-button.tsx');
  assert.doesNotMatch(exit, /export function SwitchBackButton/);
  assert.match(exit, /export function switchBackToV1\(\) \{/);
  assert.match(read('v2', 'features', 'settings', 'developer', 'DeveloperScreen.tsx'), /if \(!next\) switchBackToV1\(\);/);
});
