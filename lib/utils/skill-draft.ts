import type { SkillDraftCard, SkillDraftStatus } from '@/types/skill-draft';

/**
 * skill-draft — reading the skills tool's chat card, and the words it shows
 * (thread 2b436b4f). Pure: no React, so the card's reading and its wording are
 * tested on their own.
 */

const STATUSES: readonly SkillDraftStatus[] = ['proposed', 'pending', 'dismissed', 'published', 'rejected'];

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * The card from a message's metadata, or from the `completed` event's
 * `skill_draft`; `null` for anything else, or a card this app cannot read.
 */
export function readSkillDraftCard(value: unknown): SkillDraftCard | null {
  const card = record(value);
  if (!card || card.type !== 'skill_draft') return null;
  const status = card.status;
  const draft = text(card.draft);
  if (!draft || typeof status !== 'string' || !(STATUSES as readonly string[]).includes(status)) return null;
  return {
    status: status as SkillDraftStatus,
    draft,
    kind: card.kind === 'change' ? 'change' : 'new',
    name: text(card.name),
    displayName: text(card.display_name) ?? text(card.name) ?? 'Skill',
    description: text(card.description) ?? '',
  };
}

/**
 * Which of two cards for the same draft is further on. Statuses only move
 * forward (proposed → pending or dismissed → published or rejected), so a read
 * of the chat that started before the person's own Save cannot put the card
 * back to "proposed".
 */
const STAGE: Readonly<Record<SkillDraftStatus, number>> = {
  proposed: 0,
  pending: 1,
  dismissed: 1,
  published: 2,
  rejected: 2,
};

export function laterSkillDraftCard(local: SkillDraftCard, server: SkillDraftCard): SkillDraftCard {
  if (local.draft !== server.draft) return server;
  return STAGE[server.status] >= STAGE[local.status] ? server : local;
}

/** "New skill" or "Changes {name}": what the draft is. */
export function skillDraftKindLine(card: Pick<SkillDraftCard, 'kind' | 'name'>): string {
  return card.kind === 'change' ? `Changes ${card.name ?? 'a skill'}` : 'New skill';
}

/** The card's status line; `null` while it waits for the person (Save and Not now say it). */
export function skillDraftStatusLine(status: SkillDraftStatus): string | null {
  switch (status) {
    case 'proposed':
      return null;
    case 'pending':
      return 'Sent to an admin for approval';
    case 'dismissed':
      return 'Not saved';
    case 'published':
      return 'Approved and published';
    case 'rejected':
      return 'Not approved';
  }
}

/**
 * What a failed request on the card says. A 404 is a draft this reader cannot
 * have: gone, or someone else's (only the person who asked gets a 200). A 422
 * carries the server's own sentence (`errors.draft[0]`: no longer waiting, or
 * no longer a researcher).
 */
export function skillDraftErrorSentence(error: { status: number; message: string; errors: Record<string, string[]> | null }): string {
  if (error.status === 404) return "This draft isn't available to you.";
  if (error.status === 422) return error.errors?.draft?.[0] ?? error.message;
  if (error.status === 0) return "Couldn't reach Lawexa. Try again.";
  return 'Something went wrong. Try again.';
}
