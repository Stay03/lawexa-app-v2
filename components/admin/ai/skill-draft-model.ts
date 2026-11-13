/**
 * Admin AI Skills' drafts (the skills tool, thread 2b436b4f; API skills-tool
 * 385ececc): the words for a draft's status and source, which fields differ
 * from the live skill, and what a failed publish or import says. Pure, so the
 * node tests check them without a browser.
 */
import type { ApiError } from '@/lib/utils/api-error';
import type { SkillDraft, SkillDraftStatus } from '@/types/skill-draft';

export const DRAFT_STATUS_LABEL: Readonly<Record<SkillDraftStatus, string>> = {
  proposed: 'Not saved yet',
  pending: 'Waiting for review',
  dismissed: 'Set aside',
  published: 'Published',
  rejected: 'Rejected',
};

/** Where the draft came from: a person's chat, or a zip an admin imported. */
export function draftSourceLine(draft: Pick<SkillDraft, 'source' | 'created_by'>): string {
  const who = draft.created_by?.name ?? 'someone';
  return draft.source === 'zip' ? `Imported from a SKILL.md zip by ${who}` : `Drafted in ${who}'s chat`;
}

/** "New skill" or "Changes {name}". */
export function draftKindLine(draft: Pick<SkillDraft, 'kind' | 'name'>): string {
  return draft.kind === 'change' ? `Changes ${draft.name ?? 'a skill'}` : 'New skill';
}

/** The short fields a change edits, beside the live skill: which differ. */
export function changedFields(draft: SkillDraft): Array<'display_name' | 'description' | 'load_mode' | 'instructions'> {
  const live = draft.live;
  if (!live) return [];
  const changed: Array<'display_name' | 'description' | 'load_mode' | 'instructions'> = [];
  if (draft.display_name !== live.display_name) changed.push('display_name');
  if (draft.description !== live.description) changed.push('description');
  if (draft.load_mode !== live.load_mode) changed.push('load_mode');
  if (draft.instructions !== live.instructions) changed.push('instructions');
  return changed;
}

/** The first field error, or the message: the server's own sentence. */
function firstError(error: ApiError, fields: readonly string[]): string {
  for (const field of fields) {
    const first = error.errors?.[field]?.[0];
    if (first) return first;
  }
  return error.message;
}

/**
 * A publish that did not go through: the live skill moved on since the draft
 * (409, which may be published over), refused (422: nothing would change, the
 * name is taken, the skill was deleted, the draft is no longer waiting), or a
 * failure to reach the server.
 */
export type PublishProblem =
  | { kind: 'newer'; message: string }
  | { kind: 'refused'; message: string }
  | { kind: 'failed'; message: string };

export function publishProblem(error: ApiError): PublishProblem {
  if (error.status === 409) return { kind: 'newer', message: error.message };
  if (error.status === 422) return { kind: 'refused', message: firstError(error, ['draft', 'name']) };
  if (error.status === 0) return { kind: 'failed', message: "Couldn't reach the server. Try again." };
  return { kind: 'failed', message: error.message || 'Publishing failed. Try again.' };
}

/** What a refused import says: the server's reason for the zip (`errors.file[0]`). */
export function importProblem(error: ApiError): string {
  if (error.status === 422) return firstError(error, ['file']);
  if (error.status === 0) return "Couldn't reach the server. Try again.";
  return error.message || 'The import failed. Try again.';
}

/** An edit or reject that did not go through: the server's sentence for the field it names. */
export function editProblem(error: ApiError): string {
  if (error.status === 422) {
    return firstError(error, ['draft', 'name', 'display_name', 'description', 'instructions', 'load_mode', 'change_note', 'review_note']);
  }
  if (error.status === 0) return "Couldn't reach the server. Try again.";
  return error.message || 'Saving failed. Try again.';
}

/** A zip must be one, and at most 1 MB, before it is sent (the server checks the same). */
export const IMPORT_MAX_BYTES = 1024 * 1024;

export function importFileProblem(file: Pick<File, 'name' | 'size'>): string | null {
  if (!/\.zip$/i.test(file.name)) return 'Choose a .zip file.';
  if (file.size > IMPORT_MAX_BYTES) return 'The zip is larger than 1 MB.';
  return null;
}
