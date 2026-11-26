import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { apiClient } from '@/lib/api/client';
import { notesQueries } from '@/v2/features/notes/queries';
import type { DraftNoteDocument } from '@/v2/features/notes/types';
import { draftNoteLine, draftNoteState, type DraftNoteState } from '../conversation/draft/draft-note-state';
import { OWNER_DRAFT_NOTES } from '../conversation/draft/draft-notes-source';
import { adminDraftNotesSource } from './admin-draft-notes';
import { ADMIN_AGENT_PANEL } from './admin-agent-panel';
import { adminHeldItems } from './admin-held-items';
import { adminToolResults, withCutResultsLeftOut } from './admin-tool-results';
import { conversationsQueries } from '../queries';
import { agentConversationQueries } from '../conversation/agents/queries';

/*
 * The admin view's draft panel (Stay, thread 085a980c, 26 November 2026: "Is it like for like as user side?" and
 * "1 and make sure other stuff are like for like"): the owner's draft panel, read only, on the owner's note, read
 * through the admin routes that record no view and change nothing (Backend 7b74631e and the note reads after it).
 * TEST DATA.
 */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8');
const CHAT = '00000000-0000-4000-8000-00000000d1a7';

async function requested(run: () => Promise<unknown>): Promise<string[]> {
  const urls: string[] = [];
  const original = apiClient.get;
  apiClient.get = (async (url: string, config?: { params?: Record<string, unknown> }) => {
    urls.push(config?.params ? `${url}?${new URLSearchParams(config.params as Record<string, string>).toString()}` : url);
    return { data: { success: true, data: {} } };
  }) as typeof apiClient.get;
  try {
    await run();
  } finally {
    apiClient.get = original;
  }
  return urls;
}

test('the admin source reads the admin routes, under the owner’s query keys, and is read only', async () => {
  const source = adminDraftNotesSource(CHAT);
  assert.equal(source.conversationId, CHAT);
  assert.equal(source.readOnly, true);
  assert.equal(OWNER_DRAFT_NOTES.readOnly, false);
  assert.equal(OWNER_DRAFT_NOTES.conversationId, null);

  const list = source.draftNotes({ conversationId: CHAT, viewerId: 5 });
  const note = source.draftNoteOpen({ id: 41, viewerId: 5 });
  const history = source.revisions({ id: 41, page: 2 });
  const one = source.revision({ id: 41, revision: 3 });
  // The owner's keys (the admin view has its own query client), so every reader of the list shares one read.
  assert.deepEqual(list.queryKey, notesQueries.draftNotes({ conversationId: CHAT, viewerId: 5 }).queryKey);
  assert.deepEqual(note.queryKey, notesQueries.draftNoteOpen({ id: 41, viewerId: 5 }).queryKey);
  assert.deepEqual(history.queryKey, notesQueries.revisions({ id: 41, page: 2 }).queryKey);
  assert.deepEqual(one.queryKey, notesQueries.revision({ id: 41, revision: 3 }).queryKey);

  const urls = await requested(async () => {
    const call = (options: { queryFn?: unknown }) => (options.queryFn as () => Promise<unknown>)();
    await call(list);
    await call(note);
    await call(history);
    await call(one);
  });
  assert.deepEqual(urls, [
    `/admin/conversations/${CHAT}/draft-notes`,
    `/admin/conversations/${CHAT}/draft-notes/41`,
    `/admin/conversations/${CHAT}/draft-notes/41/revisions?page=2`,
    `/admin/conversations/${CHAT}/draft-notes/41/revisions/3`,
  ]);
  // Never the owner's note open, which would count a view under the staff member.
  assert.ok(urls.every((url) => !url.startsWith('/notes/')));
});

const doc = (patch: Partial<DraftNoteDocument> = {}): DraftNoteDocument => ({
  key: 'tenancy-notice',
  title: 'TEST DATA Notice to quit',
  ordinals: [0],
  latest_ordinal: 0,
  lawexa_version: 1,
  message_id: 7,
  note_version: 1,
  edited: false,
  can_edit: false,
  note: { id: 41, slug: 'test-data-notice', title: 'TEST DATA Notice to quit', updated_at: '2026-11-26T10:00:00Z' },
  note_missing: null,
  ...patch,
});
const stateOf = (document: DraftNoteDocument, ordinal = 0): DraftNoteState =>
  draftNoteState({ status: 'success', notes: true, documents: [document] }, { ordinal, key: document.key, latestOrdinal: 0 });

