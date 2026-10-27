import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { V1_COOKIE_SET, V2_COOKIE_SET } from './cookie';
import { isCrawler, servesV2, v2DefaultFromEnv } from './ui-choice';

/* v2 Stage 1, item 9, the switch (Stay approved 19 October 2026): everyone gets
 * the new design, "Switch to classic Lawexa" stays, search engines keep the old
 * pages, and one setting turns it off again. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

const CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const GOOGLE = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const BING = 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)';
const WHATSAPP = 'WhatsApp/2.23.20.0';
const HEADLESS = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0.0.0 Safari/537.36';

test('with the switch on, everyone who has not chosen gets the new design', () => {
  for (const ua of [CHROME, IPHONE, null, undefined, '']) {
    assert.equal(servesV2({ uiCookie: undefined, v2Default: true, userAgent: ua }), true, String(ua));
  }
});

test('"Switch to classic Lawexa" is a choice that holds, and so is the preview opt-in', () => {
  // The classic choice is `classic` now; the old `v1` (before 26 Oct 2026) is no choice.
  assert.equal(servesV2({ uiCookie: 'classic', v2Default: true, userAgent: CHROME }), false);
  assert.equal(servesV2({ uiCookie: 'v1', v2Default: true, userAgent: CHROME }), true);
  assert.equal(servesV2({ uiCookie: 'v1', v2Default: false, userAgent: CHROME }), false);
  assert.equal(servesV2({ uiCookie: 'v1', v2Default: true, userAgent: 'Googlebot/2.1' }), false);
  assert.equal(servesV2({ uiCookie: 'v2', v2Default: false, userAgent: CHROME }), true);
  // An unknown value is no choice.
  assert.equal(servesV2({ uiCookie: 'v2preview', v2Default: true, userAgent: CHROME }), true);
  assert.equal(servesV2({ uiCookie: 'v2preview', v2Default: false, userAgent: CHROME }), false);
});

test('one setting turns the switch off: the preview is opt-in again', () => {
  assert.equal(servesV2({ uiCookie: undefined, v2Default: false, userAgent: CHROME }), false);
  assert.equal(v2DefaultFromEnv({ V2_DEFAULT: 'true' }), true);
  for (const value of [undefined, '', 'false', '1', 'TRUE']) {
    assert.equal(v2DefaultFromEnv({ V2_DEFAULT: value }), false, String(value));
  }
});

test('search engines and link previews keep the old pages', () => {
  for (const ua of [GOOGLE, BING, WHATSAPP, HEADLESS, 'facebookexternalhit/1.1', 'Twitterbot/1.0', 'LinkedInBot/1.0', 'Slackbot-LinkExpanding 1.0']) {
    assert.equal(isCrawler(ua), true, ua);
    assert.equal(servesV2({ uiCookie: undefined, v2Default: true, userAgent: ua }), false, ua);
  }
  for (const ua of [CHROME, IPHONE, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0']) {
    assert.equal(isCrawler(ua), false, ua);
  }
});

test('the classic choice is a cookie that lasts, not a cleared one', () => {
  assert.equal(V1_COOKIE_SET, 'lawexa-ui=classic; path=/; max-age=31536000; samesite=lax');
  assert.equal(V2_COOKIE_SET, 'lawexa-ui=v2; path=/; max-age=31536000; samesite=lax');
  assert.match(read('app', 'v2', 'switch-back-button.tsx'), /document\.cookie = V1_COOKIE_SET;/);
  assert.match(read('components', 'settings', 'DeveloperSettings.tsx'), /document\.cookie = next \? V2_COOKIE_SET : V1_COOKIE_SET;/);
});

test('the proxy and the service worker read the same rule', () => {
  const proxy = read('proxy.ts');
  assert.match(proxy, /const uiCookie = request\.cookies\.get\(UI_COOKIE\)\?\.value;\s*const hasV2Cookie = servesV2\(\{\s*uiCookie,\s*v2Default: v2DefaultFromEnv\(\),\s*userAgent: request\.headers\.get\('user-agent'\),\s*\}\)/);
  // The kill switch still comes first.
  assert.ok(proxy.indexOf("process.env.V2_ENABLED !== 'true'") < proxy.indexOf('servesV2('));
  const worker = read('app', 'sw.js', 'route.ts');
  assert.match(worker, /v2Default: v2DefaultFromEnv\(\),\s*userAgent: request\.get\('user-agent'\),/);
  assert.match(read('v2', 'runtime', 'sw', 'serve.ts'), /servesV2\(\{ uiCookie: gate\.uiCookie, v2Default: gate\.v2Default, userAgent: gate\.userAgent \}\)/);
});

test('the proxy clears the old classic choice on whatever it answers', () => {
  const proxy = read('proxy.ts');
  assert.match(proxy, /if \(uiCookie === LEGACY_V1_COOKIE_VALUE\) response\.cookies\.delete\(UI_COOKIE\);/);
  // Every answer goes through it: the pass-through, the rewrite and both redirects.
  assert.equal(proxy.match(/return answer\(NextResponse\./g)?.length, 5);
  assert.doesNotMatch(proxy.replace(/if \(process\.env\.V2_ENABLED !== 'true'\) \{\s*return NextResponse\.next\(\);\s*\}/, ''), /return NextResponse\./);
});
