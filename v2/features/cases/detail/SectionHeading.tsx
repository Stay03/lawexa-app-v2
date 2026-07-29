import { cn } from '@/lib/utils';

/**
 * SectionHeading — the one way a case-document section announces itself: the
 * caps-tracked label (the same voice as the header's kicker) with a hairline
 * rule running to the margin.
 *
 * The rule is the finesse that was missing (owner: "data scattered all over
 * the place"): with every section carrying the same label-plus-rule, the page
 * reads as a TABLE OF CONTENTS you scroll through — you always know which part
 * of the judgment you are in, and the sections can never blur into one another
 * again. One component, so no section can drift to its own idea of a heading.
 */
export function SectionHeading({
  label,
  sub,
  className,
}: {
  label: string;
  /** One optional quiet sentence under the label. */
  sub?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-3">
        <h2 className="doc-heading shrink-0">{label}</h2>
        <span aria-hidden className="h-px flex-1 bg-border/60" />
      </div>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
