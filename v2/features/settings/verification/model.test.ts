import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { LawyerProfile, LawyerProfileDocument } from '@/lib/api/lawyerVerification';
import {
  DOCUMENTS_TO_SEND,
  MAX_DOCUMENT_BYTES,
  REQUIRED_DOCUMENTS,
  documentKind,
  documentProblem,
  formatVerificationDate,
  placesLeft,
  reviewerNote,
  sortSelection,
  stageDates,
  stageView,
  submitBlocker,
  verificationStage,
} from './model';

const doc = (id: number, over: Partial<LawyerProfileDocument> = {}): LawyerProfileDocument => ({
  id,
  url: `https://files.example/${id}`,
  original_name: `file-${id}.pdf`,
  mime_type: 'application/pdf',
  size: 120_000,
  created_at: '2026-10-01T09:00:00Z',
  ...over,
});

const profile = (over: Partial<LawyerProfile> = {}): LawyerProfile => ({
  id: 7,
  user_id: 42,
  is_verified: null,
  verified_at: null,
  verification_submitted_at: null,
  verification_notes: null,
  rejection_reason: null,
  verification_status: 'draft',
  can_resubmit: true,
  documents: [],
  created_at: '2026-09-30T09:00:00Z',
  updated_at: '2026-09-30T09:00:00Z',
  ...over,
});

const four = [doc(1), doc(2), doc(3), doc(4)];

// ── status → screen ─────────────────────────────────────────────────────────

test('no profile (the API answered 404) is "not started" and can upload', () => {
  const view = stageView(null);
  assert.equal(view.stage, 'not_started');
  assert.equal(view.editable, true);
  assert.equal(view.submitLabel, 'Send for review');
});

test('an empty draft reads the same as no profile', () => {
  assert.equal(verificationStage(profile()), 'not_started');
});

test('a draft with documents counts them in its sentence', () => {
  const view = stageView(profile({ documents: [doc(1), doc(2)] }));
  assert.equal(view.stage, 'draft');
  assert.equal(view.badge, 'Draft');
  assert.match(view.description, /^2 documents of 4 uploaded/);
});

test('a draft with all four says it is ready', () => {
  assert.match(stageView(profile({ documents: four })).description, /All four documents are here/);
});

test('a draft stays editable even when can_resubmit is false', () => {
  assert.equal(stageView(profile({ documents: [doc(1)], can_resubmit: false })).editable, true);
});

test('pending is read-only and has no submit', () => {
  const view = stageView(profile({ verification_status: 'pending', documents: four, can_resubmit: true }));
  assert.equal(view.stage, 'pending');
  assert.equal(view.tone, 'progress');
  assert.equal(view.editable, false);
  assert.equal(view.submitLabel, null);
});

test('approved is read-only and positive', () => {
  const view = stageView(profile({ verification_status: 'approved', is_verified: true, can_resubmit: false }));
  assert.equal(view.badge, 'Verified');
  assert.equal(view.tone, 'positive');
  assert.equal(view.editable, false);
});

test('rejected with can_resubmit is editable and sends "again"', () => {
  const view = stageView(
    profile({ verification_status: 'rejected', rejection_reason: 'Licence expired', can_resubmit: true }),
  );
  assert.equal(view.tone, 'negative');
  assert.equal(view.editable, true);
  assert.equal(view.submitLabel, 'Send again');
  assert.match(view.description, /Read the reason below/);
});

test('rejected with no reason does not point at a reason that is not there', () => {
  const view = stageView(profile({ verification_status: 'rejected', rejection_reason: '  ', can_resubmit: true }));
  assert.doesNotMatch(view.description, /reason/);
});

test('rejected without can_resubmit is read-only and says who to ask', () => {
  const view = stageView(profile({ verification_status: 'rejected', can_resubmit: false }));
  assert.equal(view.editable, false);
  assert.equal(view.submitLabel, null);
  assert.match(view.description, /Contact support/);
});

test('a status this build does not know is "unknown", never approved', () => {
  const odd = profile({ verification_status: 'suspended' as LawyerProfile['verification_status'], is_verified: true });
  const view = stageView(odd);
  assert.equal(view.stage, 'unknown');
  assert.equal(view.editable, false);
  assert.notEqual(view.tone, 'positive');
});

// ── file rules ──────────────────────────────────────────────────────────────

test('PDF, JPG and PNG under 10 MB pass', () => {
  for (const type of ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']) {
    assert.equal(documentProblem({ name: 'a', type, size: 1000 }), null, type);
  }
});

test('a file of exactly 10 MB passes; one byte more is refused', () => {
  assert.equal(documentProblem({ name: 'a.pdf', type: 'application/pdf', size: MAX_DOCUMENT_BYTES }), null);
  assert.equal(
    documentProblem({ name: 'a.pdf', type: 'application/pdf', size: MAX_DOCUMENT_BYTES + 1 }),
    'This file is larger than 10 MB.',
  );
});

