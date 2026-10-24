import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { importGraph } from '@/scripts/test/import-graph';
import { splitDrafts } from '@/v2/features/conversations/conversation/draft/draft-blocks';
import { parseSidePanelValue } from '@/v2/features/conversations/conversation/side-panel/side-panel-value';

/* The draft editor on the case page (Stay, 24 October 2026, option 1: "Move to
 * the right"). A draft in the case chat's answer is the main chat's card; Open
 * docks a floating chat, and the editor covers the reading left of it, on a
 * computer. TEST DATA throughout. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');
const detail = (file: string) => strip(read('v2', 'features', 'cases', 'detail', file));
const conversation = (...parts: string[]) => strip(read('v2', 'features', 'conversations', 'conversation', ...parts));

const screen = detail('CaseScreen.tsx');
const chat = detail('use-document-chat.ts');
const move = detail('case-draft-move.ts');
const embedded = conversation('ConversationScreen.tsx');
const frame = conversation('side-panel', 'ChatSidePanel.tsx');

test('a case chat answer splits its draft into the main chat’s card', () => {
  const answer = [
    'TEST DATA. Here is a letter before action.',
    '<draft title="TEST DATA Letter before action" font="Times New Roman" size="14">',
    '# Letter before action',
    '',
    'Dear Sir or Madam,',
    '</draft>',
    'Tell me the landlord’s name.',
  ].join('\n');
  const parts = splitDrafts(answer);
  assert.deepEqual(parts.map((part) => part.kind), ['text', 'draft', 'text']);
  // The embedded chat has the panel when a page hosts it, so ChatContent draws
  // DraftCard (Open / Showing), not the plain box a card without a panel shows.
  assert.match(
    embedded,
    /panelHost \? \(\s*<SidePanelValueProvider url=\{panelHost\.url\} offsets=\{offsets\} space=\{controller\.space\} frame="card">\s*\{transcript\}/,
  );
  assert.match(screen, /<SidePanelHostProvider value=\{draftHost\}>/);
  // The editor is the main chat's: the same slot, panel and editor, in the
  // chat's own context, drawn where the page keeps room for it.
  assert.match(
    embedded,
    /panelHost\.element && !isLoadingHistory\s*\? createPortal\(<SidePanelSlot messages=\{messages\} streamingText=\{streamingText\} \/>, panelHost\.element\)/,
  );
});

test('the address is the main chat’s ?side=draft:N, owned by the case page, so Back closes it', () => {
  assert.deepEqual(parseSidePanelValue('draft:0'), { kind: 'draft', ordinal: 0 });
  const context = conversation('side-panel', 'SidePanelContext.tsx');
  assert.match(context, /export function useSidePanelUrl\(\): SidePanelUrlState \{\s*const overlay = useUrlOverlay\(SIDE_PANEL_PARAM\);/);
  // One owner per param: the route's provider, or the host page; never both.
  assert.match(context, /const url = useSidePanelUrl\(\);\s*return \(\s*<SidePanelValueProvider url=\{url\}[^>]*frame="beside">/);
  assert.match(screen, /const draftUrl = useSidePanelUrl\(\);\s*const draftOpen = draftUrl\.target\?\.kind === 'draft';/);
  assert.equal(embedded.match(/useSidePanelUrl\(/g), null);
  // The editor is drawn from the address alone, so Back (popstate) takes it away.
  assert.match(screen, /const editorShown = signedIn && desktop && draftOpen && showDocked && renderedChat !== 'new';/);
});

test('opening a draft docks a floating chat first, and the chat stays docked after', () => {
  assert.match(
    screen,
    /if \(desktop && !showDocked && target\.kind === 'draft'\) \{\s*moveFrom\.current = measureFloatingChat\(columnRef\.current\);\s*setDockedPref\(true\);\s*\}\s*showDraft\(target\);/,
  );
  assert.match(screen, /const draftHostUrl = useMemo<SidePanelUrlState>\(\(\) => \(\{ \.\.\.draftUrl, open: openDraft \}\), \[draftUrl, openDraft\]\);/);
  // A ?side=draft link opened straight holds the chat docked too.
  assert.match(screen, /useDocumentChat\(subject, signedIn, \{ holdDocked: draftOpen \}\)/);
  assert.match(chat, /const docked = dockedPref \|\| holdDocked;/);
  // The move plays before the docked layout's first paint, from where the card stood.
  assert.match(screen, /useLayoutEffect\(\(\) => \{\s*const from = moveFrom\.current;\s*if \(!showDocked \|\| !from\) return;\s*moveFrom\.current = null;\s*playMoveToDock\(from, columnRef\.current\);\s*\}, \[showDocked\]\);/);
  assert.match(move, /for \(const animation of rail\.getAnimations\(\)\) animation\.cancel\(\);/);
  assert.match(move, /rail\.animate\(\[\{ overflowX: 'visible' \}, \{ overflowX: 'visible' \}\], timing\);/);
  assert.match(move, /transform: `translateX\(\$\{from\.card\.left - to\.left\}px\)`,\s*clipPath: `inset\(\$\{top\}px 0 0 0 round 1rem\)`,/);
  // Reduced motion: nothing is measured, so nothing plays.
  assert.match(move, /if \(window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches\) return null;/);
  // The marks the move finds its elements by.
  assert.match(detail('CaseAsk.tsx'), /data-v2-case-ask-card=""/);
  const docked = detail('CaseChatPanel.tsx');
  assert.match(docked, /data-v2-case-docked=""/);
  assert.match(docked, /data-v2-case-docked-card=""/);
});

test('the editor covers the reading column, 12px clear of the sidebar and the chat, and the reading goes inert', () => {
  assert.match(
    screen,
    /\{editorShown \? \(\s*<div className="pointer-events-none absolute inset-y-0 left-0 right-\[27\.5rem\] z-20 pl-3">\s*<div ref=\{setDraftBox\} className="pointer-events-auto sticky top-3 flex h-\[calc\(100dvh-5rem\)\]" \/>/,
  );
  // The rail it stops short of: the 26rem card and its 0.75rem right gap.
  assert.match(detail('CaseChatPanel.tsx'), /'w-\[calc\(26rem\+0\.75rem\)\] shrink-0 overflow-x-clip'/);
  assert.match(screen, /<div className="relative flex min-h-full w-full overflow-x-clip">/);
  assert.match(screen, /const pageUnder = pageUnderChat \|\| editorShown;/);
  assert.match(screen, /<div className=\{arrive\} inert=\{pageUnder\}>/);
  // The section map is not drawn while the chat is docked, which the editor holds.
  assert.match(screen, /\{outline\.length >= 4 && !showDocked \? \(/);
  // The card: the box's whole size, the chat card's shape, wiped in from the left.
  assert.match(frame, /const card = panel\?\.frame === 'card';/);
  assert.match(frame, /'xl:static xl:z-auto xl:h-full xl:w-full xl:rounded-2xl xl:border xl:border-border /);
  assert.match(frame, /'xl:data-\[state=open\]:motion-safe:animate-\[v2-side-panel-wipe-in_520ms_/);
  assert.match(frame, /'xl:data-\[state=closed\]:motion-safe:animate-\[v2-side-panel-wipe-out_200ms_ease-in_forwards\]'/);
  const css = read('v2', 'features', 'conversations', 'conversation', 'side-panel', 'side-panel.css');
  assert.match(css, /@keyframes v2-side-panel-wipe-in \{\s*from \{\s*clip-path: inset\(0 100% 0 0 round 1rem\);/);
  // No width is written for a shell dock the case page does not have.
  assert.match(frame, /if \(!frame \|\| card\) return;/);
});

test('close and Back give the case back; closing or leaving the chat takes its draft with it', () => {
  // × and Escape play the exit, then walk the entry back (ChatSidePanel's own path).
  assert.match(frame, /if \(closing && event\.target === event\.currentTarget\) panel\.finishClose\(\);/);
  assert.match(screen, /const closeChat = useCallback\(\(\) => \{\s*dropDraft\(\);\s*closeChatOnly\(\);\s*\}, \[dropDraft, closeChatOnly\]\);/);
  assert.match(screen, /onOpenChat=\{switchChatAway\}/);
  assert.match(screen, /onSwitchChat=\{switchChatAway\}/);
  // Floating the chat closes the editor first; the chat floats once it has gone.
  assert.match(screen, /onFloat=\{floatChat\}/);
  assert.match(screen, /if \(draftOpen\) \{\s*if \(window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches\) finishDraft\(\);\s*else closeDraft\(\);\s*\}\s*setDockedPref\(false\);/);
});

test('side by side on a computer only: below xl the draft is the existing sheet over the screen', () => {
  assert.match(screen, /element: desktop \? draftBox : phone \? document\.body : null/);
  assert.match(chat, /const desktop = isDesktopPanel === true;/);
  // Every card rule is an xl rule; below xl the frame is the sheet it always was.
  const raw = read('v2', 'features', 'conversations', 'conversation', 'side-panel', 'ChatSidePanel.tsx');
  const cardRules = raw.slice(raw.indexOf('? // xl and up, the card'), raw.indexOf(': // xl and up: the panel beside'));
  assert.match(cardRules, /xl:rounded-2xl/);
  for (const rule of cardRules.match(/'[^']+'/g) ?? []) {
    for (const utility of rule.slice(1, -1).split(/\s+/)) assert.ok(utility.startsWith('xl:'), utility);
  }
  assert.match(frame, /'fixed inset-x-0 bottom-0 z-50 flex h-\[calc\(100dvh-var\(--keyboard-inset,0px\)-2\.5rem\)\]/);
  // A draft that finishes while the reader types in the case chat's box does not open over it.
  assert.match(conversation('draft', 'DraftCard.tsx'), /'\[data-v2-chat-dock\] textarea, \[data-v2-case-chat-composer\] textarea'/);
  assert.match(detail('CaseChatCore.tsx'), /<div data-v2-case-chat-composer="" className="shrink-0">/);
});

test('the case page still downloads no panel or editor before the chat opens', () => {
  const route = importGraph('app/v2/cases/[slug]/page.tsx').files;
  const heavy = route.filter(
    (file) =>
      file.includes('/conversation/draft/') ||
      file.endsWith('/side-panel/ChatSidePanel.tsx') ||
      file.endsWith('/side-panel/SidePanelSlot.tsx'),
  );
  assert.deepEqual(heavy, []);
  assert.ok(route.includes('v2/features/conversations/conversation/side-panel/side-panel-host.tsx'));
});

test('the statute page hosts no panel, so its chat shows a draft’s text in place', () => {
  const statute = strip(read('v2', 'features', 'statutes', 'reader', 'StatuteScreen.tsx'));
  assert.doesNotMatch(statute, /SidePanelHostProvider/);
  assert.match(conversation('draft', 'DraftCard.tsx'), /if \(!panel\) \{\s*return \(\s*<div className="rounded-2xl border border-border bg-card px-4 py-3">/);
});
