import { BookOpen, FileQuestion, NotebookPen, Scale, ScrollText, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { ContentRequest } from '@/types/content-request';
import { STATUS_PILL, statusTone, statusWord } from './model';

/** The status, as a grey pill in its tone. The words come from `statusWord`. */
export function RequestStatusPill({
  request,
  className,
}: {
  request: Pick<ContentRequest, 'status' | 'status_label'>;
  className?: string;
}) {
  const tone = statusTone(request.status);
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full border px-2 text-[12px] leading-none font-medium',
        STATUS_PILL[tone],
        className,
      )}
    >
      {tone === 'working' ? <span aria-hidden className="size-1.5 rounded-full bg-muted-foreground" /> : null}
      {statusWord(request)}
    </span>
  );
}

const TYPE_ICON: Record<string, LucideIcon> = {
  case: Scale,
  note: NotebookPen,
  statute: BookOpen,
  provision: ScrollText,
};

/** The requested kind's glyph, on the quiet tile the settings rows use. Decorative. */
export function RequestTypeTile({ type }: { type: string }) {
  const Icon = TYPE_ICON[type] ?? FileQuestion;
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground"
    >
      <Icon className="size-[1.125rem]" />
    </span>
  );
}
