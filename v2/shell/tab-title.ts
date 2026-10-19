/**
 * The browser tab's name for a screen whose subject is per-user data (a note,
 * a folder, a space…), where the server shell could only say "Note" (Tester
 * Claude, 19 October 2026: a note's tab read "Note | Lawexa").
 *
 * Pure, so the rules are tested; `useTabTitle` applies them to the document.
 * `app-badge` keeps a "(n) " mention prefix in front of the title, so every
 * rule here reads and keeps that prefix rather than fighting it.
 */

/** app-badge's mention prefix, "(3) ". */
const MENTION_PREFIX = /^\(\d+\) /;

/** "{name} | Lawexa", the root template's form, or null without a name. */
export function tabTitleText(name: string | null | undefined): string | null {
  const text = name?.trim();
  return text ? `${text} | Lawexa` : null;
}

/** The title without app-badge's prefix. */
export function bareTitle(title: string): string {
  return title.replace(MENTION_PREFIX, '');
}

/**
 * What the tab should read while the screen is up: the screen's text, after
 * whatever mention prefix is there now. Equal to `current` when nothing needs
 * writing, so a writer that compares first settles in one pass.
 */
export function heldTitle(current: string, text: string): string {
  const prefix = current.match(MENTION_PREFIX)?.[0] ?? '';
  return `${prefix}${text}`;
}

/**
 * What the tab goes back to when the screen leaves: the title it found, with
 * the prefix of the moment, but only while the tab still shows this screen's
 * text. Anything else was written after it (the next page's own title) and is
 * left alone.
 */
export function restoredTitle(current: string, text: string, previous: string): string {
  if (bareTitle(current) !== text) return current;
  const prefix = current.match(MENTION_PREFIX)?.[0] ?? '';
  return `${prefix}${bareTitle(previous)}`;
}
