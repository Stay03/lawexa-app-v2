import { cn } from '@/lib/utils';
import { entryLook } from '@/v2/features/folders/file-list/entry-look';

/** The file's kind as a glyph in its colour on a quiet tile (the Folders page's marks). */
export function FileMark({
  kind,
  className,
  iconClassName,
}: {
  kind: string | null;
  className?: string;
  iconClassName?: string;
}) {
  const look = entryLook({ type: 'file', kind });
  const Icon = look.icon;
  return (
    <span aria-hidden className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary', className)}>
      <Icon className={cn('size-[18px]', look.tone, iconClassName)} />
    </span>
  );
}
