/**
 * Certificates (Techlead e465210e, shapes agreed with WOZ in 384c: e5b3a5ed,
 * ca9817af, ce3bb683, 11 November 2026). Ids are uuids, dates ISO 8601.
 */

/** The fill-ins a template's body may carry. */
export const CERTIFICATE_FILL_INS = ['name', 'programme', 'partner', 'date', 'score'] as const;
export type CertificateFillIn = (typeof CERTIFICATE_FILL_INS)[number];

export interface CertificateColors {
  primary: string;
  accent: string;
  background: string;
}

export interface CertificateLogo {
  uuid: string;
  label: string;
  url: string;
  sort: number;
}

export interface CertificateSignatory {
  uuid: string;
  name: string;
  title: string;
  signature_url: string | null;
  sort: number;
}

export interface CertificateTemplate {
  uuid: string;
  /** Internal, for admins only. */
  name: string;
  title: string;
  body: string;
  colors: CertificateColors;
  logos: CertificateLogo[];
  signatories: CertificateSignatory[];
  created_at?: string;
  updated_at?: string;
}

export interface CertificateTemplatePayload {
  name: string;
  title: string;
  body: string;
  colors: CertificateColors;
}

/** Unsaved edits drawn on top of the saved design; nothing is saved. */
export interface CertificatePreviewPayload {
  title?: string;
  body?: string;
  colors?: CertificateColors;
  name?: string;
  score?: number | null;
}

export interface CertificateProgramme {
  uuid: string;
  name: string;
  template_uuid: string;
  partner_name: string | null;
  event_date: string;
  is_active: boolean;
  issued_count: number;
  template_name?: string | null;
}

export interface CertificateProgrammePayload {
  name: string;
  template_uuid: string;
  partner_name: string | null;
  event_date: string;
  is_active: boolean;
}

export interface CertificateProgrammeSummary {
  name: string;
  partner_name: string | null;
  event_date: string;
}

/** One of mine, from `GET /api/certificates`. */
export interface MyCertificate {
  number: string;
  printed_name: string;
  score: number | null;
  issued_at: string;
  programme: CertificateProgrammeSummary;
  download_url: string;
}

/** A certificate as admins see it in a programme's list. */
export interface IssuedCertificate {
  uuid?: string;
  number: string;
  printed_name: string;
  score: number | null;
  issued_at: string;
  valid?: boolean;
  user?: { uuid: string | null; name: string | null } | null;
  revoked_at?: string | null;
}

/**
 * What `POST certificate-programmes/{uuid}/issue` answers (WOZ dc43f756): new
 * certificates, people who already had one (they keep it), and people skipped
 * with a reason (a guest account, no name on the account, a failure).
 */
export interface IssueCertificatesResult {
  issued: IssuedCertificate[];
  already_had: IssuedCertificate[];
  skipped: Array<{ uuid: string; reason: string }>;
}

/** `GET /api/certificates/verify/{number}`: public, never an email. */
export interface CertificateVerification {
  number: string;
  printed_name: string;
  programme: string;
  partner_name: string | null;
  event_date: string;
  issued_at: string;
  valid: boolean;
  logos: Array<{ label: string; url: string }>;
}

export interface IssueCertificatesPayload {
  user_uuids: string[];
  score?: number | null;
}
