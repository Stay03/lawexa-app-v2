import Link from 'next/link';
import { ClipboardPaste, MessageSquare, Paperclip, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING, REVEAL, RowIconTile } from '@/v2/shell/designs/modules';
import {
  attachmentMarks,
  type ActivityQuestion,
  type ActivityRun as Run,
  type AttachmentMark,
  type QuestionPreview,
} from './model';

/** The link every row is: whole-row target, calm tint, the shared focus ring. */
const ROW = cn(
  'group v2-interactive flex items-start gap-3 rounded-xl px-3 transition-colors hover:bg-secondary/60',
  FOCUS_RING,
);

/** The icon for each kind of attachment mark. */
const MARK_ICON: Record<AttachmentMark['kind'], LucideIcon> = {
  pastes: ClipboardPaste,
  files: Paperclip,
};

/**
 * ActivityRun — one conversation's questions inside a day, built on the shared
 * row anatomy (`RowIconTile`, the calm hover tint, `FOCUS_RING`, a ≥44px
 * target) so it reads as the same system as `/conversations`.
 *
 * TWO SHAPES, decided by `run.merged` (see `model.ts`):
 *  - A chat's opener on its own: ONE row. The tile, the question, its time.
 *    The title is not printed, because it is this question cut at fifty
 *    characters.
 *  - Anything else: the conversation's title beside the tile, and the
 *    questions under it on a hairline that drops from the tile's centre. The
 *    title says which chat; the lines say what was asked, in order.
 *
 * Every row is a link to the conversation. There is no per-message anchor in
 * the conversation screen yet, so a question opens its chat at the bottom,
 * where the conversation screen always opens.
 *
 * The entrance is the module `REVEAL`, `motion-safe` gated, staggered by the
 * run's position and capped at 14 so a long list never waits on a growing
 * delay. It plays on mount only: a run that stays on screen across a refetch
 * keeps its key and does not re-animate.
 */
export function ActivityRun({ run, index }: { run: Run; index: number }) {
  const href = `/c/${run.conversationId}`;

  return (
    <li
      className={cn(REVEAL, 'duration-300')}
      style={{ animationDelay: `${Math.min(index, 14) * 30}ms` }}
    >
      {run.merged ? (
        <Link href={href} className={cn(ROW, 'min-h-14 py-2.5')}>
          <RowIconTile icon={MessageSquare} />
          <QuestionText preview={run.questions[0].preview} className="pt-2" />
          <QuestionTime question={run.questions[0]} className="pt-2" />
        </Link>
      ) : (
        <>
          <Link href={href} className={cn(ROW, 'min-h-11 items-center py-2')}>
            <RowIconTile icon={MessageSquare} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {run.title}
            </span>
          </Link>
          <ul className="ml-[1.875rem] border-l border-border/70 pl-1">
            {run.questions.map((question) => (
              <li key={question.id}>
                <Link href={href} className={cn(ROW, 'min-h-11 py-2.5')}>
                  <QuestionText preview={question.preview} />
                  <QuestionTime question={question} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

/**
 * The question, two lines at most, with a quiet line under it naming what the
 * reader attached. A question that was only a paste reads "Pasted text"; one
 * with nothing left to show (only machinery tags) says so rather than drawing
 * an empty row.
 */
function QuestionText({ preview, className }: { preview: QuestionPreview; className?: string }) {
  const marks = attachmentMarks(preview);
  return (
    <span className={cn('flex min-w-0 flex-1 flex-col gap-0.5', className)}>
      {preview.text ? (
        <span className="line-clamp-2 text-sm leading-snug break-words text-foreground">
          {preview.text}
        </span>
      ) : marks.length === 0 ? (
        <span className="text-sm leading-snug text-muted-foreground">Empty message</span>
      ) : null}
      {marks.length > 0 ? (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {marks.map(({ kind, label }) => {
            const Icon = MARK_ICON[kind];
            return (
              <span key={kind} className="inline-flex items-center gap-1">
                <Icon aria-hidden className="size-3.5" />
                {label}
              </span>
            );
          })}
        </span>
      ) : null}
    </span>
  );
}

/** The time of day, right-aligned and tabular so a column of them lines up. */
function QuestionTime({ question, className }: { question: ActivityQuestion; className?: string }) {
  return (
    <time
      dateTime={question.createdAt}
      className={cn('shrink-0 pt-px text-xs tabular-nums text-muted-foreground/80', className)}
    >
      {question.time}
    </time>
  );
}
