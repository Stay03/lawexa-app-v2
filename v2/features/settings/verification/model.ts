import type {
  LawyerDocumentType,
  LawyerProfile,
  LawyerProfileDocument,
} from '@/lib/api/lawyerVerification';
import type { ApiError } from '@/lib/utils/api-error';

/**
 * Lawyer verification — the pure part: which screen a profile gets, which
 * files may be sent, and when the set is ready to go for review. No React, so
 * it is tested with Node's runner.
 *
 * ── WHAT THE API GIVES US ──────────────────────────────────────────────────
 * `GET /lawyer-verification/my-profile` answers 404 ("No lawyer profile found.
 * Create one first.") for a lawyer who never reached onboarding step 8, and
 * otherwise a profile whose `verification_status` is one of `draft`,
 * `pending`, `approved` or `rejected`, with `can_resubmit` and the uploaded
 * `documents`. A document carries a name, a MIME type, a size, a signed URL
 * and a `document_type`: one of the four slot keys, or `null` for a file sent
 * before the type existed (contract agreed 5 October 2026, tech lead fc37ee74).
 *
 * A file is placed in a slot BY ITS TYPE AND NOTHING ELSE. v1's onboarding
 * placed them by array index, and the labels moved onto the wrong files as
 * soon as one was removed. A file with no type, or a type this build does not
 * know, goes to "Other documents" and is never guessed into a slot.
 */

/** v1's rule, on both of its screens: exactly four documents are sent. */
export const REQUIRED_DOCUMENTS = 4;

/** v1's rule and the API's documented limit: 10 MB per file. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** The MIME types v1 accepted. `image/jpg` is not a registered type, but some
 *  browsers report it, and v1 accepted it, so it stays. */
const ALLOWED_TYPES: readonly string[] = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
];

const ALLOWED_EXTENSIONS: readonly string[] = ['pdf', 'jpg', 'jpeg', 'png'];

/** The picker's `accept`, so the system dialog offers the right files first. */
export const DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

/**
 * The four slots, in the order v1's onboarding asked for them. `type` is the
 * wire key (v1's own); the label and detail are v2's words. v1 said "Call to
 * Bar Certificate", "Practicing License" and "CV / Resume"; v2 writes sentence
 * case and the British spelling of the noun, as the rest of the product does.
 */
export interface DocumentSlot {
  type: LawyerDocumentType;
  label: string;
  detail: string;
}

export const DOCUMENT_SLOTS: readonly DocumentSlot[] = [
  { type: 'id', label: 'Means of ID', detail: 'NIN, international passport or similar' },
  { type: 'certificate', label: 'Call to Bar certificate', detail: 'A scan or a clear photo' },
  { type: 'license', label: 'Practising licence', detail: 'Your current one' },
  { type: 'cv', label: 'CV or résumé', detail: 'Ideally a PDF' },
];

const SLOT_TYPES: readonly string[] = DOCUMENT_SLOTS.map((slot) => slot.type);

export function isDocumentType(value: unknown): value is LawyerDocumentType {
  return typeof value === 'string' && SLOT_TYPES.includes(value);
}

export interface ArrangedDocuments {
  /** The file in each slot, or `null` for an empty one. */
  slots: Record<LawyerDocumentType, LawyerProfileDocument | null>;
  /** Files with no type, an unknown type, or a second file of a filled type. */
  other: LawyerProfileDocument[];
}

/**
 * Put each document in its slot by `document_type`. The server refuses a
 * second file of a type, but a profile from before that rule may hold two;
 * the first keeps the slot and the second is listed under Other documents, so
 * no file the reviewer will see is ever hidden from its owner.
 */
export function arrangeDocuments(documents: readonly LawyerProfileDocument[]): ArrangedDocuments {
  const slots: ArrangedDocuments['slots'] = { id: null, certificate: null, license: null, cv: null };
  const other: LawyerProfileDocument[] = [];
  for (const document of documents) {
    const type = document.document_type;
    if (isDocumentType(type) && slots[type] === null) slots[type] = document;
    else other.push(document);
  }
  return { slots, other };
}

/** The slots that hold no file, in slot order. */
export function emptySlots(arranged: ArrangedDocuments): DocumentSlot[] {
  return DOCUMENT_SLOTS.filter((slot) => arranged.slots[slot.type] === null);
}

