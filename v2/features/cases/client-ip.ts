/**
 * The reader's address as the proxy in front of this server recorded it, for
 * the API's trusted `X-Lawexa-Client-IP` header (backend a0020709).
 *
 * The RIGHT-MOST `X-Forwarded-For` entry FIRST, never the left-most, and
 * `X-Real-IP` only when that is missing or malformed (Fable SSR review, F1). A
 * visitor can send their own `X-Forwarded-For: 8.8.8.8` or `X-Real-IP: 8.8.8.8`
 * to lawexa.com. A proxy that trusts forwarded headers from anyone passes both
 * through, but it still appends the connection address to `X-Forwarded-For`,
 * so the right-most entry is the one the proxy wrote. A proxy that strips them
 * leaves only that entry. Either way the right-most entry is the visitor
 * (techlead db4d2472). One proxy fronts lawexa.com (Coolify's, at
 * 143.198.231.121; no CDN in front, checked 3 October 2026).
 *
 * Returns null for a missing or malformed value; the API then sees no client
 * IP, never a wrong one.
 */
const IPV4 = /^(\d{1,3})(\.\d{1,3}){3}$/;
const IPV6 = /^[0-9a-f:]+$/i;

function validIp(value: string | undefined): string | null {
  const ip = value?.trim();
  if (!ip) return null;
  if (IPV4.test(ip)) return ip.split('.').every((part) => Number(part) <= 255) ? ip : null;
  return ip.includes(':') && IPV6.test(ip) ? ip : null;
}

export function clientIpFrom(headers: { get(name: string): string | null }): string | null {
  const hops = headers.get('x-forwarded-for')?.split(',') ?? [];
  return validIp(hops[hops.length - 1]) ?? validIp(headers.get('x-real-ip') ?? undefined);
}
