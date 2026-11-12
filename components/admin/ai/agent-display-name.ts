import { z } from 'zod';

/**
 * An agent's "Name people see" (`display_name`, Backend's sub-agents
 * 88cef0fe, 12 November 2026): what a reader sees where the agent is named
 * (the "From …" line on a call, an agent conversation, its preview and status
 * rows). Empty by default, and then the agent's Name is shown. The server
 * gives the reader-facing name already chosen; only the admin form knows both.
 */
export const DISPLAY_NAME_LABEL = 'Name people see';
export const DISPLAY_NAME_HINT = 'Leave empty to show the Name above.';

/** The form's field: text, up to 255 characters (the server's own limit and words). */
export const displayNameField = z.string().max(255, 'The display name cannot exceed 255 characters.');

/**
 * What the form sends: the trimmed name, or `null` to clear it, so emptying
 * the field takes the name away rather than keeping the old one (the server
 * keeps it only when the key is left out).
 */
export function displayNameForSave(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}
