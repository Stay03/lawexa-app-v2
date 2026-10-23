import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CHAT_SUBJECT_NOUN,
  CHAT_SUBJECT_PROMPTS,
  chatDraftScope,
  subjectConversationsKey,
} from '../cases/detail/chat-subject';

/* "Ask about this statute" (Stay, 18 October 2026, 01:31 UTC; Arthur, 07:20
 * UTC: one box, which covers sections too). The case page's chat, mounted on
 * the statute page with a statute subject. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
const screen = () => read('v2', 'features', 'statutes', 'reader', 'StatuteScreen.tsx');

test('a statute chat starts with a statute reference and keeps its own draft and list', () => {
  const statute = { kind: 'statute', slug: 'lagos-state-tenancy-law-2011' } as const;
  const kase = { kind: 'case', slug: 'nwadike-v-ibekwe' } as const;
  // The case keeps the draft key it always had, so no case draft is lost.
  assert.equal(chatDraftScope(kase), 'case:nwadike-v-ibekwe');
  assert.equal(chatDraftScope(statute), 'statute:lagos-state-tenancy-law-2011');
  assert.deepEqual(subjectConversationsKey(kase), ['cases', 'conversations', 'nwadike-v-ibekwe']);
  assert.deepEqual(subjectConversationsKey(statute).slice(1), ['conversations', 'lagos-state-tenancy-law-2011']);
  assert.equal(CHAT_SUBJECT_NOUN.statute, 'statute');
  assert.equal(CHAT_SUBJECT_PROMPTS.statute.length, 3);
  const core = read('v2', 'features', 'cases', 'detail', 'CaseChatCore.tsx');
  assert.match(core, /references: \[\{ type: subject\.kind, id: subject\.slug \}\],/);
  assert.match(core, /placeholder=\{`Ask about this \$\{CHAT_SUBJECT_NOUN\[subject\.kind\]\}`\}/);
  assert.match(core, /Chat · this \{noun\}/);
});

test('the statute page hosts the case page’s chat, the same in every part', () => {
  const source = screen();
  assert.match(source, /const subject = useMemo<ChatSubject>\(\(\) => \(\{ kind: 'statute', slug \}\), \[slug\]\);/);
  // The chat belongs to an account; a guest pass reads the statute (guest-pass.test.ts).
  assert.match(source, /\} = useDocumentChat\(subject, hasAccount\);/);
  assert.match(source, /<CaseAskDock\s+subject=\{subject\}/);
  assert.match(source, /<CaseChatDocked\s+chatId=\{renderedChat\}/);
  // The chat reads `?chat=`, so the screen has its own boundary.
  assert.match(source, /<Suspense fallback=\{<StatuteFallback \/>\}>\s*<StatuteBody \{\.\.\.props\} \/>/);
  // Behind the phone's open chat the statute leaves the screen reader and the
  // tab order (not inert: statute-chat-freeze.test.ts).
  assert.match(source, /aria-hidden=\{pageUnderChat \|\| undefined\}/);
  // One box only: no section menu.
  assert.doesNotMatch(source, /Ask about section/);
  // The case page runs on the same hook.
  assert.match(read('v2', 'features', 'cases', 'detail', 'CaseScreen.tsx'), /\} = useDocumentChat\(subject, signedIn\);/);
});

test('Contents is a button in the bar, not a pill over the text, and stays at every width while the chat is docked', () => {
  // Tester, 20 October 2026 (finding 10): the floating pill covered the text.
  const outline = read('v2', 'features', 'statutes', 'reader', 'StatuteOutline.tsx');
  assert.doesNotMatch(outline, /sticky bottom-6/);
  assert.doesNotMatch(outline, /DockClearanceContext/);
  // The button opens design A, the one Contents (Stay, 23 October 2026: "Let's
  // see A push that"): no left sheet, no ?contents= switch, no B or C.
  assert.doesNotMatch(outline, /StatuteContentsSheet|<Sheet /);
  const document = read('v2', 'features', 'statutes', 'reader', 'StatuteDocument.tsx');
  assert.match(document, /\{showContents \? \(\s*<StatuteContents\s+outline=\{railOutline\}/);
  assert.doesNotMatch(document, /contentsVariant|useSearchParams|StatuteContentsDesign|contents-variants/);
  assert.ok(!existsSync(join(process.cwd(), 'v2', 'features', 'statutes', 'reader', 'contents-variants')), 'the prototype folder is gone');
  assert.match(document, /action: \{ id: CONTENTS_ACTION_ID, label: 'Contents', icon: TableOfContents, onSelect: openContents \},\s*wide: chatDocked,/);
  // Only once the document itself is drawn: the sheet the button opens exists then.
  assert.match(document, /showContents && documentShown/);
  assert.match(document, /setScreenContext\(\{ pathname, back: null, actions: NO_SCREEN_ACTIONS, crumb, barAction: contentsBar \}\);/);
  assert.match(document, /\{showContents && !chatDocked \? \(\s*<aside/);
  const header = read('v2', 'shell', 'V2Header.tsx');
  assert.match(header, /!barAction\.wide && 'min-\[96rem\]:hidden',/);
  assert.match(header, /aria-label=\{barAction\.action\.label\}/);
  const source = screen();
  assert.doesNotMatch(source, /--v2-ask-dock-h|DockClearance|onRestingHeight/);
  assert.match(source, /chatDocked=\{showDocked\}/);
  assert.doesNotMatch(read('v2', 'features', 'cases', 'detail', 'CaseAsk.tsx'), /onRestingHeight|restingHeightRef/);
});

test('the docked chat animates on both pages: its keyframes load with the panel', () => {
  const panel = read('v2', 'features', 'cases', 'detail', 'CaseChatPanel.tsx');
  assert.match(panel, /import '\.\/case-chat-panel\.css';/);
  const css = read('v2', 'features', 'cases', 'detail', 'case-chat-panel.css');
  assert.match(css, /@keyframes v2-case-chat-open/);
  assert.match(css, /@keyframes v2-case-chat-close/);
  assert.doesNotMatch(read('v2', 'features', 'cases', 'detail', 'case-document.css'), /v2-case-chat-open/);
});
