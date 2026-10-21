import { Globe, Link2, Lock, Users, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { ChannelQuizVisibility } from '@/types/channel-quiz';
import { visibilityFace } from './model';

/**
 * VisibilityChip — who can find this quiz, legible without opening a menu.
 * Worn by a row in the channel sheet, a row in the library and the quiz
 * front's owner line, so the four states read the same everywhere: one mark,
 * one word (`visibilityFace`), and the mark never shrinks, so it survives
 * whatever a narrow row does to the word.
 */
/** One mark per answer, shared with the form's choice cards so a chip and the
 *  card that set it wear the same glyph. */
export const VISIBILITY_MARKS: Record<ChannelQuizVisibility, LucideIcon> = {
  shared: Users,
  private: Lock,
  link: Link2,
  public: Globe,
};

export function VisibilityChip({
  visibility,
  className,
}: {
  visibility: ChannelQuizVisibility;
  className?: string;
}) {
  const Mark = VISIBILITY_MARKS[visibility];
  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1 rounded-full bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground',
        className,
      )}
    >
      <Mark aria-hidden className="size-3 shrink-0" />
      <span className="truncate">{visibilityFace(visibility)}</span>
    </span>
  );
}
