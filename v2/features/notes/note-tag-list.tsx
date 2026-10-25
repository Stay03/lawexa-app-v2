import { cn } from '@/lib/utils';
import './note-tags.css';

/**
 * NoteTagList — a note's tags as quiet labels (Stay, 25 October 2026: "Each
 * tag should have a clean design it just feels like plain text").
 *
 * Small light grey pills (Stay picked look A). Used by the notes list row on a
 * computer (the first tags, then "+N" for the rest, on one line) and by the
 * note's own page (every tag, wrapping). Greys only: no colour, since gold is
 * for actions.
 */
export function NoteTagList({
  tags,
  more = 0,
  wrap = false,
  className,
}: {
  tags: readonly string[];
  /** Tags left out after these, drawn as "+N" in the same style. */
  more?: number;
  /** The note page wraps its tags; a list row keeps them on one line. */
  wrap?: boolean;
  className?: string;
}) {
  if (tags.length === 0 && more === 0) return null;
  return (
    <span className={cn('v2-note-tags flex', wrap ? 'flex-wrap' : 'flex-nowrap', className)}>
      <span className="sr-only">Tags: </span>
      {tags.map((tag, index) => (
        <span key={`${index}-${tag}`} className="v2-note-tag" title={tag}>
          {tag}
        </span>
      ))}
      {more > 0 ? (
        <span className="v2-note-tag v2-note-tag-more">
          <span className="sr-only">and </span>+{more}
          <span className="sr-only"> more</span>
        </span>
      ) : null}
    </span>
  );
}
