'use client';

import { cn } from '@/lib/utils';

interface ChipZoneProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
  'aria-label'?: string;
}

/**
 * Bounded container that chip fields live inside — gives empty fields a
 * visible shape and every row a consistent edge, instead of bare pills
 * floating in whitespace. Clicking the empty area starts adding.
 */
function ChipZone({
  children,
  onClick,
  className,
  ref,
  'aria-label': ariaLabel,
}: ChipZoneProps) {
  return (
    <div
      ref={ref}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'flex min-h-11 w-full flex-wrap content-center items-center gap-1.5 rounded-xl border border-input bg-input/30 px-2.5 py-2 transition-colors focus-within:border-ring',
        onClick && 'cursor-text',
        className
      )}
    >
      {children}
    </div>
  );
}

/** The dashed "+ Add …" affordance rendered inside a ChipZone. */
function ChipZoneAddButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
    >
      <span aria-hidden>+</span>
      {label}
    </button>
  );
}

export { ChipZone, ChipZoneAddButton };
