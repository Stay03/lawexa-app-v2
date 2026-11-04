'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useApproveTemplates } from '@/lib/hooks/useAdminTemplates';
import type { AdminTemplateListParams } from '@/types/admin-templates';
import { bulkApproveMessage, bulkApprovePayload, selectedCount, type DraftSelection } from './template-model';

/**
 * The bar above the Templates list for approving many drafts at once (Arthur,
 * thread 2b658111, 4 November 2026). "Select all N drafts" takes every draft
 * matching the current filters, on every page; "Approve selected (N)" asks to
 * confirm, since it puts templates live, then says what came of it: "N
 * approved, M skipped", with why each was skipped.
 */
export function TemplatesBulkApprove({
  selection,
  onSelectionChange,
  draftTotal,
  params,
}: {
  selection: DraftSelection;
  onSelectionChange: (next: DraftSelection) => void;
  /** Drafts matching the filters, on every page; null while it is read. */
  draftTotal: number | null;
  params: AdminTemplateListParams;
}) {
  const [confirming, setConfirming] = useState(false);
  const approve = useApproveTemplates();
  const count = selectedCount(selection, draftTotal ?? 0);
  const allSelected = selection.kind === 'all';

  if (!draftTotal) return null;

  const run = () => {
    approve.mutate(bulkApprovePayload(selection, params), {
      onSuccess: (result) => {
        const message = bulkApproveMessage(result);
        if (result.skipped.length > 0) toast.warning(message.title, { description: message.detail ?? undefined, duration: 10_000 });
        else toast.success(message.title);
        setConfirming(false);
        onSelectionChange({ kind: 'some', uuids: new Set() });
      },
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox
          checked={allSelected}
          onCheckedChange={(next) => onSelectionChange(next === true ? { kind: 'all' } : { kind: 'some', uuids: new Set() })}
        />
        <span>
          Select all <span className="tabular-nums">{draftTotal.toLocaleString()}</span> {draftTotal === 1 ? 'draft' : 'drafts'}
          <span className="text-muted-foreground"> matching these filters</span>
        </span>
      </label>
      <Button size="sm" className="gap-1.5" disabled={count === 0 || approve.isPending} onClick={() => setConfirming(true)}>
        <CheckCircle2 aria-hidden className="size-4" />
        Approve selected ({count.toLocaleString()})
      </Button>

      <AlertDialog open={confirming} onOpenChange={(open) => !approve.isPending && setConfirming(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make {count === 1 ? 'this template' : `${count.toLocaleString()} templates`} live?</AlertDialogTitle>
            <AlertDialogDescription>
              Lawexa starts using {count === 1 ? 'it' : 'them'} when it drafts. A draft without a name or text is skipped, and the list says why.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approve.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={approve.isPending}
              onClick={(event) => {
                event.preventDefault();
                run();
              }}
            >
              {approve.isPending ? <Loader2 aria-hidden className="mr-2 size-4 animate-spin motion-reduce:animate-none" /> : null}
              Approve {count.toLocaleString()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