/**
 * Where the reader stands. One value per screen, so every answer the API can
 * give has exactly one designed state.
 *
 *  - `not_started` no profile yet, or a draft with nothing in it
 *  - `draft`       some documents uploaded, not yet sent
 *  - `pending`     sent, waiting for a reviewer
 *  - `approved`    verified
 *  - `rejected`    not approved; may be sent again when `can_resubmit`
 *  - `unknown`     a status this build does not know. Said plainly, never
 *                  guessed at, so a new backend state cannot read as approved.
 */
export type VerificationStage =
  | 'not_started'
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'unknown';

export type StageTone = 'neutral' | 'progress' | 'positive' | 'negative';

export interface StageView {
  stage: VerificationStage;
  /** The word on the status badge. */
  badge: string;
  tone: StageTone;
  title: string;
  /** One or two sentences: where you stand and what to do next. */
  description: string;
  /** Whether documents may be added, removed and sent from this screen. */
  editable: boolean;
  /** The submit button's words, or `null` when the stage has no submit. */
  submitLabel: string | null;
}

/** `profile === null` means the API answered 404: no profile yet. */
export function verificationStage(profile: LawyerProfile | null): VerificationStage {
  if (!profile) return 'not_started';
  switch (profile.verification_status) {
    case 'draft':
      return profile.documents.length === 0 ? 'not_started' : 'draft';
    case 'pending':
    case 'approved':
    case 'rejected':
      return profile.verification_status;
    default:
      return 'unknown';
  }
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function stageView(profile: LawyerProfile | null): StageView {
  const stage = verificationStage(profile);
  const count = profile?.documents.length ?? 0;

  switch (stage) {
    case 'not_started':
      return {
        stage,
        badge: 'Not started',
        tone: 'neutral',
        title: 'Get verified as a lawyer',
        description:
          'Upload the four documents below and send them for review. Verified lawyers get a badge on their profile and can be matched with clients.',
        editable: true,
        submitLabel: 'Send for review',
      };
    case 'draft':
      return {
        stage,
        badge: 'Draft',
        tone: 'neutral',
        title: 'Finish your submission',
        description:
          count >= REQUIRED_DOCUMENTS
            ? 'All four documents are here. Send them for review when you are ready.'
            : `${plural(count, 'document', 'documents')} of ${REQUIRED_DOCUMENTS} uploaded. Add the rest, then send them for review.`,
        editable: true,
        submitLabel: 'Send for review',
      };
    case 'pending':
      return {
        stage,
        badge: 'In review',
        tone: 'progress',
        title: 'Your documents are being reviewed',
        description:
          'A member of our team checks every submission. There is nothing more to do now; the result appears on this page.',
        editable: false,
        submitLabel: null,
      };
    case 'approved':
      return {
        stage,
        badge: 'Verified',
        tone: 'positive',
        title: 'You are a verified lawyer',
        description:
          'Your profile carries the verified badge, and you can be matched with clients.',
        editable: false,
        submitLabel: null,
      };
    case 'rejected':
      return profile?.can_resubmit
        ? {
            stage,
            badge: 'Not approved',
            tone: 'negative',
            title: 'Your documents were not approved',
            description: profile.rejection_reason?.trim()
              ? 'Read the reason below, replace the documents it names, and send them again.'
              : 'Replace the documents that need it, then send them again.',
            editable: true,
            submitLabel: 'Send again',
          }
        : {
            stage,
            badge: 'Not approved',
            tone: 'negative',
            title: 'Your documents were not approved',
            description:
              'Sending again is not open on this account right now. Contact support if you think this is wrong.',
            editable: false,
            submitLabel: null,
          };
    case 'unknown':
      return {
        stage,
        badge: 'Unknown',
        tone: 'neutral',
        title: 'We could not read your status',
        description:
          'The server answered with a status this version of Lawexa does not know. Reload the page, or try again later.',
        editable: false,
        submitLabel: null,
      };
  }
}

/** Anything shaped like a `File`: what the rules read, so tests need no DOM. */
export interface FileLike {
  name: string;
  type: string;
  size: number;
}

function extension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

/**
 * Why a file may not be sent, or `null` when it may.
 *
 * The MIME type decides when the browser reports one. Some report an empty
 * type for a perfectly good file (a PDF from certain Android file pickers),
 * and only then does the extension decide. The server checks again either way.
 */
export function documentProblem(file: FileLike): string | null {
  const type = file.type.toLowerCase();
  const typeOk = type
    ? ALLOWED_TYPES.includes(type)
    : ALLOWED_EXTENSIONS.includes(extension(file.name));
  if (!typeOk) return 'Only PDF, JPG and PNG files can be sent.';
  if (file.size === 0) return 'This file is empty.';
  if (file.size > MAX_DOCUMENT_BYTES) return 'This file is larger than 10 MB.';
  return null;
}

/** Sentence-joined labels: "A", "A and B", "A, B and C". */
function joinLabels(labels: readonly string[]): string {
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/**
 * The sentence under the submit button while it cannot be pressed, or `null`
 * when it can.
 *
 * The rule is the server's: exactly four stored documents, counted across the
 * slots AND Other documents, so a profile whose files predate the types can
 * still be sent. The sentence names the empty slots, because "add one more"
 * says how many but not which. Uploads in flight count as not there yet,
 * because the server has not stored them.
 */
export function submitBlocker(arranged: ArrangedDocuments, inFlight: number): string | null {
  if (inFlight > 0) return 'Wait for your uploads to finish.';
  const stored = DOCUMENT_SLOTS.length - emptySlots(arranged).length + arranged.other.length;
  if (stored < REQUIRED_DOCUMENTS) {
    const empty = emptySlots(arranged).map((slot) => slot.label);
    const missing = REQUIRED_DOCUMENTS - stored;
    if (arranged.other.length === 0 || empty.length === missing) {
      return `Add your ${joinLabels(empty)} to send for review.`;
    }
    return `Add ${plural(missing, 'more document', 'more documents')} to send for review. Still empty: ${joinLabels(empty)}.`;
  }
  if (stored > REQUIRED_DOCUMENTS) {
    const extra = stored - REQUIRED_DOCUMENTS;
    return `Remove ${plural(extra, 'document', 'documents')} from Other documents. Exactly ${REQUIRED_DOCUMENTS} are sent for review.`;
  }
  return null;
}

/**
 * What an upload's failure says, and whether trying the same file again could
 * work.
 *
 * A 422 is the server refusing THIS file for THIS slot, so its own words are
 * shown and Retry is not offered: it would be refused the same way. Backend
 * 3dd1fc6 sends a second file of a held type as a bare `message` ("A
 * Practicing License is already uploaded. Delete it before uploading
 * another.") and a bad type as `errors.document_type`. A field error is
 * preferred over the summary, `document_type` first because it is the slot's
 * own refusal. Only a dropped connection or a server fault is worth retrying.
 */
export function uploadFailure(error: ApiError): { message: string; retryable: boolean } {
  if (error.status === 422) {
    const fieldMessage =
      error.errors?.document_type?.[0] ??
      error.errors?.file?.[0] ??
      (error.errors ? Object.values(error.errors).flat()[0] : undefined);
    const message = fieldMessage?.trim() || error.message.trim();
    return {
      message: message || 'This slot already has a file. Remove the current file first.',
      retryable: false,
    };
  }
  if (error.status >= 400 && error.status < 500) {
    return { message: error.message, retryable: false };
  }
  return {
    message: 'The upload did not finish. Check your connection and try again.',
    retryable: true,
  };
}

export type DocumentKind = 'pdf' | 'image' | 'other';

export function documentKind(document: Pick<LawyerProfileDocument, 'mime_type'>): DocumentKind {
  const type = document.mime_type.toLowerCase();
  if (type === 'application/pdf') return 'pdf';
  if (type.startsWith('image/')) return 'image';
  return 'other';
}

const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** "3 October 2026", or `null` for a missing or unreadable timestamp. */
export function formatVerificationDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : DATE.format(time);
}

/**
 * The dated line under the status: when it was sent, when it was verified.
 * Only the facts the profile actually holds; an empty list draws nothing.
 */
export function stageDates(profile: LawyerProfile | null): string[] {
  if (!profile) return [];
  const lines: string[] = [];
  const sent = formatVerificationDate(profile.verification_submitted_at);
  const verified = formatVerificationDate(profile.verified_at);
  const stage = verificationStage(profile);
  if (stage === 'approved' && verified) lines.push(`Verified ${verified}`);
  if ((stage === 'pending' || stage === 'rejected') && sent) lines.push(`Sent ${sent}`);
  return lines;
}

/** The reviewer's words for this stage, trimmed, or `null` when there are none.
 *  A rejection shows its reason; an approval shows any note left with it. */
export function reviewerNote(
  profile: LawyerProfile | null,
): { kind: 'reason' | 'note'; text: string } | null {
  if (!profile) return null;
  const stage = verificationStage(profile);
  if (stage === 'rejected') {
    const text = profile.rejection_reason?.trim();
    return text ? { kind: 'reason', text } : null;
  }
  if (stage === 'approved') {
    const text = profile.verification_notes?.trim();
    return text ? { kind: 'note', text } : null;
  }
  return null;
}
