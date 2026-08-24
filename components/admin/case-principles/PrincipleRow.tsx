'use client';

import { format } from 'date-fns';
import { Check, Pencil, Trash2, User } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { CasePrincipleReviewItem } from '@/types/admin-case-principles';
import type { RowSessionState } from './model';

interface PrincipleRowProps {
  item: CasePrincipleReviewItem;
  state: RowSessionState | undefined;
  focused: boolean;
  onFocus: () => void;
  onApprove: () => void;
  onEdit: () => void;
  onReject: () => void;
}

/**
 * Labels ranked by how much they actually say, measured on the live queue.
 * The tag changes on 95% of within-case row pairs, so it leads. "Ratio" is
 * 94% of all rows and is deliberately not rendered: the ~109 rows that are
 * obiter or untyped are the ones most likely to be mislabelled, so those two
 * states get the visual weight instead of drowning in 1,600 "Ratio" badges.
 */
/**
 * How much of this principle is word for word in its judgment.
 *
 * ── THE COMMON CASE IS QUIET, THE EXCEPTION CARRIES THE WEIGHT ────────────
 * Same grammar as the type badge above, and for the same reason. Measured
 * across ~400 principles by the backend and 149 by this side: nothing scores
 * below 80 and almost everything scores 100. A column shouting "100" on every
 * row teaches a reviewer nothing and trains them to stop looking at it, which
 * is exactly what must not happen to a check whose whole job is to be noticed
 * on the day it finally fires.
 *
 * So 100 is rendered small and muted — present, honest, ignorable — and only a
 * score below it is given colour.
 *
 * ── NOT MEASURED IS NOT ZERO ──────────────────────────────────────────────
 * `null` means nobody has scored it yet, either because the scoring command
 * has not run or because the case carries no judgment text at all. Those
 * principles re-enter the pool on their own the day a report arrives. Showing
 * them as 0, or hiding them, would both be lies.
 */
function VerbatimScore({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <span className="text-xs text-muted-foreground/70" title="No judgment text to check against yet">
        Not checked
      </span>
    );
  }
  if (score === 100) {
    return (
      <span className="tabular-nums text-xs text-muted-foreground/70" title="Word for word in the judgment">
        100
      </span>
    );
  }
  const severe = score < 50;
  return (
    <Badge
      variant="outline"
      className={cn(
        'tabular-nums font-medium',
        severe
          ? 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400'
          : 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400'
      )}
      title={`${score}% of this principle is word for word in the judgment`}
    >
      {score}
    </Badge>
  );
}

function PrincipleMeta({ item }: { item: CasePrincipleReviewItem }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <VerbatimScore score={item.verbatim_score} />
      {item.tag && (
        <Badge variant="secondary" className="font-normal">
          {item.tag}
        </Badge>
      )}
      {item.type === 'obiter' && (
        <Badge
          variant="outline"
          className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
        >
          Obiter
        </Badge>
      )}
      {item.type === null && (
        <Badge
          variant="outline"
          className="border-dashed border-amber-500/50 text-amber-700 dark:text-amber-400"
        >
          No type
        </Badge>
      )}
      {item.law_type?.map((lt) => (
        <Badge
          key={lt}
          variant="outline"
          className="font-normal capitalize text-muted-foreground"
        >
          {lt}
        </Badge>
      ))}
      {item.judge && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <User className="size-3" />
          {item.judge.name}
        </span>
      )}
    </div>
  );
}

/**
 * One principle. The actions live in a fixed-width right column so Approve
 * sits at the same x on every row instead of trailing text that varies from
 * one line to eight. Approve carries the visual weight; Reject is deliberately
 * quieter because it permanently deletes — the two must never read as equals.
 * A row acted on stays exactly where it is, ticked and muted, and only ever
 * changes state in place.
 */
export function PrincipleRow({
  item,
  state,
  focused,
  onFocus,
  onApprove,
  onEdit,
  onReject,
}: PrincipleRowProps) {
  const approved = state?.kind === 'approved' || (state === undefined && item.reviewed);
  const rejected = state?.kind === 'rejected';
  const failed = state?.kind === 'failed' ? state : undefined;
  const done = approved || rejected;

  return (
    // The row is a visual cursor target, not a DOM-focusable control: j/k move
    // a virtual focus so real keyboard focus stays free for the buttons and
    // dialogs. Clicking anywhere on the row moves the cursor here.
    <div
      id={`principle-row-${item.id}`}
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
            done && 'text-muted-foreground',
            rejected && 'opacity-60'
          )}
        >
          {item.principle}
        </p>
        <PrincipleMeta item={item} />
        {failed && (
          <p className="text-xs font-medium text-destructive animate-in fade-in-0 duration-200 motion-reduce:animate-none">
            {failed.action === 'approve' ? 'Approve failed' : 'Reject failed'}:{' '}
            {failed.message} — try again.
          </p>
        )}
      </div>

      <div className="flex items-start justify-start gap-1.5 sm:justify-end">
        {approved ? (
          <span className="inline-flex h-8 items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 animate-in fade-in-0 duration-300 motion-reduce:animate-none">
            <Check className="size-3.5" />
            Approved
            {item.reviewed_by && ` by ${item.reviewed_by.name}`}
            {item.reviewed_at &&
              ` · ${format(new Date(item.reviewed_at), 'MMM d')}`}
          </span>
        ) : rejected ? (
          <span className="inline-flex h-8 items-center gap-1.5 text-xs font-medium text-destructive animate-in fade-in-0 duration-300 motion-reduce:animate-none">
            <Trash2 className="size-3.5" />
            Rejected
          </span>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-600/40 text-emerald-700 hover:bg-emerald-600/10 hover:text-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-400/10 dark:hover:text-emerald-300"
              onClick={onApprove}
            >
              <Check />
              Approve
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={onEdit}
                  aria-label="Edit principle"
                >
                  <Pencil />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit (E)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={onReject}
                  aria-label="Reject principle"
                >
                  <Trash2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reject (R) — deletes permanently</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}
