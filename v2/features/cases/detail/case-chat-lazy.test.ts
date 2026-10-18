import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { importGraph } from '@/scripts/test/import-graph';

/* The case page loads the chat's transcript only when the chat opens (speed
 * step 1, 12 October 2026). The composer is the exception and must stay one:
 * on a phone the keyboard rises only for a focus inside the reader's tap, and
 * the full-screen chat grows around the box they tapped
 * (case-chat-phone-screen.test.ts). A composer behind a lazy boundary would
 * not be on the page when the tap lands. */
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');
const detail = (file: string) => strip(read('v2', 'features', 'cases', 'detail', file));
const core = detail('CaseChatCore.tsx');

const caseRoute = importGraph('app/v2/cases/[slug]/page.tsx').files;

test('the case page does not download the transcript or the streaming engine', () => {
  const heavy = caseRoute.filter(
    (file) =>
      file.endsWith('/conversation/ConversationScreen.tsx') ||
      file.endsWith('/conversation/MessageList.tsx') ||
      file.endsWith('/conversations/start-conversation.ts') ||
      file.startsWith('v2/runtime/chat-engine/'),
  );
  assert.deepEqual(heavy, []);
});

test('the composer the reader taps is part of the case page itself', () => {
  assert.ok(caseRoute.includes('v2/features/conversations/conversation/ConversationComposer.tsx'));
  assert.match(core, /import \{\s*ConversationComposer,/);
  for (const file of ['CaseAsk.tsx', 'CaseChatPanel.tsx', 'CaseScreen.tsx', 'use-document-chat.ts']) {
    const source = detail(file);
    // CaseScreen's one lazy import is the ?kbdebug=1 readout (da7be8d), which renders
    // only under that flag and never holds the composer; nothing else may be lazy.
    const lazyTargets = [...source.matchAll(/dynamic\(\s*\(\) => import\('([^']+)'\)/g)].map((m) => m[1]);
    const allowed = file === 'CaseScreen.tsx' ? ['./KeyboardDebugReadout'] : [];
    assert.deepEqual(lazyTargets, allowed, `${file} loads nothing lazily but what is allowed`);
    assert.doesNotMatch(source, /\blazy\(/, `${file} uses no React.lazy`);
    // The screen hosts the chat through `useDocumentChat`, which carries the
    // core; every other file imports it itself.
    const core = file === 'CaseScreen.tsx' ? /from '\.\/use-document-chat'/ : /from '\.\/CaseChatCore'/;
    assert.match(source, core, `${file} imports the chat core statically`);
  }
});

test('the transcript is a client-only dynamic import inside the middle, preloaded on open', () => {
  assert.match(core, /import\('@\/v2\/features\/conversations\/conversation\/ConversationScreen'\)/);
  assert.match(core, /const ConversationScreen = dynamic\(/);
  assert.match(core, /ssr: false, loading: CaseChatTranscriptFallback/);
  assert.match(core, /useEffect\(\(\) => \{\s*preloadCaseChat\(\);\s*\}, \[\]\);/);
  assert.match(core, /<RouteSkeletonMark \/>/);
});

test('the create flow loads with the transcript, and the view-only pill without it', () => {
  assert.match(core, /import\('@\/v2\/features\/conversations\/start-conversation'\)/);
  assert.match(core, /const \{ startConversation \} = await loadStartConversation\(\);/);
  assert.match(core, /import \{ ViewOnlyPill \} from '@\/v2\/features\/conversations\/conversation\/ViewOnlyPill';/);
});
