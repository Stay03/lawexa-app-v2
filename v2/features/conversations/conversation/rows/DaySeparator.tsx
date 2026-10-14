/** The line between two days of a space chat: "Today", "Yesterday" or the
 *  date, between two quiet rules (Arthur's layout, 14 October 2026). */
export function DaySeparator({ label }: { label: string }) {
  return (
    <div role="separator" aria-label={label} className="text-muted-foreground flex items-center gap-3 text-xs">
      <span aria-hidden className="bg-border h-px flex-1" />
      <span aria-hidden className="shrink-0 font-medium">
        {label}
      </span>
      <span aria-hidden className="bg-border h-px flex-1" />
    </div>
  );
}
