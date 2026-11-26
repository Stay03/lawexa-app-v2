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
  assert.match(transcript, /\(\{ \.\.\.agent, can_send: false, execution_id: null, stream_url: null \}\)/);
  assert.match(transcript, /<BackgroundJobsProvider conversationId=\{view\.id\} jobs=\{jobs\} readOnly>/);
  // Its own query client, with v2's defaults and no persister.
  assert.match(transcript, /const \[queryClient\] = useState\(\(\) => makeQueryClient\(\)\);/);
  assert.doesNotMatch(transcript, /persister:|deviceCachePersister|V2QueryProvider/);
});

test('every row that can act reads the read-only signal', () => {
  const uses = /const readOnly = useReadOnlyTranscript\(\);/;
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
  assert.equal((read('conversations', 'conversation', 'skill-draft', 'SkillDraftCard.tsx').match(/chat\?\.canSend === false \|\| readOnly\}/g) ?? []).length, 3);
  assert.match(read('userbox', 'MachineChatNotes.tsx'), /enabled: !readOnly/);
  assert.match(read('conversations', 'conversation', 'cards', 'NextQuestionPromptCard.tsx'), /\{readOnly \? null : <NotificationNudge \/>\}/);
  assert.match(read('conversations', 'conversation', 'rows', 'ErrorRow.tsx'), /message\.retryable && !readOnly &&/);
});

test('the chat page never sets it', () => {
  assert.doesNotMatch(read('conversations', 'conversation', 'ConversationScreen.tsx'), /ReadOnlyTranscript/);
  assert.match(read('conversations', 'conversation', 'read-only.tsx'), /createContext\(false\)/);
});
