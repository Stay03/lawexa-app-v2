import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/*
 * One rule for every control in the chat's rows and cards that writes (card
 * e4b12be8, thread 085a980c, 26 November 2026): it asks `useCanAct()`
 * (read-only.tsx), which is false in the admin view, outside a chat screen,
 * and for a reader who may not send. A control that writes to the reader's
 * OWN account instead ("Save as my template") asks the narrower
 * `useCanActForSelf()`, false only in the admin view (Techlead, 26 November
 * 2026). A row that writes without asking either fails here.
 *
 * "Writes" is read from the source and errs towards writing: a mutation, a
 * mutations module, an apiClient post/put/patch/delete, a follow-up turn
 * (`sendMessage`), or any `somethingApi.method(` call whose method is not a
 * read (get…, list…, preview…, search…, show…, fetch…, download…, the
 * document export, or the agent chain's read `chain`). A new API call counts as a write until it is named here
 * as a read.
 */

const ROOT = process.cwd();
const CONVERSATION = join(ROOT, 'v2', 'features', 'conversations', 'conversation');
// The transcript's rows and cards, and the panels they open beside the chat.
const ROW_DIRS = ['rows', 'cards', 'skill-draft', 'agents', 'background-jobs', 'question-card', 'tools', 'markdown', 'draft', 'files', 'reasoning', 'side-panel'];
const EXTRA = [join(ROOT, 'v2', 'features', 'userbox', 'MachineChatNotes.tsx')];
const READ_METHOD = /^(get|list|preview|search|show|fetch|download|messageBlockDocx|chain$)/;
const NOT_AN_API = new Set(['emblaApi']);

/**
 * Files that write without asking, each with why the rule does not belong in
 * it. Every entry names where the rule is asked instead; that place is
 * pinned below.
 */
const ASKED_ELSEWHERE: Record<string, string> = {
  'cards/ConnectionRequestDialog.tsx': 'opened only by LawyerCard, which asks; v1 also opens it',
  'background-jobs/mutations.ts': 'defines the cancel mutation; its one user, background-jobs/context.tsx, asks',
  'draft/DraftHistoryDialog.tsx': "the draft editor's history (side panel, notes reader): not a transcript row, the note's own rights govern",
  // An earlier decision, kept (agent-model.test.ts): an agent's write box and Stop follow the
  // server's can_send for this reader, never a check made here. The admin view sets can_send false.
  'agents/AgentRoster.tsx': "an agent's own Stop follows its server can_send (node.canStop); Lawexa's Stop for all asks useCanAct",
  // The deck's Stop for every agent (chain view): the hook writes, its one caller asks.
  'agents/use-stop-chain.ts': "Lawexa's Stop for every agent; its one caller, LawexaLine in agents/AgentRoster.tsx, asks useCanAct",
  'agents/AgentConversationPanel.tsx': "the write box and its Stop follow the agent's server can_send",
};

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });

