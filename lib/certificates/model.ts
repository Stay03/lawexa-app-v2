import { format, isValid, parseISO } from 'date-fns';

import {
  CERTIFICATE_FILL_INS,
  type CertificateColors,
  type CertificateVerification,
  type IssueCertificatesResult,
  type IssuedCertificate,
} from '@/types/certificates';

/**
 * Certificates: the pure parts the pages share (shapes agreed with WOZ in 384c,
 * 11 November 2026). Nothing here touches the network or a store, so the public
 * verify page (a server component) and the signed-in screens can both use it.
 */

/**
 * The server's number pattern (Techlead 113d06a1): `LX`, the year, a running
 * number of at least six digits, then five check characters without 0, O, 1 or I.
 */
const CERTIFICATE_NUMBER = /^LX-\d{4}-\d{6,}-[A-HJ-NP-Z2-9]{5}$/;

/**
 * A certificate number as the server stores it: upper case, no spaces. People
 * type `lx-2026-000123-k7q9m` or paste ` LX-2026-000123-K7Q9M `, and both are
 * the same certificate. `null` for anything that cannot be a number, so a
 * malformed link shows "no certificate" without asking the server.
 */
export function normalizeCertificateNumber(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.replace(/\s+/g, '').toUpperCase();
  return CERTIFICATE_NUMBER.test(value) ? value : null;
}

/** The public page that confirms a certificate. */
export function certificateVerifyPath(number: string): string {
  return `/verify/${encodeURIComponent(number)}`;
}

/** The PDF's file name when the server sends none. */
export function certificateFileName(number: string): string {
  return `lawexa-certificate-${number}.pdf`;
}

/** `15 November 2026`, or '' when the date is unreadable. Never relative: a certificate is read years later. */
export function formatCertificateDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const parsed = parseISO(iso);
  return isValid(parsed) ? format(parsed, 'd MMMM yyyy') : '';
}

/** A score as printed, or '' when there is none. */
export function formatCertificateScore(score: number | null | undefined): string {
  if (typeof score !== 'number' || !Number.isFinite(score)) return '';
  return `${Math.round(score * 10) / 10}%`;
}

/**
 * Fill-ins in a body that the server will not replace, such as `{nmae}`, so the
 * form can warn before the PDF prints the braces.
 */
export function unknownFillIns(body: string): string[] {
  const known = new Set<string>(CERTIFICATE_FILL_INS);
  const unknown = new Set<string>();
  for (const match of body.matchAll(/\{([^{}\s]*)\}/g)) {
    if (!known.has(match[1])) unknown.add(`{${match[1]}}`);
  }
  return [...unknown];
}

/** `#1a2b3c`: the server takes six-digit hex only. */
export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

/** Colours a new design starts with: Lucy's layout (54b765e1), as WOZ's renderer defaults them. */
export const DEFAULT_CERTIFICATE_COLORS: CertificateColors = {
  primary: '#171307',
  accent: '#C9A227',
  background: '#F7F1E3',
};

/** The wording a new design starts with (WOZ 552ca1fd). The name is printed above it as the hero. */
export const DEFAULT_CERTIFICATE_TITLE = 'Certificate of Participation';
export const DEFAULT_CERTIFICATE_BODY =
  'took part in {programme}, held with {partner} on {date}[, and scored {score} in the closing quiz].';

/**
 * Square brackets mark a clause the PDF leaves out when a fill-in inside it is
 * empty (WOZ 84c5a71c). An unclosed or nested bracket would print as typed, so
 * the form warns about it.
 */
export function bracketProblem(body: string): string | null {
  let depth = 0;
  for (const char of body) {
    if (char === '[') {
      depth += 1;
      if (depth > 1) return 'A [ … ] clause cannot sit inside another one.';
    } else if (char === ']') {
      depth -= 1;
      if (depth < 0) return 'There is a ] without a [ before it.';
    }
  }
  return depth === 0 ? null : 'A [ is never closed with ].';
}

/** Items in the order the server will draw them, without changing the input. */
export function bySort<T extends { sort: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.sort - b.sort);
}

/**
 * Moves one item up or down and renumbers `sort` from 0, so the result can be
 * saved as-is. Returns the same order when the move would leave the list.
 */
