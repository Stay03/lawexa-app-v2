import type { Organization, OrganizationType } from '@/types/collab';

/**
 * organizations model — the pure vocabulary of the `/organization` surface:
 * the three verification states, the CAC upload rules, and the type
 * vocabulary. No JSX, no hooks — the panel, the request dialog and the form
 * all read the same answers. Sources: plan W4 item 4, `api-digest.md` §C,
 * study A8 (the three states are KEEP-as-designed) — 2026-08-04.
 */

/* ── The three verification states (study A8, preserved exactly) ──────────── */

/**
 * What the verification section says today:
 *  - `verified`     — `is_verified`; the badge is earned, with the date when
 *                     the server gave one;
 *  - `under-review` — documents submitted, no decision yet;
 *  - `unverified`   — the invitation to submit (the only state with an action).
 */
export type VerificationState = 'verified' | 'under-review' | 'unverified';

/**
 * Derive the state. ORDER MATTERS: `is_verified` wins, because a re-submission
 * on an already-verified organization must not demote the badge back to "under
 * review".
 *
 * ── `verification_requested_at` IS ADMIN-ONLY, AND THAT IS THE PROBLEM ──────
 * The server ships that timestamp to PLATFORM ADMINS only (`types/collab.ts`:
 * the field sits in the admin-only block beside `bn_number` and
 * `cac_document_url`). So the person who actually submits the documents — an
 * organization owner or admin — never receives it, and a payload-only
 * derivation would bounce them straight back to "Get verified" the instant
 * their upload succeeded: no acknowledgement, and an invitation to submit
 * again.
 *
 * `locallySubmitted` closes that gap from the client side. The screen sets it
 * when a verification request RESOLVES SUCCESSFULLY and keeps it for the life
 * of the screen; the state then reads "under review" for the submitter even
 * though the payload cannot say so. It is deliberately NOT persisted: a reload
 * loses it, and the panel falls back to what the server can prove. That is the
 * honest failure direction — an over-eager "under review" that survived
 * reloads would be the client asserting something it does not know.
 *
 * BACKEND DEPENDENCY (ask sent by the coordinator, 2026-08-04): expose
 * `verification_requested_at` to organization owners/admins, not only platform
 * admins. When it lands, `locallySubmitted` becomes belt-and-braces for the
 * first render after a submit and the payload becomes authoritative across
 * reloads and devices — no other code changes.
 */
export function verificationState(
  organization: Organization,
  locallySubmitted = false,
): VerificationState {
  if (organization.is_verified) return 'verified';
  if (organization.verification_requested_at || locallySubmitted) return 'under-review';
  return 'unverified';
}

/* ── CAC document rules (multipart, digest §C) ────────────────────────────── */

/** The server's accepted document types for `cac_document`. */
export const CAC_ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
] as const;

/** `accept` attribute for the hidden file input — extensions, because that is
 *  what the OS file picker filters on. */
export const CAC_ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png';

/** 10 MB server cap. */
export const CAC_MAX_SIZE_BYTES = 10 * 1024 * 1024;

/** BN number field cap (the form's own guard; the server validates the value). */
export const BN_NUMBER_MAX = 50;

/**
 * Client-side pre-validation for the CAC document: an error sentence, or
 * `null` when the file may be sent. The SERVER stays authoritative — this only
 * saves a 10 MB upload from being spent to learn the answer, and it names the
 * file so a reader who picked the wrong one of several knows which.
 */
export function validateCacDocument(file: File): string | null {
  if (!(CAC_ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return `"${file.name}" isn't a PDF, JPG or PNG.`;
  }
  if (file.size > CAC_MAX_SIZE_BYTES) {
    return `"${file.name}" is larger than 10 MB.`;
  }
  return null;
}

/* ── Type vocabulary ──────────────────────────────────────────────────────── */

/** The five organization types, in the order the picker offers them. */
export const ORGANIZATION_TYPES: readonly { value: OrganizationType; label: string }[] =
  [
    { value: 'law_firm', label: 'Law firm' },
    { value: 'university', label: 'University' },
    { value: 'company', label: 'Company' },
    { value: 'bank', label: 'Bank' },
    { value: 'other', label: 'Other' },
  ];

/**
 * Whether the type field must be locked. The server FREEZES `type` once the
 * organization is verified (digest §C) — the form disables the control and
 * says why, rather than letting the reader make a change that would 422.
 */
export function isTypeLocked(organization: Organization | undefined): boolean {
  return organization?.is_verified === true;
}

/** Field caps mirrored from the create/update payload validation. */
export const ORGANIZATION_NAME_MAX = 255;
export const ORGANIZATION_DESCRIPTION_MAX = 5000;
