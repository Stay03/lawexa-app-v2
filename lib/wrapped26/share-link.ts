import { shareUrl } from '@/lib/wrapped/copy';
import type { Wrapped26Platform } from './progress';

/**
 * A Wrapped 2026 share link: the person's referral code, with the kit's utm
 * tags (BUILD_SPEC §6): utm_source={platform}, utm_campaign=wrapped2026,
 * utm_content={track}.
 */
export function wrapped26Link(code: string, platform: Wrapped26Platform | 'invite', track: string): string {
  const url = new URL(shareUrl(code));
  url.searchParams.set('utm_source', platform);
  url.searchParams.set('utm_campaign', 'wrapped2026');
  url.searchParams.set('utm_content', track);
  return url.toString();
}
