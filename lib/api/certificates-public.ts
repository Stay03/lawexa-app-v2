import { getApiUrl } from '@/lib/constants/seo';
import { normalizeCertificateNumber, verificationOutcome, type VerificationOutcome } from '@/lib/certificates/model';

/**
 * Public certificate check: `GET /api/certificates/verify/{number}` (shapes
 * agreed with WOZ, 11 November 2026). No sign-in.
 *
 * A plain `fetch`, not `apiClient`, for the reason `fetchPublicQuizResults`
 * gives: that client attaches a token and treats a 401 as a dead session, so a
 * public link could sign someone out and send them to /login. It also keeps the
 * auth store out of this server module's graph.
 *
 * Cached for a minute: a certificate shared on a CV may be checked by many
 * people from the server's one address, and the API limits by address. A minute
 * is short enough that revoking (when it exists) shows quickly.
 */
const VERIFY_REVALIDATE_SECONDS = 60;

export async function fetchCertificateVerification(rawNumber: string): Promise<VerificationOutcome> {
  const number = normalizeCertificateNumber(rawNumber);
  if (number === null) return { kind: 'not_found' };

  const apiUrl = getApiUrl().replace(/\/$/, '');
  try {
    const response = await fetch(`${apiUrl}/api/certificates/verify/${encodeURIComponent(number)}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: VERIFY_REVALIDATE_SECONDS },
    });
    const body = response.status === 404 ? null : await response.json().catch(() => null);
    return verificationOutcome(response.status, body);
  } catch {
    return { kind: 'unavailable' };
  }
}
