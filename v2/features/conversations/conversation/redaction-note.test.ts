import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ApiMessage, ChatMessage } from '@/types/chat';
import { isRedactionSummary } from '@/lib/utils/redaction-summary';
import { transformApiMessages } from '@/lib/utils/transform-api-messages';
import { adoptServerFields } from '@/v2/runtime/chat-engine/server-fields';
import type { EngineMessage } from '@/v2/runtime/chat-engine';
import { redactionNote } from './rows/redaction-note-model';

/* Option D (Stay, 22 October 2026): under a question in a redacted chat, "Sent
 * as redacted · N details hidden", which opens to what was hidden, by kind.
 * The bubble already shows the redacted text, so the line never repeats it. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test('the line says what redaction did, in every case the contract allows', () => {
  // A question from before the server sent a summary: no count, nothing to open.
  assert.deepEqual(redactionNote(undefined), { line: 'Sent as redacted', breakdown: null });
  assert.deepEqual(redactionNote({ details_hidden: 0, places_replaced: 0, by_type: {} }), {
    line: 'Sent as redacted · nothing personal found',
    breakdown: null,
  });
  assert.deepEqual(redactionNote({ details_hidden: 1, places_replaced: 2, by_type: { PERSON: 1 } }), {
    line: 'Sent as redacted · 1 detail hidden',
    breakdown: '1 person',
  });
  // People first, then the backend's order; plurals per kind.
  assert.deepEqual(
    redactionNote({ details_hidden: 7, places_replaced: 11, by_type: { ADDRESS: 2, PERSON: 4, PHONE: 1 } }),
    { line: 'Sent as redacted · 7 details hidden', breakdown: '4 people, 2 addresses, 1 phone number' },
  );
  // A kind the app does not know is counted as other details, so the sum still holds.
  assert.equal(
    redactionNote({ details_hidden: 3, places_replaced: 3, by_type: { NIN: 1, VEHICLE_PLATE: 2 } }).breakdown,
    '1 NIN, 2 other details',
  );
});

test('only a well-formed summary is read; anything else is treated as absent', () => {
  assert.equal(isRedactionSummary({ details_hidden: 2, places_replaced: 3, by_type: { PERSON: 2 } }), true);
  assert.equal(isRedactionSummary({ details_hidden: 0, places_replaced: 0, by_type: {} }), true);
  assert.equal(isRedactionSummary(undefined), false);
  assert.equal(isRedactionSummary(null), false);
  assert.equal(isRedactionSummary({ details_hidden: '2', places_replaced: 3, by_type: {} }), false);
  assert.equal(isRedactionSummary({ details_hidden: -1, places_replaced: 0, by_type: {} }), false);
  assert.equal(isRedactionSummary({ details_hidden: 1, places_replaced: 1, by_type: [] }), false);
  assert.equal(isRedactionSummary({ details_hidden: 1, places_replaced: 1, by_type: { PERSON: 1.5 } }), false);
});

test('a reload keeps the summary: the history carries it on the question', () => {
  const summary = { details_hidden: 2, places_replaced: 4, by_type: { PERSON: 2 } };
  const api = (metadata: ApiMessage['metadata']): ApiMessage =>
    ({
      id: 7,
      conversation_id: 'c',
      agent_id: null,
      role: 'user',
      content: 'My landlord [PERSON_1] served [PERSON_2]',
      metadata,
      created_at: '2026-10-22T01:00:00Z',
    }) as ApiMessage;
  const [withSummary] = transformApiMessages([api({ redaction: summary })]) as ChatMessage[];
  assert.deepEqual(withSummary.redaction, summary);
  const [without] = transformApiMessages([api({})]) as ChatMessage[];
  assert.equal('redaction' in without, false);
  const [malformed] = transformApiMessages([api({ redaction: { details_hidden: 'x' } as never })]) as ChatMessage[];
  assert.equal('redaction' in malformed, false);
});

test('the row this client drew takes the summary from the server copy only when it has none', () => {
  const summary = { details_hidden: 1, places_replaced: 1, by_type: { EMAIL: 1 } };
  const local = { id: 'local-1', role: 'user', content: 'x', timestamp: new Date(0), savedId: 7 } as EngineMessage;
  const server = { id: 'msg_7', role: 'user', content: 'x', timestamp: new Date(0), redaction: summary } as ChatMessage;
  const [adopted] = adoptServerFields([local], [server]) as (EngineMessage & ChatMessage)[];
  assert.deepEqual(adopted.redaction, summary);
  const own = { ...local, redaction: { details_hidden: 0, places_replaced: 0, by_type: {} } } as EngineMessage;
  const rows = [own];
  assert.equal(adoptServerFields(rows, [server]), rows);
});

test('the send stores the summary, and every question in a redacted chat shows its line', () => {
  const engine = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  assert.match(engine, /const redaction = response\.data\.redaction;\s*if \(isRedactedTurnN && isRedactionSummary\(redaction\)\) \{/);
  const row = read('v2', 'features', 'conversations', 'conversation', 'rows', 'UserMessageRow.tsx');
  assert.match(row, /const showsRedaction = redacted \|\| message\.redaction !== undefined;/);
  assert.equal((row.match(/<RedactionNote summary=\{message\.redaction\}/g) ?? []).length, 2);
  assert.match(read('v2', 'features', 'conversations', 'conversation', 'ConversationScreen.tsx'), /redacted=\{controller\.isRedacted\}/);
  // The opened panel never claims the message was not sent: the server reads it, the AI does not.
  const note = read('v2', 'features', 'conversations', 'conversation', 'rows', 'RedactionNote.tsx');
  assert.match(note, /Hidden before the AI read it: \{note\.breakdown\}\./);
  assert.doesNotMatch(note, /was not sent/);
});
