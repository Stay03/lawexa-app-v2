import { cn } from '@/lib/utils';

/** A template's type and area, as two quiet tags; nothing when neither is set. */
export function TemplateTags({ type, area, className }: { type?: string | null; area?: string | null; className?: string }) {
  if (!type && !area) return null;
  return (
    <span className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {type ? <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">{type}</span> : null}
      {area ? (
        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{area}</span>
      ) : null}
    </span>
  );
}
