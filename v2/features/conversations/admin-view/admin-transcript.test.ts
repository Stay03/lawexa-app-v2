import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * The admin conversation view draws another person's chat with the person's own
 * rows (thread 085a980c). Pressed there, a row that acts would act as the staff
 * member or on the person's data (review of 7ed967c8). These pin the guard.
 */
const read = (...parts: string[]) => readFileSync(join(process.cwd(), 'v2', 'features', ...parts), 'utf8');

test('the admin transcript is read-only, follows no live turn, and keeps nothing on the device', () => {
  const transcript = read('conversations', 'admin-view', 'AdminTranscript.tsx');
  assert.match(transcript, /<ReadOnlyTranscript>/);
  // The agents as a closed snapshot of the chain (admin-chain.ts): no stream, no Stop, no typing into them.
  assert.match(transcript, /const chain = useMemo\(\(\) => adminChainSnapshot\(agentConversations\), \[agentConversations\]\);/);
  assert.match(transcript, /<AgentChainProvider conversationId=\{view\.id\} chain=\{chain\}>/);
  // The jobs show without Cancel: each label asks useCanAct, which ReadOnlyTranscript makes false (can-act.test.ts).
  assert.match(transcript, /<BackgroundJobsProvider conversationId=\{view\.id\} jobs=\{jobs\}>/);
  // Its own query client, with v2's defaults and no persister.
  assert.match(transcript, /const \[queryClient\] = useState\(\(\) => makeQueryClient\(\)\);/);
  assert.doesNotMatch(transcript, /persister:|deviceCachePersister|V2QueryProvider/);
});

test('the admin transcript is read in the page from its top: no scroller, no landing, no pill (Stay, 26 November 2026)', () => {
  const transcript = read('conversations', 'admin-view', 'AdminTranscript.tsx');
  assert.match(transcript, /onReply=\{null\}\s*flow\s*\/>/);
  assert.doesNotMatch(transcript, /h-full|flex-1/);
  const list = read('conversations', 'conversation', 'MessageList.tsx');
  // Drawn whole in its first frame, never pinned to the bottom of a tail.
  assert.match(list, /const \[showAll, setShowAll\] = useState\(flow\);/);
  assert.match(list, /const anchorBottom = !flow && openTail\.older\.length > 0;/);
  // Each answer parses whole; the opening scroll to the bottom never runs; no pill.
  assert.match(list, /opened: opened \|\| flow,/);
  assert.match(list, /if \(flow \|\| didInitialScrollRef\.current \|\| messages\.length === 0\) return;/);
  assert.match(list, /\{!flow && \(\s*<div\s*aria-hidden=\{!showPill\}/);
  // The chat page keeps all of it: it never passes `flow`.
  assert.doesNotMatch(read('conversations', 'conversation', 'ConversationScreen.tsx'), /^\s+flow(=\{[^}]*\})?\s*\/?>?\s*$/m);
});

test('every row that can act asks useCanAct (the read-only signal is part of it)', () => {
  const uses = /const canAct = useCanAct\(\);/;
  const actors: string[][] = [
    ['conversations', 'conversation', 'skill-draft', 'SkillDraftCard.tsx'],
    ['conversations', 'conversation', 'cards', 'NextQuestionPromptCard.tsx'],
    ['conversations', 'conversation', 'cards', 'DeepResearchPromptCard.tsx'],
    ['conversations', 'conversation', 'cards', 'MultiQuestionPlanCard.tsx'],
    ['conversations', 'conversation', 'cards', 'MultiQuestionPromptCard.tsx'],
    ['conversations', 'conversation', 'cards', 'LawyerCard.tsx'],
    ['conversations', 'conversation', 'rows', 'ErrorRow.tsx'],
    ['userbox', 'MachineChatNotes.tsx'],
  ];
  for (const parts of actors) assert.match(read(...parts), uses, parts.join('/'));
  // A skill draft's three choices are not pressable, the machine is not read, and the nudge is not shown.
  assert.equal((read('conversations', 'conversation', 'skill-draft', 'SkillDraftCard.tsx').match(/settle\.isPending \|\| !canAct\}/g) ?? []).length, 3);
  assert.match(read('userbox', 'MachineChatNotes.tsx'), /enabled: canAct/);
  assert.match(read('conversations', 'conversation', 'cards', 'NextQuestionPromptCard.tsx'), /\{canAct \? <NotificationNudge \/> : null\}/);
  assert.match(read('conversations', 'conversation', 'rows', 'ErrorRow.tsx'), /message\.retryable && canAct &&/);
});

test('the chat page never sets it', () => {
  assert.doesNotMatch(read('conversations', 'conversation', 'ConversationScreen.tsx'), /ReadOnlyTranscript/);
  assert.match(read('conversations', 'conversation', 'read-only.tsx'), /createContext\(false\)/);
});
