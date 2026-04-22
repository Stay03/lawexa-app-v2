import type { AttributionPayload } from '@/types/auth';

const ATTRIBUTION_KEY = 'lawexa-attribution';

const UTM_MAX = 100;
const UTM_CONTENT_MAX = 150;
const URL_MAX = 2048;
const REFERRAL_CODE_RE = /^[A-Za-z0-9_-]+$/;

function clamp(value: string | null | undefined, max: number): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function buildPayload(): AttributionPayload {
  const params = new URLSearchParams(window.location.search);
  const payload: AttributionPayload = {};

  const utmSource = clamp(params.get('utm_source'), UTM_MAX);
  if (utmSource) payload.utm_source = utmSource;

  const utmMedium = clamp(params.get('utm_medium'), UTM_MAX);
  if (utmMedium) payload.utm_medium = utmMedium;

  const utmCampaign = clamp(params.get('utm_campaign'), UTM_MAX);
  if (utmCampaign) payload.utm_campaign = utmCampaign;

  const utmTerm = clamp(params.get('utm_term'), UTM_MAX);
  if (utmTerm) payload.utm_term = utmTerm;

  const utmContent = clamp(params.get('utm_content'), UTM_CONTENT_MAX);
  if (utmContent) payload.utm_content = utmContent;

  const referralRaw = clamp(params.get('referral_code') ?? params.get('ref'), UTM_MAX);
  if (referralRaw && REFERRAL_CODE_RE.test(referralRaw)) {
    payload.referral_code = referralRaw;
  }

  const landing = clamp(window.location.href, URL_MAX);
  if (landing && isValidUrl(landing)) payload.landing_url = landing;

  const referrer = clamp(document.referrer, URL_MAX);
  if (referrer && isValidUrl(referrer)) {
    try {
      const referrerOrigin = new URL(referrer).origin;
      if (referrerOrigin !== window.location.origin) {
        payload.referrer_url = referrer;
      }
    } catch {
      // ignore — already URL-validated above, unreachable
    }
  }

  return payload;
}

/**
 * Captures attribution data on first load of a session. Idempotent: if a
 * payload is already stored for this session, does nothing (client-side
 * first-touch, mirrors the backend's firstOrCreate semantics).
 */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return;
  if (sessionStorage.getItem(ATTRIBUTION_KEY) !== null) return;

  const payload = buildPayload();
  sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(payload));
}

/**
 * Returns the stored attribution payload, or an empty object if none exists
 * or we're on the server. Safe to spread into request bodies.
 */
export function getStoredAttribution(): AttributionPayload {
  if (typeof window === 'undefined') return {};
  const raw = sessionStorage.getItem(ATTRIBUTION_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as AttributionPayload;
  } catch {
    return {};
  }
}

/**
 * Clears the stored attribution. Call after a successful user-creating auth
 * call so a subsequent signup in the same tab captures fresh data.
 */
export function clearAttribution(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(ATTRIBUTION_KEY);
}
