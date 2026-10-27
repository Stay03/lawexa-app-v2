import { V1_COOKIE_VALUE, V2_COOKIE_VALUE } from './cookie';

/**
 * Which design a request gets (v2 Stage 1, item 9: the switch; Stay approved
 * 19 October 2026). ONE rule, read by the proxy that serves the page and by
 * `/sw.js`, which decides whether the v2 service worker runs, so the two can
 * never disagree about which design a browser is in.
 *
 *  1. The reader's own choice wins. `lawexa-ui=v2` is the new design (the
 *     preview opt-in, kept), `lawexa-ui=classic` is the classic design, chosen
 *     in Developer settings. The old `lawexa-ui=v1`, written by the
 *     "Switch to classic Lawexa" button removed on 26 October 2026, is read
 *     as NO choice (Arthur, 27 October 2026: readers holding it had no way
 *     back), and the proxy clears it.
 *  2. With no choice, the deploy's default decides: `V2_DEFAULT=true` gives
 *     everyone the new design. Unset, it is the opt-in preview as before, so
 *     that one setting turns the switch off again without a code change.
 *  3. Search engines and link previews keep the old pages until the new ones
 *     are ready for them: a crawler with no choice gets v1 whatever the
 *     default.
 *
 * `V2_ENABLED` stays the kill switch above all of this (the proxy is inert,
 * and the v2 tree 404s, without it).
 */
export function servesV2({
  uiCookie,
  v2Default,
  userAgent,
}: {
  /** The `lawexa-ui` cookie's value. */
  uiCookie: string | undefined;
  /** `V2_DEFAULT === 'true'` on the server. */
  v2Default: boolean;
  userAgent: string | null | undefined;
}): boolean {
  if (uiCookie === V2_COOKIE_VALUE) return true;
  if (uiCookie === V1_COOKIE_VALUE) return false;
  return v2Default && !isCrawler(userAgent);
}

/**
 * Search engines, link previews and headless browsers. HeadlessChrome is in
 * the list on purpose: the server already treats it as a robot and sends it a
 * short preview, and a robot is what it is.
 */
const CRAWLER =
  /bot\b|bot\/|crawl|spider|slurp|mediapartners|adsbot|bingpreview|facebookexternalhit|facebookcatalog|embedly|quora link preview|outbrain|pinterest|vkshare|w3c_validator|whatsapp|telegrambot|skypeuripreview|redditbot|applebot|yandex|baiduspider|duckduckbot|semrush|ahrefs|petalbot|bytespider|gptbot|headlesschrome|lighthouse/i;

export function isCrawler(userAgent: string | null | undefined): boolean {
  return !!userAgent && CRAWLER.test(userAgent);
}

/** The server's default for a browser that has not chosen. */
export function v2DefaultFromEnv(env: Record<string, string | undefined> = process.env): boolean {
  return env.V2_DEFAULT === 'true';
}