test('staff read the owner’s note read only, with lines about the owner, never "you"', () => {
  const asRead = stateOf(doc());
  assert.equal(asRead.kind, 'read-only');
  assert.equal(draftNoteLine(asRead, 0, 'staff'), 'The owner’s note, as Lawexa wrote it. Read only here.');
  assert.equal(
    draftNoteLine(stateOf(doc({ edited: true })), 0, 'staff'),
    'The owner’s note, with their edits. Lawexa works from this text. Read only here.',
  );
  // A note behind Lawexa's newest version: the admin read moves nothing, so it shows as the owner's next open will.
  const behind = stateOf(doc({ lawexa_version: 2, note_version: 1 }));
  assert.equal(behind.kind, 'catching-up');
  assert.match(draftNoteLine(behind, 0, 'staff') ?? '', /^The owner hasn’t opened this version yet\./);
  assert.equal(
    draftNoteLine(stateOf(doc({ note: null, note_missing: 'not_made_yet' })), 0, 'staff'),
    'Not saved as a note yet: the owner’s next open saves it. It shows as Lawexa wrote it.',
  );
  for (const reason of ['deleted', 'limit', 'moved', 'hidden', 'not_made_yet'] as const) {
    const line = draftNoteLine(stateOf(doc({ note: null, note_missing: reason })), 0, 'staff') ?? '';
    assert.match(line, /owner|chat|note/, reason);
    assert.doesNotMatch(line, /\b[Yy]ou(r)?\b/, reason);
  }
  // The owner's own lines are unchanged.
  assert.equal(draftNoteLine(asRead), 'You can read this draft. Only the Space’s editors can change it.');
});

