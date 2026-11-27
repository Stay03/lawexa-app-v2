import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  accountRequiredOf,
  accountRequiredSnapshot,
  dismissAccountRequired,
  showAccountRequired,
  subscribeAccountRequired,
} from '@/lib/utils/account-required';

/* Server guest-locks (27 November 2026): a guest's note is cut with
 * `content_locked`, a guest's statute ends after its first section, and a
 * guest's refused action answers 403 `account_required`. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

const refused = (data: unknown) => ({ response: { status: 403, data } });

test('a refusal is read from its code, never from the status alone', () => {
  assert.deepEqual(
    accountRequiredOf(refused({ success: false, code: 'account_required', action: 'upload', message: 'Create a free account to upload files.' })),
    { action: 'upload', message: 'Create a free account to upload files.' },
  );
  // A 403 for anything else is not a sign-up prompt.
  assert.equal(accountRequiredOf(refused({ message: 'This action is unauthorized.' })), null);
  assert.equal(accountRequiredOf(refused('FIXTURE')), null);
  assert.equal(accountRequiredOf(new Error('FIXTURE')), null);
  assert.equal(accountRequiredOf(null), null);
  // No sentence from the server: a plain one.
  assert.equal(accountRequiredOf(refused({ code: 'account_required' }))?.message, 'Create a free account to do this.');
});

test('the prompt opens on a refusal and closes once', () => {
  let calls = 0;
  const stop = subscribeAccountRequired(() => (calls += 1));
  showAccountRequired({ action: 'note', message: 'FIXTURE' });
  assert.deepEqual(accountRequiredSnapshot(), { action: 'note', message: 'FIXTURE' });
  dismissAccountRequired();
  dismissAccountRequired();
  assert.equal(accountRequiredSnapshot(), null);
  assert.equal(calls, 2);
  stop();
});

test('every refused request opens the one prompt, and the mutation channel adds no toast', () => {
  assert.match(read('lib', 'api', 'client.ts'), /const refusal = accountRequiredOf\(error\);\s*if \(refusal && typeof window !== 'undefined'\) showAccountRequired\(refusal\);/);
  assert.match(read('v2', 'runtime', 'query.ts'), /if \(mutation\.meta\?\.silentError\) return;[\s\S]*?if \(accountRequiredOf\(error\)\) return;/);
  assert.match(read('app', 'v2', 'layout.tsx'), /<AccountRequiredDialog \/>/);
  const dialog = read('v2', 'shell', 'AccountRequiredDialog.tsx');
  assert.match(dialog, /upload: 'Create an account to upload files',/);
  assert.match(dialog, /<AccountOfferButtons className="pt-1" \/>/);
  // A refused attachment leaves no failed chip behind: the prompt says why.
  for (const file of [
    ['v2', 'features', 'conversations', 'conversation', 'ConversationComposer.tsx'],
    ['v2', 'shell', 'designs', 'HomeComposer.tsx'],
  ]) {
    assert.match(read(...file), /if \(accountRequiredOf\(err\)\) \{\s*setUploads\(\(prev\) => prev\.filter\(\(u\) => u\.key !== entry\.key\)\);\s*return;\s*\}/);
  }
});

test('a guest’s cut note fades into “Sign in to read the rest”, and Export leads there', () => {
  const doc = read('v2', 'features', 'notes', 'reader', 'NoteDocument.tsx');
  assert.match(doc, /const locked = note\.content_locked === true;/);
  assert.match(doc, /\{body && locked \? \(\s*<div className="flex flex-col gap-6">\s*<div className="v2-note-locked">\s*<NoteContent html=\{body\} \/>\s*<\/div>\s*<NoteLockOffer \/>/);
  assert.match(doc, /lockedTo=\{locked \? NOTE_LOCK_ID : null\}/);
  const offer = read('v2', 'features', 'notes', 'reader', 'NoteLockOffer.tsx');
  assert.match(offer, />Sign in to read the rest</);
  assert.match(offer, /The full note comes with a free Lawexa account\./);
  assert.match(offer, /<AccountOfferButtons \/>/);
  const actions = read('v2', 'features', 'notes', 'reader', 'NoteActions.tsx');
  assert.match(actions, /\{canExport && lockedTo \? \(\s*<button type="button" onClick=\{\(\) => showOffer\(lockedTo\)\}/);
  const css = read('v2', 'features', 'notes', 'reader', 'note-document.css');
  assert.match(css, /\.v2-note-doc \.v2-note-locked \{[^}]*mask-image: linear-gradient\(to bottom, #000 55%, transparent 100%\);/);
  // A refused export says what the server said ("Sign in to export this note.").
  assert.match(read('v2', 'features', 'notes', 'use-note-export.ts'), /status === 403\s*\? said \?\? "You don't have access to export this note\."/);
});

test('a guest’s statute ends after its excerpt with a free account offer; a member’s copy stays for the old server', () => {
  const paywall = read('v2', 'features', 'statutes', 'reader', 'StatutePaywall.tsx');
  assert.match(paywall, /viewer === 'guest'\s*\? 'Sign in to read the rest'/);
  assert.match(paywall, /`All \$\{totalSections\} sections come with a free Lawexa account\.`/);
  assert.match(paywall, /\{viewer === 'guest' \? \(\s*<AccountOfferButtons className="pt-4" \/>/);
  assert.match(paywall, /Upgrade plan/);
  const doc = read('v2', 'features', 'statutes', 'reader', 'StatuteDocument.tsx');
  assert.match(doc, /return role === 'guest' \? 'Sign in to read it\.' : 'Upgrade to read it\.';/);
});
