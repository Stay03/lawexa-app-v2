'use client';

/**
 * TabTitle — the browser tab's name for a screen whose subject is per-user
 * data (a note, a folder, a space…), where the server shell could only say
 * "Note" (Tester Claude, 19 October 2026: a note's tab read "Note | Lawexa").
 *
 * React 19 hoists this <title> into <head>, AHEAD of the one Next's metadata
 * rendered, and the tab reads the first; unmounting removes it and hands the
 * tab back to Next's title. No effect and nothing to restore. The root
 * "%s | Lawexa" template does not reach a client title, so it is applied here.
 * The child stays ONE string: React warns on an array child in <title>.
 * `app-badge` re-attaches to the new first <title> and keeps its "(n) ".
 */
export function TabTitle({ name }: { name: string | null | undefined }) {
  const text = name?.trim();
  if (!text) return null;
  return <title>{`${text} | Lawexa`}</title>;
}
