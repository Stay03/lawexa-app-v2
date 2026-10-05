import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { LawyerProfile, LawyerProfileDocument } from '@/lib/api/lawyerVerification';
import type { ApiError } from '@/lib/utils/api-error';
import {
  DOCUMENT_SLOTS,
  MAX_DOCUMENT_BYTES,
  REQUIRED_DOCUMENTS,
  arrangeDocuments,
  documentKind,
  documentProblem,
  emptySlots,
  formatVerificationDate,
  isDocumentType,
  reviewerNote,
  stageDates,
  stageView,
  submitBlocker,
  uploadFailure,
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

const typed = (id: number, document_type: LawyerProfileDocument['document_type']) =>
  doc(id, { document_type });

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

const four = [typed(1, 'id'), typed(2, 'certificate'), typed(3, 'license'), typed(4, 'cv')];

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

// ── slots ───────────────────────────────────────────────────────────────────

test('the slots are the four wire keys, in v1 order, with v2 labels', () => {
  assert.deepEqual(
    DOCUMENT_SLOTS.map((slot) => slot.type),
    ['id', 'certificate', 'license', 'cv'],
  );
  assert.deepEqual(
    DOCUMENT_SLOTS.map((slot) => slot.label),
    ['Means of ID', 'Call to Bar certificate', 'Practising licence', 'CV or résumé'],
  );
  assert.equal(DOCUMENT_SLOTS.length, REQUIRED_DOCUMENTS);
});

test('each document goes to the slot its type names, whatever order it arrives in', () => {
  const arranged = arrangeDocuments([typed(1, 'cv'), typed(2, 'id'), typed(3, 'license')]);
  assert.equal(arranged.slots.id?.id, 2);
  assert.equal(arranged.slots.certificate, null);
  assert.equal(arranged.slots.license?.id, 3);
  assert.equal(arranged.slots.cv?.id, 1);
  assert.deepEqual(arranged.other, []);
  assert.deepEqual(emptySlots(arranged).map((slot) => slot.type), ['certificate']);
});

test('a null, missing or unknown type goes to Other documents, never into a slot', () => {
  const unknown = doc(3, { document_type: 'passport' as LawyerProfileDocument['document_type'] });
  const arranged = arrangeDocuments([typed(1, null), doc(2), unknown]);
  assert.deepEqual(Object.values(arranged.slots), [null, null, null, null]);
  assert.deepEqual(arranged.other.map((d) => d.id), [1, 2, 3]);
});

test('a second file of a filled type is listed under Other documents, not hidden', () => {
  const arranged = arrangeDocuments([typed(1, 'id'), typed(2, 'id')]);
  assert.equal(arranged.slots.id?.id, 1);
  assert.deepEqual(arranged.other.map((d) => d.id), [2]);
});

test('isDocumentType accepts exactly the four keys', () => {
  for (const key of ['id', 'certificate', 'license', 'cv']) assert.equal(isDocumentType(key), true);
  for (const key of ['ID', 'licence', '', null, undefined, 3]) assert.equal(isDocumentType(key), false);
});

// ── upload failures ─────────────────────────────────────────────────────────

const apiError = (over: Partial<ApiError>): ApiError => ({
  message: 'The given data was invalid.',
  errors: null,
  status: 422,
  ...over,
});

test('a 422 on a duplicate type shows the API field message and offers no retry', () => {
  const result = uploadFailure(
    apiError({ errors: { document_type: ['You have already uploaded a Means of ID. Remove it first.'] } }),
  );
  assert.deepEqual(result, {
    message: 'You have already uploaded a Means of ID. Remove it first.',
    retryable: false,
  });
});

test('the backend duplicate refusal (message only, 3dd1fc6) is shown as the API wrote it', () => {
  const message = 'A Practicing License is already uploaded. Delete it before uploading another.';
  assert.deepEqual(uploadFailure(apiError({ message, errors: null })), { message, retryable: false });
});

test('an invalid type shows the backend field message', () => {
  const message = 'The document type must be one of: id, certificate, license, cv.';
  assert.equal(uploadFailure(apiError({ errors: { document_type: [message] } })).message, message);
});

test('a 422 with no field errors falls back to the summary, then to our own sentence', () => {
  assert.equal(uploadFailure(apiError({ message: 'Duplicate document type.' })).message, 'Duplicate document type.');
  assert.equal(
    uploadFailure(apiError({ message: '  ' })).message,
    'This slot already has a file. Remove the current file first.',
  );
});

test('a 422 on the file itself shows the file message', () => {
  assert.equal(
    uploadFailure(apiError({ errors: { file: ['The file must not be greater than 10240 kilobytes.'] } })).message,
    'The file must not be greater than 10240 kilobytes.',
  );
});

test('only a network or server failure can be retried', () => {
  assert.equal(uploadFailure(apiError({ status: 0, message: 'Network error. Please try again.' })).retryable, true);
  assert.equal(uploadFailure(apiError({ status: 500 })).retryable, true);
  assert.equal(uploadFailure(apiError({ status: 403, message: 'No profile.' })).retryable, false);
});

// ── submit readiness ────────────────────────────────────────────────────────

test('submit opens with four slots filled', () => {
  assert.equal(submitBlocker(arrangeDocuments(four), 0), null);
});

test('with slots partly filled, the blocker names the empty ones', () => {
  assert.equal(
    submitBlocker(arrangeDocuments([typed(1, 'id'), typed(2, 'cv')]), 0),
    'Add your Call to Bar certificate and Practising licence to send for review.',
  );
  assert.equal(
    submitBlocker(arrangeDocuments([typed(1, 'id'), typed(2, 'certificate'), typed(3, 'cv')]), 0),
    'Add your Practising licence to send for review.',
  );
  assert.equal(
    submitBlocker(arrangeDocuments([]), 0),
    'Add your Means of ID, Call to Bar certificate, Practising licence and CV or résumé to send for review.',
  );
});

test('untyped files count toward the four, as the server counts them', () => {
  // Three typed and one from before the types: four stored, so it may be sent.
  const ready = arrangeDocuments([typed(1, 'id'), typed(2, 'certificate'), typed(3, 'cv'), typed(4, null)]);
  assert.equal(submitBlocker(ready, 0), null);
  // Two typed and one untyped: one more needed, two slots still empty.
  assert.equal(
    submitBlocker(arrangeDocuments([typed(1, 'id'), typed(2, 'cv'), typed(3, null)]), 0),
    'Add 1 more document to send for review. Still empty: Call to Bar certificate and Practising licence.',
  );
});

test('more than four stored says how many to remove from Other documents', () => {
  const crowded = arrangeDocuments([...four, typed(5, null)]);
  assert.equal(submitBlocker(crowded, 0), 'Remove 1 document from Other documents. Exactly 4 are sent for review.');
});

test('an upload in flight blocks submit, even with four stored', () => {
  assert.equal(submitBlocker(arrangeDocuments(four), 1), 'Wait for your uploads to finish.');
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
