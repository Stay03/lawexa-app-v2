/**
 * The reader's address as the proxy in front of this server recorded it, for
 * the API's trusted `X-Lawexa-Client-IP` header (backend a0020709).
 *
 * THE RIGHT-MOST `X-Forwarded-For` ENTRY, never the left-most. A visitor can
 * send their own `X-Forwarded-For: 8.8.8.8` to lawexa.com, and a proxy that
 * appends puts the real address after it. Only the right-most entry is the one
 * the proxy itself wrote, so a forged value can never be forwarded as the
 * reader's (techlead db4d2472). One proxy fronts lawexa.com (Coolify's, at
 * 143.198.231.121; no CDN in front, checked 3 October 2026), so that entry is
 * the visitor. `X-Real-IP` is the fallback for a proxy that sets it instead.
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
  const proxyRecorded = validIp(hops[hops.length - 1]);
  return proxyRecorded ?? validIp(headers.get('x-real-ip') ?? undefined);
}