export function moveBySort<T extends { uuid: string; sort: number }>(
  items: readonly T[],
  uuid: string,
  direction: -1 | 1,
): T[] {
  const ordered = bySort(items);
  const from = ordered.findIndex((item) => item.uuid === uuid);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= ordered.length) {
    return ordered.map((item, index) => ({ ...item, sort: index }));
  }
  const next = [...ordered];
  [next[from], next[to]] = [next[to], next[from]];
  return next.map((item, index) => ({ ...item, sort: index }));
}

/** Uploads the server accepts for logos and signatures (ce3bb683): PNG, JPG or SVG, up to 2 MB. */
export const CERTIFICATE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const CERTIFICATE_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'] as const;

/** Signatures are drawn into the PDF as pictures: PNG or JPG only (WOZ 2743bdc3). */
export const SIGNATURE_IMAGE_TYPES = ['image/png', 'image/jpeg'] as const;

/** Why an image cannot be uploaded, or `null` when it can. */
export function certificateImageProblem(
  file: { type: string; size: number },
  kind: 'logo' | 'signature' = 'logo',
): string | null {
  const types: readonly string[] = kind === 'logo' ? CERTIFICATE_IMAGE_TYPES : SIGNATURE_IMAGE_TYPES;
  if (!types.includes(file.type)) {
    return kind === 'logo' ? 'Use a PNG, JPG or SVG image.' : 'Use a PNG or JPG image.';
  }
  if (file.size > CERTIFICATE_IMAGE_MAX_BYTES) {
    return 'Use an image of 2 MB or less.';
  }
  return null;
}

/**
 * The verify answer, proved field by field. The public page is a server
 * component, so a malformed body must become "unavailable", never a crash in
 * front of a stranger. `logos` is the one lenient field: an entry without a url is
 * dropped and a blank label reads as `null`, because the certificate itself is still real.
 */
export function readCertificateVerification(body: unknown): CertificateVerification | null {
  if (typeof body !== 'object' || body === null) return null;
  const { data } = body as { data?: unknown };
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;

  const { number, printed_name, programme, event_date, issued_at, valid } = record;
  if (
    typeof number !== 'string' ||
    typeof printed_name !== 'string' ||
    typeof programme !== 'string' ||
    typeof event_date !== 'string' ||
    typeof issued_at !== 'string' ||
    typeof valid !== 'boolean'
  ) {
    return null;
  }

  const partner = record.partner_name;
  const logos = Array.isArray(record.logos)
    ? record.logos.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null) return [];
        const { label, url } = entry as Record<string, unknown>;
        if (typeof url !== 'string' || url === '') return [];
        return [{ label: typeof label === 'string' && label.trim() !== '' ? label : null, url }];
      })
    : [];

  return {
    number,
    printed_name,
    programme,
    partner_name: typeof partner === 'string' && partner !== '' ? partner : null,
    event_date,
    issued_at,
    valid,
    logos,
  };
}

/** What the public page can say: found, certainly not found, or the check itself failed. */
export type VerificationOutcome =
  | { kind: 'found'; certificate: CertificateVerification }
  | { kind: 'not_found' }
  | { kind: 'unavailable' };

/**
 * Only a 404 means "no such certificate". A 429, a 500 or a network failure
 * means the check could not be made, and saying "not genuine" then would
 * wrongly accuse the person holding the certificate.
 */
export function verificationOutcome(status: number, body: unknown): VerificationOutcome {
  if (status === 404) return { kind: 'not_found' };
  if (status < 200 || status >= 300) return { kind: 'unavailable' };
  const certificate = readCertificateVerification(body);
  return certificate ? { kind: 'found', certificate } : { kind: 'unavailable' };
}

/**
 * A list from the server: a bare array, or the house page `{ items, meta }`.
 * Reading both keeps the screens working whichever one WOZ's controller returns.
 */
export function listItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (typeof data === 'object' && data !== null && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: T[] }).items;
  }
  return [];
}

export interface PageOf<T> {
  items: T[];
  page: number;
  lastPage: number;
  total: number;
}

type PageMeta = Partial<Record<'current_page' | 'last_page' | 'total', number>>;

/**
 * A paged answer. The house `paginated()` sends `{ data: [...], pagination }`
 * at the top of the body; some lists send `{ items, meta }` inside `data`.
 * Both read the same, with sensible page numbers when the meta is missing.
 */