function writes(source: string): string[] {
  const found: string[] = [];
  if (/\buseMutation\s*\(/.test(source)) found.push('useMutation');
  if (/from '[^']*mutations'/.test(source)) found.push('a mutations import');
  if (/apiClient\.(post|put|patch|delete)\b/.test(source)) found.push('an apiClient write');
  if (/\.sendMessage\(/.test(source)) found.push('sendMessage');
  for (const call of source.matchAll(/\b([a-z]\w*Api)\.(\w+)\(/g)) {
    if (!NOT_AN_API.has(call[1]) && !READ_METHOD.test(call[2])) found.push(`${call[1]}.${call[2]}`);
  }
  return found;
}

const files = [...ROW_DIRS.flatMap((dir) => walk(join(CONVERSATION, dir))), ...EXTRA];
const key = (file: string) => relative(CONVERSATION, file).split(sep).join('/');

test('every row or card file that writes asks useCanAct() or useCanActForSelf()', () => {
  const missing = files
    .map((file) => ({ file, found: writes(readFileSync(file, 'utf8')) }))
    .filter(({ file, found }) => found.length > 0 && !(key(file) in ASKED_ELSEWHERE))
    .filter(({ file }) => !/\buseCanAct(ForSelf)?\(\)/.test(readFileSync(file, 'utf8')))
    .map(({ file, found }) => `${relative(ROOT, file)} (${found.join(', ')})`);
  assert.deepEqual(missing, [], 'these write without asking useCanAct() or useCanActForSelf()');
});

test('the detector finds the writes it was built on', () => {
  // A guard against the detector rotting into one that finds nothing.
  const read = (path: string) => readFileSync(join(CONVERSATION, path), 'utf8');
  assert.deepEqual(writes(read('skill-draft/SkillDraftCard.tsx')).includes('useMutation'), true);
  assert.deepEqual(writes(read('cards/NextQuestionPromptCard.tsx')), ['sendMessage']);
  assert.deepEqual(writes(read('agents/AgentRoster.tsx')), ['chatApi.cancelStream']);
  assert.deepEqual(writes(read('rows/SentAttachments.tsx')), ['myTemplatesApi.fromFile']);
  assert.deepEqual(writes(readFileSync(EXTRA[0], 'utf8')).includes('userBoxApi.release'), true);
  assert.deepEqual(writes("await notesApi.getNote(1); await chatApi.listConversations(); emblaApi.on('x');"), []);
  assert.deepEqual(writes('await somethingNewApi.archive(1);'), ['somethingNewApi.archive']);
});

test('each file allowed to write without asking still has its asker', () => {
  for (const path of Object.keys(ASKED_ELSEWHERE)) assert.ok(files.some((file) => key(file) === path), `${path} no longer exists: drop it from ASKED_ELSEWHERE`);
  const read = (path: string) => readFileSync(join(CONVERSATION, path), 'utf8');
  // LawyerCard opens the connection dialog only for a reader who may act.
  assert.match(read('cards/LawyerCard.tsx'), /const canAct = useCanAct\(\);/);
  assert.match(read('cards/LawyerCard.tsx'), /\{!canAct \? null : \(/);
  // The agents' controls follow can_send, which the admin view sets false for every agent.
  assert.match(read('agents/AgentConversationPanel.tsx'), /footer=\{entry\?\.can_send \? <AgentComposer /);
  assert.match(read('agents/AgentRoster.tsx'), /\{node\.canStop && node\.executionId \? <StopAgent /);
  // The admin view's chain is a closed snapshot: no agent may be typed into or stopped (admin-chain.ts).
  assert.match(
    readFileSync(join(ROOT, 'v2', 'features', 'conversations', 'admin-view', 'admin-chain.ts'), 'utf8'),
    /execution_id: null,\s*stream_url: null,\s*can_send: false,/,
  );
  // Lawexa's Stop for every agent (use-stop-chain.ts) is offered only where the reader may act.
  assert.match(read('agents/AgentRoster.tsx'), /const canAct = useCanAct\(\);[\s\S]*?const \{ stop, stopping, problem \} = useStopChain\(/);
  assert.match(read('agents/AgentRoster.tsx'), /\{canAct \? \(\s*<button\s+type="button"\s+onClick=\{\(\) => void stop\(\)\}/);
  // The jobs' Cancel is null where the reader may not act.
  assert.match(read('background-jobs/context.tsx'), /cancel: canAct \? value\.cancel : null/);
  // The draft history opens from the editor, never from a transcript row.
  for (const file of files.filter((each) => /\/(rows|cards|skill-draft|question-card|tools|markdown)\//.test(`/${key(each)}`))) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /<DraftHistoryDialog\b/, key(file));
  }
});

test('the rule: false in the admin view, outside a chat, and for a reader who may not send', () => {
  const rule = readFileSync(join(CONVERSATION, 'read-only.tsx'), 'utf8');
  assert.match(rule, /return !readOnly && chat !== null && chat\.canSend;/);
  // The own-account question: false only in the admin view.
  assert.match(rule, /export function useCanActForSelf\(\): boolean \{\s*return !useContext\(ReadOnlyTranscriptContext\);\s*\}/);
  // One way to ask: the old read-only hook is gone, and no row reads canSend for itself.
  assert.doesNotMatch(rule, /export function useReadOnlyTranscript/);
  const leftovers = files.filter((file) => /useReadOnlyTranscript|chat(Context)?\?\.canSend === false|!chatContext\.canSend/.test(readFileSync(file, 'utf8')));
  assert.deepEqual(leftovers.map(key), []);
});

test('only own-account controls ask the narrower question: Save as my template', () => {
  const askers = files.filter((file) => /\buseCanActForSelf\(\)/.test(readFileSync(file, 'utf8'))).map(key);
  assert.deepEqual(askers, ['rows/SentAttachments.tsx']);
  const attachments = readFileSync(join(CONVERSATION, 'rows', 'SentAttachments.tsx'), 'utf8');
  assert.match(attachments, /const canActForSelf = useCanActForSelf\(\);[\s\S]{0,120}if \(!canActForSelf \|\| !chat\?\.conversationId\) return null;/);
  assert.match(attachments, /myTemplatesApi\.fromFile\(document\.file_id, conversationId\)/);
});
