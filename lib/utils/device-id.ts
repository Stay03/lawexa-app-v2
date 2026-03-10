const DEVICE_ID_KEY = 'lawexa-device-id';
const FINGERPRINT_KEY = 'lawexa-fingerprint';

/**
 * Returns a stable device UUID, generating one on first call.
 * Safe to call outside React (e.g. in axios interceptors).
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';

  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/**
 * Returns the cached FingerprintJS visitor ID, or null if not yet generated.
 */
export function getCachedFingerprint(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(FINGERPRINT_KEY);
}

/**
 * Persists the FingerprintJS visitor ID to localStorage so non-React code
 * (e.g. axios interceptors) can read it.
 */
export function setCachedFingerprint(fingerprint: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FINGERPRINT_KEY, fingerprint);
}

/**
 * Returns both identifiers for inclusion in request bodies.
 */
export function getDeviceIdentifiers(): {
  device_id: string;
  fingerprint: string | null;
} {
  return {
    device_id: getDeviceId(),
    fingerprint: getCachedFingerprint(),
  };
}
