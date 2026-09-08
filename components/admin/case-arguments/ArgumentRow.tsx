'use client';

import { Check, Pencil, Scale, Undo2, User, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CaseArgumentReviewItem } from '@/types/admin-case-arguments';
import type { RowSessionState } from './model';

interface ArgumentRowProps {
  item: CaseArgumentReviewItem;
  state: RowSessionState | undefined;
  focused: boolean;
  onFocus: () => void;
  onApprove: () => void;
  onEdit: () => void;
  onReject: () => void;
}

/**
 * What the COURT did with the submission. Not what a reviewer decided.
 *
 * ── THE TWO VERDICTS ARE DIFFERENT THINGS AND SHARE A WORD ────────────────
 * `status` is the judgment's answer to counsel; `rejected_at` is the
 * reviewer's answer to the extraction. Both say "rejected" and they mean
 * opposite kinds of thing: a submission the court rejected is a CORRECT
 * extraction of a losing argument, and throwing it out would delete a true
 * record. So this badge never uses the reviewer's colours, and the row's own
 * rejected state is drawn separately below.
 *
 * Measured on 100 live rows: accepted 44, rejected 51, not_decided 5.
 * Neither value is rare, so neither is the quiet default — both are drawn.
 */
function CourtOutcome({ status }: { status: string | null }) {
  if (!status) return null;
  const label =
    status === 'accepted'
      ? 'Court accepted'
      : status === 'rejected'
        ? 'Court rejected'
        : status === 'not_decided'
          ? 'Court did not decide'
          : status.replace(/_/g, ' ');
  return (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      <Scale className="mr-1 size-3" />
      {label}
    </Badge>
  );
}

function ArgumentMeta({ item }: { item: CaseArgumentReviewItem }) {
  const judge = item.judge?.name;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CourtOutcome status={item.status} />
      {judge && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <User className="size-3" />
          {judge}
        </span>
      )}
      {item.authorities.length > 0 && (
        <span className="text-xs text-muted-foreground">
          {item.authorities.length === 1
            ? '1 authority'
            : `${item.authorities.length} authorities`}
        </span>
      )}
    </div>
  );
}

/**
 * One submission. Actions sit in a fixed-width right column so Keep lands at
 * the same x on every row, whether the argument runs to one line or twelve.
 *
 * ── KEEP AND THROW OUT ARE NOT EQUALS, AND NOT FOR THE USUAL REASON ───────
 * On the principle screen Reject is quiet because it deletes permanently.
 * Here it does not: reject writes a stamp, the row survives, and Keep undoes
 * it. So Throw out is drawn as a real, reachable choice rather than a hazard,
 * and the row it produces stays legible instead of fading to nothing — the
 * kept rejection IS the record of what the extraction got wrong, and nothing
 * else in the system holds one.
 */
export function ArgumentRow({
  item,
  state,
  focused,
  onFocus,
  onApprove,
  onEdit,
  onReject,
}: ArgumentRowProps) {
  const approvedOnServer = item.reviewed && !item.rejected_at;
  const rejectedOnServer = Boolean(item.rejected_at);
  const approved =
    state?.kind === 'approved' || (state === undefined && approvedOnServer);
  const rejected =
    state?.kind === 'rejected' || (state === undefined && rejectedOnServer);
  const failed = state?.kind === 'failed' ? state : undefined;
  const done = approved || rejected;

  return (
    // A visual cursor target, not a DOM-focusable control: j/k move a virtual
    // focus so real keyboard focus stays free for the buttons and dialogs.
    <div
      id={`argument-row-${item.id}`}
      data-focused={focused || undefined}
      onClick={onFocus}
      className={cn(
        'grid scroll-mt-36 grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_11.5rem]',
        'transition-colors duration-200 motion-reduce:transition-none',
        focused && 'bg-primary/[0.04] ring-2 ring-inset ring-primary/40'
      )}
    >
      <div className="min-w-0 space-y-2">
        <p
          className={cn(
            'whitespace-pre-wrap text-sm leading-relaxed',
            'transition-colors duration-200 motion-reduce:transition-none',
            done && 'text-muted-foreground'
          )}
        >
          {item.argument}
        </p>

        {/* The court's own words on this submission, when the report carries
            them. Indented and quieter because it is context for the decision
            rather than the thing being reviewed. 80 of 100 rows have one. */}
        {item.court_response && (
          <p className="border-l-2 border-muted pl-3 text-xs leading-relaxed text-muted-foreground">
            {item.court_response}
          </p>
        )}

        <ArgumentMeta item={item} />

        {rejected && (
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
            Thrown out. Nothing was deleted, so what the AI wrote is still on
            record.
          </p>
        )}

        {failed && (
          <p className="text-xs font-medium text-destructive animate-in fade-in-0 duration-200 motion-reduce:animate-none">
            {failed.action === 'approve' ? 'Keep failed' : 'Throw out failed'}:{' '}
            {failed.message}
          </p>
        )}
      </div>

      <div className="flex items-start gap-1 sm:justify-end">
        {/* ── KEEPING IS A ONE-WAY DOOR AND THE BUTTONS SAY SO ─────────────
            The update route validates `reviewed` with Laravel's `accepted`
            rule, which only permits TRUE, so there is no un-approve. Reject
            is not a way back either: it sets `rejected_at` AND `reviewed`,
            which is a third state rather than a return to untouched.

            So a kept row shows a STATIC label, not a button. A button that
            re-sends the same approval reads as a toggle and would invite a
            reviewer to click it expecting the opposite of what it does.

            A thrown-out row DOES keep its button, because approving it is a
            real transition the server supports: approve clears the rejection.
            The asymmetry is the API's, and the screen shows it rather than
            hiding it behind two identical-looking controls. */}
        {approved ? (
          <span className="inline-flex items-center px-3 py-1.5 text-sm text-muted-foreground">
            <Check className="mr-1 size-4" aria-hidden />
            Kept
          </span>
        ) : rejected ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onApprove}
            className="text-muted-foreground"
          >
            <Undo2 className="mr-1 size-4" aria-hidden />
            Keep instead
          </Button>
        ) : (
          <>
            <Button type="button" size="sm" onClick={onApprove}>
              <Check className="mr-1 size-4" aria-hidden />
              Keep
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onEdit}
              aria-label="Edit this argument"
              title="Edit"
            >
              <Pencil className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onReject}
              aria-label="Throw this argument out"
              title="Throw out"
            >
              <X className="size-4" aria-hidden />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
