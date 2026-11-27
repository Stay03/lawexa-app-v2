import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  GUEST_PRINCIPLES_FIRST,
  caseEndsAtTheOffer,
  caseLockReader,
  fullReportAction,
  guestPrinciplesSource,
  lockedReportPrinciple,
  principlesFadeIntoOffer,
} from './guest-fade';

/* v2 Stage 1, item 1, A2 (Stay, 19 October 2026: 13:06 UTC picked A2; 14:07
 * "1. Remove the chat text area 2. Make sure full report button is there
 * too"; 14:09 "No summary. Fade principles. It's enough"). Server guest-locks
 * (27 November 2026): a locked case sends `locked_preview` in place of its
 * principles, for a guest and for a signed-in reader without a paid plan. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
const detail = (...parts: string[]) => read('v2', 'features', 'cases', 'detail', ...parts);

const principle = { id: 1, order: 1, principle: 'FIXTURE' } as never;

const preview = (reader: 'guest' | 'member', total = 3) => ({
  reader,
  source: 'editorial' as const,
  total,
  first: total > 1 ? { text: 'FIXTURE first.' } : null,
  second: total > 0 ? { text: 'FIXTURE second…' } : null,
});

test('the server’s lock names the reader; without it only a guest’s cut case is locked', () => {
  assert.equal(caseLockReader({ limit_exceeded: true, locked_preview: preview('guest') }, 'guest'), 'guest');
  assert.equal(caseLockReader({ limit_exceeded: true, locked_preview: preview('member') }, 'user'), 'member');
  // A server from before the lock: a guest's case without its summary.
  assert.equal(caseLockReader({ limit_exceeded: true }, 'guest'), 'guest');
  // A reader over the monthly limit on that server keeps the upgrade card.
  assert.equal(caseLockReader({ limit_exceeded: true }, 'user'), null);
  assert.equal(caseLockReader({ limit_exceeded: false }, 'guest'), null);
  // Staff and paid readers get no lock and the full case.
  assert.equal(caseLockReader({}, 'admin'), null);
});

test('a locked case’s principles fade into the offer; with no entries the summary card takes it', () => {
  assert.equal(principlesFadeIntoOffer({ limit_exceeded: true, locked_preview: preview('member') }, 'user'), true);
  assert.equal(principlesFadeIntoOffer({ limit_exceeded: true, locked_preview: preview('guest', 1) }, 'guest'), true);
  assert.equal(principlesFadeIntoOffer({ limit_exceeded: true, locked_preview: preview('guest', 0) }, 'guest'), false);
  // The server from before: the guest's principles are all there.
  const gated = { limit_exceeded: true, report_principles: [principle] };
  assert.equal(principlesFadeIntoOffer(gated, 'guest'), true);
  assert.equal(principlesFadeIntoOffer({ limit_exceeded: true, principles: 'FIXTURE.' }, 'guest'), true);
  assert.equal(principlesFadeIntoOffer(gated, 'user'), false);
  assert.equal(principlesFadeIntoOffer({ limit_exceeded: false, report_principles: [principle] }, 'guest'), false);
  assert.equal(principlesFadeIntoOffer({ limit_exceeded: true, report_principles: [], principles: ' ' }, 'guest'), false);
});

test('the Full judgment button: the report for a reader, the offer on a locked case, nothing over the limit', () => {
  assert.equal(fullReportAction({ has_full_report: true, limit_exceeded: false }, 'user'), 'open');
  assert.equal(fullReportAction({ has_full_report: true }, 'guest'), 'open');
  assert.equal(fullReportAction({ has_full_report: true, limit_exceeded: true }, 'guest'), 'offer');
  assert.equal(fullReportAction({ has_full_report: true, limit_exceeded: true }, 'user'), null);
  assert.equal(fullReportAction({ has_full_report: true, limit_exceeded: true, locked_preview: preview('member') }, 'user'), 'offer');
  assert.equal(fullReportAction({ has_full_report: false, limit_exceeded: true }, 'guest'), null);
  const actions = detail('CaseActions.tsx');
  // The offer is a button on this page, never a link to an empty report page.
  assert.match(actions, /fullReport === 'offer' \? \(\s*<button type="button" onClick=\{showGuestOffer\}/);
  assert.match(actions, /document\.getElementById\(GUEST_OFFER_ID\)/);
  assert.match(actions, /offer\.querySelector<HTMLElement>\('a'\)\?\.focus\(\{ preventScroll: true \}\);/);
  assert.match(detail('CaseDocument.tsx'), /fullReport=\{fullReportAction\(detail, role\)\}/);
});

test('the locked principles: the first whole, the next fading, then the offer inline; no summary section', () => {
  const doc = detail('CaseDocument.tsx');
  assert.match(doc, /const full = entries\.length > 1 \? entries\[0\] : null;/);
  assert.match(doc, /const faded = entries\.length > 1 \? entries\[1\] : entries\[0\];/);
  assert.match(doc, /<NumberedPrinciple key=\{faded\.key\} index=\{full \? 1 : 0\} className="doc-guest-fade">/);
  assert.match(doc, /<\/ol>\s*<GuestOffer reader=\{reader\} \/>\s*<\/section>/);
  // The server's entries when it cut the case, and its count in the heading.
  assert.match(doc, /: detail\.locked_preview\s*\? lockedEntries\(detail\.locked_preview\)/);
  assert.match(doc, /total=\{detail\.locked_preview\?\.total\}/);
  assert.match(doc, /<SectionHeading label="Legal principles" count=\{total \?\? entries\.length\} sub=\{sub\} \/>/);
  // One block only (Stay, 14:57 UTC), the kind the switch picks.
  assert.match(doc, /const guestSource = guestFade \? guestPrinciplesSource\(detail\) : null;/);
  assert.match(doc, /\{guestFade \? null : \(\s*<section\s*id=\{SECTION\.summary\}/);
  assert.match(detail('CaseScreen.tsx'), /const outline = buildCaseOutline\(detail, role\);/);
  // A mask, so the fade works on either theme's ground.
  const css = detail('case-document.css');
  assert.match(css, /\.v2-case-doc \.doc-guest-fade \{[^}]*mask-image: linear-gradient\(to bottom, #000 15%, transparent 100%\);/);
  const states = detail('states.tsx');
  assert.match(states, /export const CASE_LOCK_TITLE = 'Subscribe to read the full case';/);
  assert.match(states, /export const CASE_LOCK_BODY = 'The full principles and the summary come with a Lawexa plan\.';/);
  assert.match(states, /className="flex scroll-mt-6 flex-col items-start gap-3 border-t border-border\/60 pt-5"/);
});

test('the server’s first report entry draws as a principle with its caption and no link', () => {
  const drawn = lockedReportPrinciple({
    text: 'FIXTURE principle.',
    verbatim_window: 'FIXTURE passage.',
    type: 'ratio',
    law_type: ['contract'],
    tag: null,
    judge: { name: 'FIXTURE JSC', role: 'lead' },
    reviewed: true,
  } as never);
  assert.equal(drawn.principle, 'FIXTURE principle.');
  assert.equal(drawn.verbatim_window, 'FIXTURE passage.');
  assert.equal(drawn.type, 'ratio');
  assert.deepEqual(drawn.judge, { id: 0, slug: '', name: 'FIXTURE JSC', role: 'lead' });
  assert.equal(lockedReportPrinciple({ text: 'FIXTURE.' }).reviewed, true);
});

test('one block of principles: the server’s pick, else editorial first', () => {
  const both = { principles: 'FIXTURE.', report_principles: [principle] };
  assert.equal(GUEST_PRINCIPLES_FIRST, 'editorial');
  assert.equal(guestPrinciplesSource(both), 'editorial');
  assert.equal(guestPrinciplesSource({ principles: ' ', report_principles: [principle] }), 'report');
  assert.equal(guestPrinciplesSource({ principles: 'FIXTURE.' }), 'editorial');
  assert.equal(guestPrinciplesSource({}), null);
  assert.equal(guestPrinciplesSource(both, 'report'), 'report');
  assert.equal(guestPrinciplesSource({ principles: 'FIXTURE.' }, 'report'), 'editorial');
  assert.equal(guestPrinciplesSource({ locked_preview: { ...preview('guest'), source: 'report' } }), 'report');
});

test('a locked page ends at the offer: nothing under it, and no outline rail', () => {
  assert.equal(caseEndsAtTheOffer({ limit_exceeded: true }, 'guest'), true);
  assert.equal(caseEndsAtTheOffer({ limit_exceeded: true }, 'user'), false);
  assert.equal(caseEndsAtTheOffer({ limit_exceeded: true, locked_preview: preview('member') }, 'user'), true);
  assert.equal(caseEndsAtTheOffer({ limit_exceeded: false }, 'guest'), false);
  const doc = detail('CaseDocument.tsx');
  assert.match(doc, /\{guestEndsAtOffer \? null : \(\s*<>\s*\{\/\* ── Depth/);
  assert.match(doc, /<AboutThisCase detail=\{detail\} countryCode=\{countryCode\} \/>\s*<\/>\s*\)\}\s*<\/article>/);
  assert.match(doc, /if \(caseEndsAtTheOffer\(detail, role\)\) return \[\];/);
});

test('a visitor without an account has no chat box on a case', () => {
  const screen = detail('CaseScreen.tsx');
  assert.match(screen, /\{signedIn && showDock \? \(\s*<CaseAskDock/);
  assert.match(screen, /\{signedIn && showDocked && renderedChat !== null \? \(\s*<CaseChatDocked/);
  // The dock gave the column its bottom room; without it the column keeps its own.
  assert.match(screen, /!signedIn && 'pb-24',/);
});
