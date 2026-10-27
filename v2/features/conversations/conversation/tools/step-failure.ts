import type { ToolMessage } from '@/types/chat';
import { extractStepError } from './tool-content';

/**
 * step-failure — what a step that didn't work says in an answer's list of
 * steps (Stay, 27 October 2026, thread 9978b59a, option A). A failed step used
 * to print Lawexa's own error text in red under it, "Error: No statute matches
 * that id, slug or title. Find it with search_statutes and pass its id.", which
 * is written for Lawexa, not for the reader. Now the step reads in plain words,
 * in the step list's own grey:
 *
 *   Looked for a statute · not found
 *   Searched cases for "tenancy" · didn't work this time
 *   A step didn't work
 *
 * The step keeps its usual label (formatToolMessage) and gains a short
 * outcome. A read that found nothing says what it looked for, because "Read
 * case" would claim a read that never happened. A tool with no label of its
 * own says "A step didn't work". The error text itself is never shown: it only
 * decides between "not found" and "didn't work this time".
 *
 * The same words for a step streaming in and for one in a reloaded chat: both
 * carry the failure on `toolResult` (transform-api-messages.ts for the second).
 * Pure, so the test reads the words.
 */

export const STEP_NOT_FOUND = 'not found';
export const STEP_DID_NOT_WORK = "didn't work this time";
export const GENERIC_STEP_FAILURE = "A step didn't work";

/** A read that found nothing names what it looked for, instead of claiming a read. */
const LOOKED_FOR: Readonly<Record<string, string>> = {
  read_statute: 'Looked for a statute',
  view_case: 'Looked for a case',
  get_case: 'Looked for a case',
  get_case_details: 'Looked for a case',
  view_note: 'Looked for a note',
  get_note: 'Looked for a note',
  get_note_details: 'Looked for a note',
  read_quiz: 'Looked for a quiz',
  view_conversation: 'Looked for a past chat',
};

/** Error text that says the thing asked for is not there. */
const NOT_FOUND =
  /\b(?:not found|no \w+(?: \w+)? match(?:es|ed)?|does(?: not|n't) exist|could(?: not|n't) find|no such|not exist)\b/i;

/** "not found" when the failure says the thing is not there, else "didn't work this time". */
export function failedStepOutcome(message: ToolMessage): string {
  const error = extractStepError(message);
  return error && NOT_FOUND.test(error) ? STEP_NOT_FOUND : STEP_DID_NOT_WORK;
}

export interface FailedStepLine {
  action: string;
  detail?: string;
  /** `null` for the generic line, which already says it. */
  outcome: string | null;
}

/**
 * The line a failed step reads. `label` is its usual one from
 * formatToolMessage; `generic` says the tool had none of its own.
 */
export function failedStepLine(
  message: ToolMessage,
  label: { action: string; detail?: string; generic?: boolean },
): FailedStepLine {
  if (label.generic) return { action: GENERIC_STEP_FAILURE, outcome: null };
  const outcome = failedStepOutcome(message);
  const lookedFor = LOOKED_FOR[message.toolName];
  if (outcome === STEP_NOT_FOUND && lookedFor) return { action: lookedFor, outcome };
  return { action: label.action, detail: label.detail, outcome };
}

/** The sentence an opened failed step shows, in place of the error text. */
export function failedStepSentence(message: ToolMessage): string {
  return failedStepOutcome(message) === STEP_NOT_FOUND
    ? 'Lawexa looked for this and it was not there.'
    : "This step didn't work this time.";
}