test('the admin view hosts the owner’s draft and file panels beside its column, and waits for nothing', () => {
  const panel = read('AdminSidePanel.tsx');
  assert.match(panel, /<DraftNotesSourceProvider value=\{source\}>/);
  assert.match(panel, /const source = useMemo\(\(\) => adminDraftNotesSource\(conversationId\), \[conversationId\]\);/);
  assert.match(panel, /frame="card"/);
  assert.match(panel, /case 'draft':\s*return <DraftPanel /);
  assert.match(panel, /case 'file':\s*return <FilePanel /);
  const transcript = read('AdminTranscript.tsx');
  assert.match(transcript, /<AdminSidePanel\s+conversationId=\{view\.id\}/);
  const screen = readFileSync(join(here, '..', '..', '..', '..', 'components', 'admin', 'conversations', 'AdminConversationScreen.tsx'), 'utf8');
  assert.match(screen, /ref=\{setPanelHost\}/);
  assert.match(screen, /panelShown && 'xl:sticky xl:top-0 xl:h-\[var\(--admin-side-panel-h,100dvh\)\]/);
  // No polling and no catching-up Try again for staff: the admin read never moves a note forward.
  const hooks = read('..', 'conversation', 'draft', 'use-draft-notes.ts');
  assert.match(hooks, /if \(!data \|\| source\.readOnly\) return false;/);
  const editor = read('..', 'conversation', 'draft', 'DraftEditor.tsx');
  assert.match(editor, /draftNoteLine\(state, waitedMs, staff \? 'staff' : 'owner'\)/);
  // The note is opened through the source, never the owner's by-id route directly.
  assert.match(editor, /useQuery\(source\.draftNoteOpen\(\{ id: props\.noteId, viewerId \}\)\)/);
  assert.doesNotMatch(editor, /notesQueries\.draftNoteOpen/);
  // Staff: downloads made from the text on screen (not the note's own export), no Open note or Save to folder,
  // and the owner's version history to read, with no restore.
  assert.match(editor, /const note: DraftNoteRef \| null = record && !staff \? \{ id: record\.id, slug: record\.slug \} : null;/);
  assert.match(editor, /const onHistory = savesToNote \|\| \(staff && record\) \? \(\) => setHistoryOpen\(true\) : null;/);
  const bar = read('..', 'conversation', 'draft', 'DraftSaveBar.tsx');
  assert.match(bar, /<DownloadMenu downloads=\{tools\.downloads\} onHistory=\{onHistory\} \/>/);
  // The owner's history names the owner (the view is drawn as the owner, so "You" would mean the staff member).
  const history = read('..', 'conversation', 'draft', 'DraftHistoryDialog.tsx');
  assert.match(history, /const words = staff \? STAFF_HISTORY_WORDS : HISTORY_WORDS\[of\];/);
  assert.match(history, /const userUuid = staff \? null : sessionUuid;/);
  assert.match(history, /description: 'Every version Lawexa wrote, and the owner’s text from just before each new one\. Read only here\.'/);
});

test('agents open in the admin panel as a snapshot, on the admin routes; the machine never opens there', async () => {
  const transcript = ADMIN_AGENT_PANEL.transcript({ conversationId: CHAT, viewerId: 5 });
  const agents = ADMIN_AGENT_PANEL.agents({ parentId: CHAT, viewerId: 5 });
  assert.deepEqual(transcript.queryKey, conversationsQueries.detail({ conversationId: CHAT, viewerId: 5 }).queryKey);
  assert.deepEqual(agents.queryKey, agentConversationQueries.of({ parentId: CHAT, viewerId: 5 }).queryKey);
  assert.equal(agents.refetchInterval, false);
  assert.equal(transcript.refetchOnWindowFocus, false);

  const urls: string[] = [];
  const original = apiClient.get;
  apiClient.get = (async (url: string) => {
    urls.push(url);
    const running = { id: 'a1', status: 'running', execution_id: 'exec-1', stream_url: '/api/chat/stream/exec-1', can_send: true };
    return { data: { success: true, data: url.endsWith('/agent-conversations') ? { agent_conversations: [running] } : { messages: [] } } };
  }) as typeof apiClient.get;
  try {
    await (transcript.queryFn as () => Promise<unknown>)();
    const list = (await (agents.queryFn as () => Promise<unknown>)()) as Array<Record<string, unknown>>;
    // Nobody here types into an agent, stops it, or follows its turn.
    assert.deepEqual(
      { can_send: list[0].can_send, execution_id: list[0].execution_id, stream_url: list[0].stream_url, status: list[0].status },
      { can_send: false, execution_id: null, stream_url: null, status: 'running' },
    );
  } finally {
    apiClient.get = original;
  }
  assert.deepEqual(urls, [`/admin/conversations/${CHAT}`, `/admin/conversations/${CHAT}/agent-conversations`]);

  const panel = read('AdminSidePanel.tsx');
  assert.match(panel, /const ADMIN_KINDS: ReadonlySet<SidePanelKind> = new Set<SidePanelKind>\(\['draft', 'file', 'agent'\]\);/);
  assert.match(panel, /kinds=\{ADMIN_KINDS\}/);
  assert.match(panel, /case 'agent':\s*return <AgentConversationPanel /);
  // Every button that opens the machine asks the panel first, so none draws in the admin view.
  const userbox = (file: string) => readFileSync(join(here, '..', '..', 'userbox', file), 'utf8');
  assert.match(userbox('OpenMachineButton.tsx'), /if \(!panel\?\.shows\('machine'\)/);
  assert.match(userbox('MachineChatNotes.tsx'), /\{panel\?\.shows\('machine'\) \? \(/);
  const context = read('..', 'conversation', 'side-panel', 'SidePanelContext.tsx');
  assert.match(context, /const shows = useCallback\(\(kind: SidePanelKind\) => \(kinds \? kinds\.has\(kind\) : true\), \[kinds\]\);/);
});

test('what the chat holds is read through admin routes that answer only for that chat (Backend cd4eaeef)', async () => {
  const held = adminHeldItems(CHAT);
  const results = adminToolResults(CHAT);
  const urls: string[] = [];
  const original = apiClient.get;
  apiClient.get = (async (url: string) => {
    urls.push(url);
    return { data: url.includes('/quiz-jobs/') ? { data: { job: { status: 'done' } } } : { success: true, data: {} } };
  }) as typeof apiClient.get;
  try {
    assert.deepEqual(await held.quizJob('job-1'), { status: 'done' });
    await held.recording('rec-1');
    await held.skillDraft('draft-1');
    await results.read(CHAT, 9);
  } finally {
    apiClient.get = original;
  }
  assert.deepEqual(urls, [
    `/admin/conversations/${CHAT}/quiz-jobs/job-1`,
    `/admin/conversations/${CHAT}/recordings/rec-1`,
    `/admin/conversations/${CHAT}/skill-drafts/draft-1`,
    `/admin/conversations/${CHAT}/messages/9/result`,
  ]);
  assert.equal(results.conversationId, CHAT);
  // The three cards and the steps read through their sources, never the owner's routes directly.
  const at = (...parts: string[]) => readFileSync(join(here, '..', ...parts), 'utf8');
  assert.match(at('conversation', 'tools', 'use-quiz-job.ts'), /queryFn: \(\) => source\.quizJob\(uuid\),/);
  assert.match(at('conversation', 'skill-draft', 'SkillDraftCard.tsx'), /queryFn: \(\) => held\.skillDraft\(card\.draft\),/);
  assert.match(readFileSync(join(here, '..', '..', 'recording', 'RecordingCard.tsx'), 'utf8'), /await held\.recording\(recording\.recording_uuid\)/);
  assert.match(at('conversation', 'tools', 'use-tool-result.ts'), /await source\.read\(conversationId as string/);
  const transcript = read('AdminTranscript.tsx');
  assert.match(transcript, /<ToolResultSourceProvider value=\{toolResults\}>/);
  assert.match(transcript, /<HeldItemsSourceProvider value=\{heldItems\}>/);
});

test('a result cut at 200 kB is fetched whole when its step opens, as the owner’s chat does a lazy one', () => {
  const cut = { id: 9, conversation_id: CHAT, role: 'tool', content: '{"cut', metadata: { tool_call_id: 'c1', result_truncated: true }, created_at: '2026-11-26T10:00:00Z' };
  const whole = { ...cut, id: 10, content: '{"whole":true}', metadata: { tool_call_id: 'c2' } };
  const [a, b] = withCutResultsLeftOut([cut, whole] as never) as unknown as Array<Record<string, unknown>>;
  assert.equal(a.content, '');
  assert.equal(a.has_result, true);
  assert.equal(b.content, '{"whole":true}');
  assert.equal(b.has_result, undefined);
});
