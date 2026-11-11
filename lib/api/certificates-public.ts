import { getApiUrl } from '@/lib/constants/seo';
import { normalizeCertificateNumber, verificationOutcome, type VerificationOutcome } from '@/lib/certificates/model';

/**
 * Public certificate check: `GET /api/certificates/verify/{number}` (shapes
 * agreed with WOZ, 11 November 2026). No sign-in.
 *
 * Called from the VISITOR'S browser, not the Next server (Techlead 113d06a1):
 * the API limits verify by address, and from the server every visitor shares
 * one address, so one person checking junk numbers would make everyone's real
 * check fail. From the browser each visitor has their own limit.
 *
 * A plain `fetch`, not `apiClient`: that client attaches a token and treats a
 * 401 as a dead session, so a public link could sign someone out and send them
 * to /login. No credentials are sent.
 *
 * A number that does not match the server's pattern is "not found" without a
 * request.
 */
export async function fetchCertificateVerification(rawNumber: string, signal?: AbortSignal): Promise<VerificationOutcome> {
  const number = normalizeCertificateNumber(rawNumber);
  if (number === null) return { kind: 'not_found' };

  const apiUrl = getApiUrl().replace(/\/$/, '');
  try {
    const response = await fetch(`${apiUrl}/api/certificates/verify/${encodeURIComponent(number)}`, {
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      cache: 'no-store',
      signal,
    });
    const body = response.status === 404 ? null : await response.json().catch(() => null);
    return verificationOutcome(response.status, body);
  } catch {
    return { kind: 'unavailable' };
  }
}
