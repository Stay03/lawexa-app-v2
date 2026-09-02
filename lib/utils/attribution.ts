import type { AttributionPayload } from '@/types/auth';

const ATTRIBUTION_KEY = 'lawexa-attribution';

/**
 * THE REFERRAL CODE OUTLIVES THE TAB, AND NOTHING ELSE DOES.
 *
 * The rest of this payload is session-scoped on purpose: utm terms and the
 * landing page describe THIS visit, and carrying them into a visit next week
 * would put a June advert against a September signup.
 *
 * A referral code is not that. Somebody taps an ambassador's link, reads the
 * case, closes the tab, and signs up two days later — and with session storage
 * alone the ambassador is credited for none of it. Arthur asked on 2 September
 * 2026 for shared links to credit the sharer, and this is the half of that
 * promise the share button cannot keep on its own.
 *
 * So the code, alone, is remembered in `localStorage` with the moment it was
 * taken, and it is offered back on any later visit that does not carry a code
 * of its own.
 */
const REFERRAL_KEY = 'lawexa-referral';

/**
 * HOW LONG A TAP STAYS WORTH CREDIT. This is a business number, not a technical
 * one: it decides who gets paid. It is Arthur's to set (thirty days, ninety, or
 * no limit at all) and it is one line to change.
 *
 * `0` means no limit, and the expiry check reads it that way.
 *
 * IT IS A CONVENTION, NOT A RULE. This runs in the reader's browser, so it
 * limits what WE send, not what the server accepts. If the window has to be
 * enforced — and if it decides money, it does — the server has to hold it too.
 */
const REFERRAL_MEMORY_DAYS = 30;
const REFERRAL_MEMORY_MS = REFERRAL_MEMORY_DAYS * 24 * 60 * 60 * 1000;

type RememberedReferral = { code: string; at: number };

/** Storage throws rather than returning null when a browser has storage turned
 *  off (Safari's private mode, a locked-down Android profile). A referral that
 *  cannot be remembered must cost the visit nothing, so every access is
 *  guarded and every failure means "no code". */
function readRemembered(): RememberedReferral | null {
  try {
    const raw = localStorage.getItem(REFERRAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RememberedReferral>;
    if (typeof parsed?.code !== 'string' || typeof parsed?.at !== 'number') return null;
    if (!REFERRAL_CODE_RE.test(parsed.code)) return null;
    if (REFERRAL_MEMORY_MS > 0 && Date.now() - parsed.at > REFERRAL_MEMORY_MS) {
      /* Past the window. Drop it rather than leave it to be re-read and
         re-rejected on every request this browser ever makes again. */
      localStorage.removeItem(REFERRAL_KEY);
      return null;
    }
    return { code: parsed.code, at: parsed.at };
  } catch {
    return null;
  }
}

/**
 * First-touch, exactly like the session payload and like the server: a code
 * already remembered and still inside its window is NOT replaced. An
 * ambassador's link opened today does not take a signup away from the
 * ambassador whose link opened it last week.
 */
function rememberReferral(code: string): void {
  try {
    if (readRemembered()) return;
    localStorage.setItem(REFERRAL_KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {
    // Storage refused. The visit still works; only the memory is lost.
  }
}

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

  /* The one field that outlives this tab. Written here rather than in the read
     so that a visit which never makes an auth call still remembers the code. */
  if (payload.referral_code) rememberReferral(payload.referral_code);
}

/**
 * Returns the stored attribution payload, or an empty object if none exists
 * or we're on the server. Safe to spread into request bodies.
 *
 * ── IT CAPTURES FIRST, AND THAT IS THE WHOLE POINT (2026-08-11) ────────────
 * `referral_code` rides this payload, and the referral it credits is written
 * ONCE — on whichever auth call the visitor hits first, which for almost
 * everybody is the guest token, before they have signed up at all. The API doc
 * is blunt about it: attribution is never rewritten, so a code that misses that
 * first call is lost with nothing to trace it by.
 *
 * Capture used to happen only in `<AttributionBootstrap />`'s effect
 * (`app/layout.tsx`). `useGuestAuth` acquires its token in an effect too, and
 * React runs effects CHILD FIRST — so nothing ordered the write before the
 * read. What actually saved it was unrelated and accidental: the guest call
 * awaits an async fingerprint, so the bootstrap always won the race. Make that
 * fingerprint synchronous one day and every first-time visitor's referral
 * disappears silently.
 *
 * So the read captures first. `captureAttribution` is idempotent and
 * first-touch, so this costs one `sessionStorage` probe and cannot overwrite a
 * payload already taken — and any caller, present or future, is correct without
 * knowing any of the above. The bootstrap stays for the visit where no auth
 * call is made at all.
 */
export function getStoredAttribution(): AttributionPayload {
  if (typeof window === 'undefined') return {};
  captureAttribution();
  const raw = sessionStorage.getItem(ATTRIBUTION_KEY);

  let payload: AttributionPayload = {};
  if (raw) {
    try {
      payload = JSON.parse(raw) as AttributionPayload;
    } catch {
      payload = {};
    }
  }

  /* A visit that arrived with no code of its own inherits the remembered one,
     which is what makes a signup two days after the tap still credit the
     ambassador. A visit that DID arrive with a code keeps it: this fills a gap,
     it never overrules the link in front of the reader. */
  if (!payload.referral_code) {
    const remembered = readRemembered();
    if (remembered) payload.referral_code = remembered.code;
  }

  return payload;
}

/**
 * Clears the stored attribution. Call after a successful user-creating auth
 * call so a subsequent signup in the same tab captures fresh data.
 */
export function clearAttribution(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(ATTRIBUTION_KEY);

  /* The remembered code goes with it. This runs after a signup, so the code has
     just been spent on the account it credited; keeping it would credit the same
     ambassador for the next person who signs up on this browser, whom they did
     not bring. */
  try {
    localStorage.removeItem(REFERRAL_KEY);
  } catch {
    // Storage refused. Nothing was remembered to begin with.
  }
}
