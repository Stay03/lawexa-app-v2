// Derives a short, human-friendly label ("Chrome on Windows") from the user
// agent for the push-device registry (server caps it at 100 chars). Best-effort;
// falls back gracefully. Safe to call anywhere — guards the navigator global.

export function getDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Web';
  const ua = navigator.userAgent;

  // Order matters: Edge/Opera/Samsung UAs also contain "Chrome", and Chrome's UA
  // contains "Safari" — check the more specific tokens first.
  const browser = /\bEdgA?\b|Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|\bOpera\b/.test(ua)
      ? 'Opera'
      : /SamsungBrowser/.test(ua)
        ? 'Samsung Internet'
        : /CriOS|Chrome\//.test(ua)
          ? 'Chrome'
          : /FxiOS|Firefox\//.test(ua)
            ? 'Firefox'
            : /Safari\//.test(ua)
              ? 'Safari'
              : 'Browser';

  const os = /Windows/.test(ua)
    ? 'Windows'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Macintosh|Mac OS X/.test(ua)
        ? 'macOS'
        : /Android/.test(ua)
          ? 'Android'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'device';

  return `${browser} on ${os}`.slice(0, 100);
}
