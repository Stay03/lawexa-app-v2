import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { statuteLinkTarget } from './document-links';

/* A link in an answer to one of our statute pages stays in the app, and one to
 * a part of the statute the chat is about lands there in place (Stay, 18
 * October 2026, 14:32 UTC: "instead it reloads the page"). */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');
const PAGE = 'https://app.example.test';

test('the API’s own section link, on lawexa.com, is ours', () => {
  assert.deepEqual(statuteLinkTarget('https://lawexa.com/statutes/evidence-act-2011/section-84', PAGE), {
    slug: 'evidence-act-2011',
    provision: 'section-84',
    anchor: null,
    href: '/statutes/evidence-act-2011/section-84',
  });
  assert.equal(statuteLinkTarget('https://www.lawexa.com/statutes/evidence-act-2011/section-54a', PAGE)?.provision, 'section-54a');
});

test('the page’s own origin is ours, whatever host the API was set to', () => {
  assert.equal(statuteLinkTarget(`${PAGE}/statutes/labour-act/section-2`, PAGE)?.slug, 'labour-act');
  assert.equal(statuteLinkTarget(`${PAGE}/statutes/labour-act/section-2`, null), null);
  assert.equal(statuteLinkTarget('http://localhost:3000/statutes/labour-act', 'http://localhost:3000')?.provision, null);
});

test('a relative path, a bare statute and a hash anchor', () => {
  assert.deepEqual(statuteLinkTarget('/statutes/labour-act', null), {
    slug: 'labour-act',
    provision: null,
    anchor: null,
    href: '/statutes/labour-act',
  });
  const hashed = statuteLinkTarget('/statutes/labour-act#akn-sec_7__subsec_2', null);
  assert.equal(hashed?.anchor, 'akn-sec_7__subsec_2');
  assert.equal(hashed?.href, '/statutes/labour-act#akn-sec_7__subsec_2');
  assert.equal(statuteLinkTarget('/statutes/labour-act/Section-7/', null)?.provision, 'section-7');
});

test('not ours: another site, other app pages, deeper paths, other schemes', () => {
  assert.equal(statuteLinkTarget('https://example.org/statutes/labour-act/section-2', PAGE), null);
  assert.equal(statuteLinkTarget('https://lawexa.com.evil.test/statutes/labour-act', PAGE), null);
  assert.equal(statuteLinkTarget('//lawexa.com/statutes/labour-act', PAGE), null);
  assert.equal(statuteLinkTarget('/statutes', null), null);
  assert.equal(statuteLinkTarget('/admin/statutes/labour-act', null), null);
  assert.equal(statuteLinkTarget('/statutes/labour-act/section-2/extra', null), null);
  assert.equal(statuteLinkTarget('/cases/adeyemi-v-okafor', null), null);
  assert.equal(statuteLinkTarget('mailto:someone@example.org', PAGE), null);
  assert.equal(statuteLinkTarget(undefined, PAGE), null);
});

test('a statute link is a badge that stays in the app, and lands in place on its own statute', () => {
  const caseLink = read('CaseMentionLink.tsx');
  assert.match(caseLink, /<DocumentLink href=\{href\} title=\{title\}>/);
  const link = read('StatuteMentionLink.tsx');
  // Ours by the page's origin once the client knows it; the server draws the
  // relative and lawexa.com forms alike.
  assert.match(link, /const target = statuteLinkTarget\(href, origin\);/);
  assert.match(link, /useSyncExternalStore\(\s*noSubscription,\s*\(\) => window\.location\.origin,\s*\(\) => null,\s*\)/);
  // A new-tab or modified click is the browser's own.
  assert.match(link, /return !\(event\.metaKey \|\| event\.ctrlKey \|\| event\.shiftKey \|\| event\.altKey\);/);
  assert.match(
    link,
    /if \(onPage && hasPart\) \{\s*host\.beforeJump\?\.\(\);\s*if \(host\.jump\(target\)\) return;\s*\}[\s\S]*?if \(onPage && !hasPart\) return;\s*router\.push\(target\.href\);/,
  );
  // The case badge's look and gestures: hover on a pointer, a tap on touch.
  assert.match(link, /className=\{MENTION_TRIGGER_CLASS\}/);
  assert.match(link, /<HoverCard openDelay=\{350\} closeDelay=\{250\}>/);
  assert.match(link, /<Popover open=\{open\} onOpenChange=\{setOpen\}>/);
});

test('the pane fetches nothing: the page’s own document, else the link’s words and the part', () => {
  const link = read('StatuteMentionLink.tsx');
  assert.doesNotMatch(link, /useQuery|statutesQueries|statutesApi|apiClient/);
  assert.match(link, /const peek = pageHost && hasPart \? pageHost\.peek\(target\) : null;/);
  assert.match(link, /const name = pageHost \? pageHost\.statuteTitle \|\| linkText : linkText;/);
  assert.match(link, /\? `Go to \$\{label\.charAt\(0\)\.toLowerCase\(\)\}\$\{label\.slice\(1\)\}`/);
  assert.match(link, /: 'Open statute';/);
  const provision = read('..', '..', '..', 'statutes', 'reader', 'provision.ts');
  assert.match(provision, /export function provisionPeek\(/);
  // Its own num and heading are the pane's label, not part of the opening words.
  assert.match(provision, /if \(name === 'num' \|\| name === 'heading'\) continue;/);
});

test('the statute page hosts the links: the document lands, the phone’s chat closes first', () => {
  const screen = read('..', '..', '..', 'statutes', 'reader', 'StatuteScreen.tsx');
  assert.match(screen, /<DocumentLinkContext\.Provider value=\{linkHost\}>/);
  assert.match(screen, /beforeJump: phone \? closeChat : undefined,/);
  assert.match(screen, /registerLinkHandlers=\{registerLinkHandlers\}/);
  assert.match(screen, /peek: \(target\) => linkHandlersRef\.current\?\.peek\(target\) \?\? null,/);
  const document = read('..', '..', '..', 'statutes', 'reader', 'StatuteDocument.tsx');
  // An exact anchor first, then the citation; a locked part lands on the card.
  assert.match(document, /const jump = \(\{ provision: segment, anchor \}: StatuteLinkPart\) => \{/);
  assert.match(document, /registerLinkHandlers\(\{ jump, peek \}\);/);
  assert.match(document, /const target = resolveCitation\(sectionIndex, cited\);/);
  assert.match(document, /land\(blocks\.length, STATUTE_PAYWALL_ID, 'center'\);/);
  assert.match(document, /return \(\) => registerLinkHandlers\(null\);/);
});
