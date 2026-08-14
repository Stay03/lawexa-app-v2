'use client';

import { ArrowRight, Ban, Check, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CaseFixPreview, FixField } from '@/types/admin-case-data-review';

/**
 * What a repair WOULD do to this case, and when it refuses to say.
 *
 * A BLOCKED ROW MUST NOT LOOK LIKE A PROPOSED ONE. The citation generator fills
 * the year and the court in from the case itself, so a case parked on the
 * placeholder court happily produces `(1956) LELR-131 (NG-N)`: a string that
 * reads exactly like a real citation and identifies nothing. A confident
 * looking value there is what recruits a reviewer into approving it, so this
 * shows no value at all and says why instead. 681 production cases are in that
 * state and none of them will offer a reviewer anything to approve.
 *
 * Nothing here writes. There is no write endpoint yet, by design.
 */
export function FixPreview({ fix }: { fix: CaseFixPreview }) {
  if (fix.state === 'already_correct') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Title and citation are already correct
      </p>
    );
  }

  if (fix.state === 'blocked') {
    /* The reason only. The sentence explaining WHY no value is offered is the
       same for every blocked row, so it is said once above the list rather
       than fifteen times down it; the reason itself can differ per case, so
       that stays here. */
    return (
      <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
        <Ban className="h-3.5 w-3.5 shrink-0" aria-hidden />
        No correction: {(fix.reason_label ?? 'cannot be computed').toLowerCase()}
      </p>
    );
  }

  const changed = [
    { label: 'Title', field: fix.title },
    { label: 'Citation', field: fix.citation },
  ].filter(({ field }) => field.after !== null && field.after !== field.before);

  return (
    <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <Wand2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Correction ready
      </p>
      {changed.length === 0 ? (
        <p className="mt-0.5 text-xs text-muted-foreground">
          A corrected title and citation exist for this case.
        </p>
      ) : (
        <dl className="mt-1.5 grid gap-1.5">
          {changed.map(({ label, field }) => (
            <FixDiff key={label} label={label} field={field} />
          ))}
        </dl>
      )}
    </div>
  );
}

/** One field's current value and what it would become. */
function FixDiff({ label, field }: { label: string; field: FixField }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="grid gap-0.5 text-xs">
        <span className="break-words text-muted-foreground line-through decoration-muted-foreground/40">
          {field.before || 'nothing'}
        </span>
        <span className="flex items-start gap-1.5 break-words font-medium text-foreground">
          <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" aria-hidden />
          {field.after}
        </span>
      </dd>
    </div>
  );
}

/** Compact one-word state, for places with no room for the whole preview. */
export function FixStateChip({ fix, className }: { fix: CaseFixPreview; className?: string }) {
  const tone =
    fix.state === 'blocked'
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : fix.state === 'proposed'
        ? 'border-primary/30 bg-primary/10 text-primary'
        : 'border-border bg-muted text-muted-foreground';
  const label =
    fix.state === 'blocked'
      ? (fix.reason_label ?? 'Blocked')
      : fix.state === 'proposed'
        ? 'Correction ready'
        : 'Already correct';
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-[11px] font-medium',
        tone,
        className
      )}
    >
      {label}
    </span>
  );
}
