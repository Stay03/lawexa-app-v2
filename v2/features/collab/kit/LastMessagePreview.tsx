import type { Channel } from '@/types/collab';

/**
 * LastMessagePreview — "Author: what they said", one line, for a channel or a
 * thread row's meta line (Stay, 16 October 2026: "the text below a
 * channel/thread in a list should have the last message in it and time").
 *
 * The author takes a stronger ink so the eye finds who spoke; the snippet is
 * the server's (plaintext, mentions and markdown flattened, at most 120
 * characters). It truncates as one fact inside `MetaLine`'s lead zone. The time
 * stays where the row already prints it, on the right.
 */
export function LastMessagePreview({
  preview,
  prefix = null,
}: {
  preview: NonNullable<Channel['last_message']>;
  /** A fact that must share the preview's one truncation ("in #general"), so
   *  the line is cut once at its end, never twice. */
  prefix?: string | null;
}) {
  return (
    <span className="min-w-0 truncate">
      {prefix ? `${prefix} · ` : null}
      <span className="text-foreground/70">{preview.author_name}</span>
      {`: ${preview.snippet}`}
    </span>
  );
}