test('other types are refused, whatever the extension says', () => {
  assert.equal(
    documentProblem({ name: 'cv.pdf', type: 'application/msword', size: 1000 }),
    'Only PDF, JPG and PNG files can be sent.',
  );
  assert.notEqual(documentProblem({ name: 'scan.heic', type: 'image/heic', size: 1000 }), null);
});

test('an empty MIME type falls back to the extension', () => {
  assert.equal(documentProblem({ name: 'Licence.PDF', type: '', size: 1000 }), null);
  assert.notEqual(documentProblem({ name: 'notes.docx', type: '', size: 1000 }), null);
  assert.notEqual(documentProblem({ name: 'noextension', type: '', size: 1000 }), null);
});

test('an empty file is refused', () => {
  assert.equal(documentProblem({ name: 'a.png', type: 'image/png', size: 0 }), 'This file is empty.');
});

test('a selection keeps good files up to the places left and refuses the rest for the count', () => {
  const files = [
    { name: 'a.pdf', type: 'application/pdf', size: 10 },
    { name: 'b.doc', type: 'application/msword', size: 10 },
    { name: 'c.png', type: 'image/png', size: 10 },
    { name: 'd.png', type: 'image/png', size: 10 },
  ];
  const verdict = sortSelection(files, 2);
  assert.deepEqual(verdict.accepted.map((f) => f.name), ['a.pdf', 'c.png']);
  assert.deepEqual(verdict.rejected.map((r) => r.file.name), ['b.doc', 'd.png']);
  assert.match(verdict.rejected[0].reason, /Only PDF/);
  assert.match(verdict.rejected[1].reason, /Remove one to add another/);
});

test('places left counts uploads still on their way and never goes negative', () => {
  assert.equal(placesLeft(1, 2), 1);
  assert.equal(placesLeft(4, 1), 0);
  assert.equal(placesLeft(6, 0), 0);
});

// ── submit readiness ────────────────────────────────────────────────────────

test('submit opens at exactly four stored documents', () => {
  assert.equal(submitBlocker(REQUIRED_DOCUMENTS, 0), null);
  assert.equal(submitBlocker(3, 0), 'Add 1 more document to send for review.');
  assert.equal(submitBlocker(1, 0), 'Add 3 more documents to send for review.');
  assert.equal(submitBlocker(5, 0), 'Remove 1 document. Exactly 4 are sent for review.');
});

test('an upload in flight blocks submit, even with four stored', () => {
  assert.equal(submitBlocker(4, 1), 'Wait for your uploads to finish.');
});

test('the list of what to send names exactly as many files as are required', () => {
  assert.equal(DOCUMENTS_TO_SEND.length, REQUIRED_DOCUMENTS);
});

// ── details ─────────────────────────────────────────────────────────────────

test('document kind follows the MIME type', () => {
  assert.equal(documentKind({ mime_type: 'application/pdf' }), 'pdf');
  assert.equal(documentKind({ mime_type: 'image/png' }), 'image');
  assert.equal(documentKind({ mime_type: 'application/zip' }), 'other');
});

test('dates format in long British form and tolerate junk', () => {
  assert.equal(formatVerificationDate('2026-10-03T12:00:00Z'), '3 October 2026');
  assert.equal(formatVerificationDate(null), null);
  assert.equal(formatVerificationDate('not a date'), null);
});

test('the dated line shows only what the stage has', () => {
  assert.deepEqual(stageDates(null), []);
  assert.deepEqual(
    stageDates(profile({ verification_status: 'pending', verification_submitted_at: '2026-10-03T12:00:00Z' })),
    ['Sent 3 October 2026'],
  );
  assert.deepEqual(
    stageDates(
      profile({
        verification_status: 'approved',
        verification_submitted_at: '2026-10-03T12:00:00Z',
        verified_at: '2026-10-04T12:00:00Z',
      }),
    ),
    ['Verified 4 October 2026'],
  );
});

test('the reviewer note is the reason on a rejection and the note on an approval', () => {
  assert.deepEqual(
    reviewerNote(profile({ verification_status: 'rejected', rejection_reason: ' Licence expired ' })),
    { kind: 'reason', text: 'Licence expired' },
  );
  assert.deepEqual(
    reviewerNote(profile({ verification_status: 'approved', verification_notes: 'Checked with the NBA' })),
    { kind: 'note', text: 'Checked with the NBA' },
  );
  assert.equal(reviewerNote(profile({ verification_status: 'pending', rejection_reason: 'old reason' })), null);
  assert.equal(reviewerNote(profile({ verification_status: 'approved', verification_notes: '' })), null);
});
