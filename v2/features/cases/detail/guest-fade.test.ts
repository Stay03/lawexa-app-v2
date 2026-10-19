import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fullReportAction, guestFadesPrinciples } from './guest-fade';

/* v2 Stage 1, item 1, A2 (Stay, 19 October 2026: 13:06 UTC picked A2; 14:07
 * "1. Remove the chat text area 2. Make sure full report button is there
 * too"; 14:09 "No summary. Fade principles. It's enough"). */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
const detail = (...parts: string[]) => read('v2', 'features', 'cases', 'detail', ...parts);

const principle = { id: 1, order: 1, principle: 'FIXTURE' } as never;

test('a guest’s case without its summary fades its principles; nobody else’s does', () => {
  const gated = { limit_exceeded: true, report_principles: [principle] };
  assert.equal(guestFadesPrinciples(gated, 'guest'), true);
  // The flat editorial string counts as principles too.
  assert.equal(guestFadesPrinciples({ limit_exceeded: true, principles: 'FIXTURE.' }, 'guest'), true);
  // A signed-in reader over the monthly limit keeps the upgrade card.
  assert.equal(guestFadesPrinciples(gated, 'user'), false);
  // A guest sent the summary (the server's call) reads the case whole.
  assert.equal(guestFadesPrinciples({ limit_exceeded: false, report_principles: [principle] }, 'guest'), false);
  // No principles: the summary section keeps the offer's card.
  assert.equal(guestFadesPrinciples({ limit_exceeded: true, report_principles: [], principles: ' ' }, 'guest'), false);
});

test('the Full judgment button: the report for a reader, the offer for a guest, nothing over the limit', () => {
  assert.equal(fullReportAction({ has_full_report: true, limit_exceeded: false }, 'user'), 'open');
  assert.equal(fullReportAction({ has_full_report: true }, 'guest'), 'open');
  assert.equal(fullReportAction({ has_full_report: true, limit_exceeded: true }, 'guest'), 'offer');
  assert.equal(fullReportAction({ has_full_report: true, limit_exceeded: true }, 'user'), null);
  assert.equal(fullReportAction({ has_full_report: false, limit_exceeded: true }, 'guest'), null);
  const actions = detail('CaseActions.tsx');
  // The offer is a button on this page, never a link to an empty report page.
  assert.match(actions, /fullReport === 'offer' \? \(\s*<button type="button" onClick=\{showGuestOffer\}/);
  assert.match(actions, /document\.getElementById\(GUEST_OFFER_ID\)/);
  assert.match(actions, /offer\.querySelector<HTMLElement>\('a'\)\?\.focus\(\{ preventScroll: true \}\);/);
  assert.match(detail('CaseDocument.tsx'), /fullReport=\{fullReportAction\(detail, role\)\}/);
});

test('the guest’s principles: the first whole, the next fading, then the offer inline; no summary section', () => {
  const doc = detail('CaseDocument.tsx');
  assert.match(doc, /const full = entries\.length > 1 \? entries\[0\] : null;/);
  assert.match(doc, /const faded = entries\.length > 1 \? entries\[1\] : entries\[0\];/);
  assert.match(doc, /<NumberedPrinciple key=\{faded\.key\} index=\{full \? 1 : 0\} className="doc-guest-fade">/);
  assert.match(doc, /<\/ol>\s*<GuestOffer \/>\s*<\/section>/);
  // Report principles (Stay, 14:17 UTC): the editorial headnote stays whole above them.
  assert.match(doc, /overview=\{principles\.length > 0 \? detail\.principles\?\.trim\(\) \|\| null : null\}/);
  assert.match(doc, /\{overview \? \(\s*<>\s*<div className="doc-prose">\s*<CaseText value=\{overview\} \/>/);
  assert.match(doc, /\{guestFade \? null : \(\s*<section\s*id=\{SECTION\.summary\}/);
  assert.match(doc, /if \(!guestFadesPrinciples\(detail, role\)\) sections\.push\(\{ id: SECTION\.summary, label: 'Summary' \}\);/);
  assert.match(detail('CaseScreen.tsx'), /const outline = buildCaseOutline\(detail, role\);/);
  // A mask, so the fade works on either theme's ground.
  const css = detail('case-document.css');
  assert.match(css, /\.v2-case-doc \.doc-guest-fade \{[^}]*mask-image: linear-gradient\(to bottom, #000 15%, transparent 100%\);/);
  const states = detail('states.tsx');
  assert.match(states, /title="Create a free account to read the case"\s*body="The full principles and the case summary come with a free Lawexa account\."/);
  assert.match(states, /className="flex scroll-mt-6 flex-col items-start gap-3 border-t border-border\/60 pt-5"/);
});

test('a visitor without an account has no chat box on a case', () => {
  const screen = detail('CaseScreen.tsx');
  assert.match(screen, /\{signedIn && showDock \? \(\s*<CaseAskDock/);
  assert.match(screen, /\{signedIn && showDocked && renderedChat !== null \? \(\s*<CaseChatDocked/);
  // The dock gave the column its bottom room; without it the column keeps its own.
  assert.match(screen, /!signedIn && 'pb-24',/);
});
