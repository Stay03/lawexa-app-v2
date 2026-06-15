import { cn } from '@/lib/utils';

/**
 * A muted, wrap-safe metadata row. Each direct child after the first is
 * prefixed with a middot via a ::before pseudo-element, so the separator is
 * part of the item and can never wrap onto its own line (the old literal "·"
 * spans did exactly that on narrow screens). Items stay on one line each; the
 * row wraps between them.
 */
function RadarMetaRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-y-1 text-xs text-muted-foreground',
        '[&>*]:whitespace-nowrap',
        "[&>*:not(:first-child)]:before:mx-2 [&>*:not(:first-child)]:before:text-muted-foreground/50 [&>*:not(:first-child)]:before:content-['·']",
        className
      )}
    >
      {children}
    </div>
  );
}

export { RadarMetaRow };