export function pageOf<T>(body: unknown): PageOf<T> {
  if (typeof body !== 'object' || body === null) return { items: [], page: 1, lastPage: 1, total: 0 };
  const record = body as { data?: unknown; pagination?: PageMeta; items?: unknown; meta?: PageMeta };
  const inner = record.data;
  const nested = typeof inner === 'object' && inner !== null && !Array.isArray(inner) ? (inner as { items?: unknown; meta?: PageMeta }) : null;
  const items = listItems<T>(Array.isArray(inner) ? inner : nested ? nested : record);
  const meta: PageMeta = record.pagination ?? nested?.meta ?? record.meta ?? {};
  return {
    items,
    page: meta.current_page ?? 1,
    lastPage: meta.last_page ?? 1,
    total: meta.total ?? items.length,
  };
}

export interface TemplateFormValues {
  name: string;
  title: string;
  body: string;
  colors: CertificateColors;
}

/** What stops a template from saving, by field; an empty object when it can save. */
export function templateFormProblems(
  values: TemplateFormValues,
  { isNew = false }: { isNew?: boolean } = {},
): Partial<Record<keyof TemplateFormValues | 'colors.primary' | 'colors.accent' | 'colors.background', string>> {
  const problems: Partial<Record<string, string>> = {};
  if (!values.name.trim()) problems.name = 'Give the design a name admins will recognise.';
  // A new design may leave both blank: the server starts it on Lucy's title and wording (WOZ 84c5a71c).
  if (!isNew && !values.title.trim()) problems.title = 'Add the title printed at the top, such as "Certificate of Participation".';
  if (!isNew && !values.body.trim()) problems.body = 'Add the wording printed under the name.';
  if (values.body.length > 5000) problems.body = 'Keep the wording under 5,000 characters.';
  for (const key of ['primary', 'accent', 'background'] as const) {
    if (!isHexColor(values.colors[key])) problems[`colors.${key}`] = 'Use a colour like #1f2a44.';
  }
  return problems;
}

export interface ProgrammeFormValues {
  name: string;
  templateUuid: string;
  partnerName: string;
  eventDate: string;
  isActive: boolean;
}

/** The template payload. On create, a blank title or wording is left out so the server's default applies. */
export function templatePayload(values: TemplateFormValues, { isNew = false }: { isNew?: boolean } = {}) {
  const title = values.title.trim();
  const body = values.body.trim();
  return {
    name: values.name.trim(),
    ...(isNew && !title ? {} : { title }),
    ...(isNew && !body ? {} : { body }),
    colors: values.colors,
  };
}

/** What stops a programme from saving, by field. */
export function programmeFormProblems(values: ProgrammeFormValues): Partial<Record<keyof ProgrammeFormValues, string>> {
  const problems: Partial<Record<keyof ProgrammeFormValues, string>> = {};
  if (!values.name.trim()) problems.name = 'Name the programme as it should print, such as the session title.';
  if (!values.templateUuid) problems.templateUuid = 'Pick the certificate design.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.eventDate)) problems.eventDate = 'Pick the date of the event.';
  return problems;
}

/** The programme payload the server takes; a blank partner is sent as null. */
export function programmePayload(values: ProgrammeFormValues) {
  return {
    name: values.name.trim(),
    template_uuid: values.templateUuid,
    partner_name: values.partnerName.trim() || null,
    event_date: values.eventDate,
    is_active: values.isActive,
  };
}

/** The issue answer, with every list present even when the server leaves one out. */
export function readIssueResult(data: unknown): IssueCertificatesResult {
  const record = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  const skipped = Array.isArray(record.skipped)
    ? record.skipped.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null) return [];
        const { uuid, reason } = entry as Record<string, unknown>;
        return typeof uuid === 'string' ? [{ uuid, reason: typeof reason === 'string' ? reason : 'Skipped.' }] : [];
      })
    : [];
  return {
    issued: listItems<IssuedCertificate>(record.issued),
    already_had: listItems<IssuedCertificate>(record.already_had),
    skipped,
  };
}

/** "2 issued. 1 already had one. 1 skipped: No name on account." */
export function issueSummary(result: IssueCertificatesResult): string {
  const made = result.issued.length;
  const had = result.already_had.length;
  const parts = [`${made} ${made === 1 ? 'certificate' : 'certificates'} issued.`];
  if (had > 0) parts.push(`${had} already had one and ${had === 1 ? 'keeps it' : 'keep theirs'}.`);
  if (result.skipped.length > 0) {
    const reasons = [...new Set(result.skipped.map((entry) => entry.reason.trim().replace(/\.$/, '')))];
    parts.push(`${result.skipped.length} skipped: ${reasons.join('; ')}.`);
  }
  return parts.join(' ');
}
