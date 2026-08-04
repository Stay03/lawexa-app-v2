/**
 * separators — the feed's two non-message lines (phase-5 W2, 2026-08-04):
 *
 *  - {@link DaySeparator} — a plain hairline with the absolute day label
 *    (design-research DIRECTION 3: day dividers are plain, dated).
 *  - {@link UnreadDivider} — the GOLD hairline + "New" chip at the first
 *    unseen message. Unread language is gold, never red (binding no-list).
 *
 * GOLD MEANS UNREAD, AND NOTHING ELSE. The Lawexa session boundary used to
 * draw a second gold pill here; readers took it for the unread line, so the
 * feed now drops that row entirely (`feed-model.ts`). Nothing else earns the
 * accent.
 *
 * All presentational; the feed owns placement and keys.
 */

export function DaySeparator({ label }: { label: string }) {
  return (
    <div className="relative py-1 text-center" role="separator" aria-label={label}>
      <span aria-hidden className="absolute inset-x-0 top-1/2 border-t border-border/70" />
      <span className="relative rounded-full border bg-background px-3 py-0.5 text-xs font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

/** The unread line. `data-unread-divider` is the feed's land-at-line anchor. */
export function UnreadDivider() {
  return (
    <div
      data-unread-divider
      role="separator"
      aria-label="New messages"
      className="relative py-1 text-center"
    >
      <span aria-hidden className="absolute inset-x-0 top-1/2 border-t border-primary/60" />
      <span className="relative rounded-full border border-primary/60 bg-background px-3 py-0.5 text-xs font-semibold text-primary">
        New
      </span>
    </div>
  );
}
