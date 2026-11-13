import { readSkillDraftCard } from '@/lib/utils/skill-draft';
import type { ChatMessage } from '@/types/chat';
import type { EngineMessage } from './types';

/**
 * The skill draft a turn ended with, from its `completed` event's
 * `skill_draft` (the skills tool, thread 2b436b4f), onto the answer drawn from
 * the stream, named by its saved id. The server sends one only for a turn
 * that answered. A newer draft sets the chat's older unsaved ones aside, as
 * the server does ("dismissed"). No card on the event, or one this app cannot
 * read: nothing changes, and the next read of the chat brings it
 * (`adoptServerFields`). Returns the same array when nothing changed.
 */
export function withSkillDraftFromCompleted(
  rows: readonly EngineMessage[],
  answerSavedId: number | null,
  skillDraft: unknown,
): EngineMessage[] {
  const card = readSkillDraftCard(skillDraft);
  if (!card || answerSavedId === null) return rows as EngineMessage[];
  const index = rows.findIndex((row) => row.role === 'assistant' && row.savedId === answerSavedId);
  if (index === -1) return rows as EngineMessage[];
  return rows.map((row, at) => {
    if (at === index) return { ...row, skillDraft: card } as EngineMessage;
    const older = (row as ChatMessage).skillDraft;
    if (older && older.status === 'proposed' && older.draft !== card.draft) {
      return { ...row, skillDraft: { ...older, status: 'dismissed' } } as EngineMessage;
    }
    return row;
  });
}

/**
 * A card the reader settled on this screen (Save or Not now): the server's
 * answer, onto every row that shows that draft. Returns the same array when
 * nothing changed.
 */
export function withSkillDraftStatus(
  rows: readonly EngineMessage[],
  draft: string,
  status: NonNullable<ChatMessage['skillDraft']>['status'],
): EngineMessage[] {
  let changed = false;
  const next = rows.map((row) => {
    const card = (row as ChatMessage).skillDraft;
    if (!card || card.draft !== draft || card.status === status) return row;
    changed = true;
    return { ...row, skillDraft: { ...card, status } } as EngineMessage;
  });
  return changed ? next : (rows as EngineMessage[]);
}
