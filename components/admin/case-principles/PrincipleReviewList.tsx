'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Check, CheckCheck, Pencil, Trash2, Scale, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import type { CasePrincipleReviewItem } from '@/types/admin-case-principles';
import { getCaseDisplayTitle } from '@/lib/utils/case-title';

interface PrincipleReviewListProps {
  items: CasePrincipleReviewItem[];
  isLoading: boolean;
  selectedIds: Set<number>;
  isMutating: boolean;
  onToggleSelect: (id: number) => void;
  onSelectCase: (ids: number[], selectAll: boolean) => void;
  onApprove: (item: CasePrincipleReviewItem) => void;
  onApproveCase: (ids: number[]) => void;
  onEdit: (item: CasePrincipleReviewItem) => void;
  onReject: (item: CasePrincipleReviewItem) => void;
}

interface CaseGroup {
  key: string;
  caseRef: CasePrincipleReviewItem['case'];
  items: CasePrincipleReviewItem[];
  unreviewedIds: number[];
}

function groupByCase(items: CasePrincipleReviewItem[]): CaseGroup[] {
  const map = new Map<string, CaseGroup>();
  for (const item of items) {
    const key = item.case ? `case-${item.case.id}` : 'unknown';
    let group = map.get(key);
    if (!group) {
      group = { key, caseRef: item.case, items: [], unreviewedIds: [] };
      map.set(key, group);
    }
    group.items.push(item);
    if (!item.reviewed) group.unreviewedIds.push(item.id);
  }
  return Array.from(map.values());
}

function PrincipleMeta({ item }: { item: CasePrincipleReviewItem }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {item.type && (
        <Badge variant="outline" className="capitalize">
          {item.type}
        </Badge>
      )}
      {item.tag && (
        <Badge variant="secondary" className="font-normal">
          {item.tag}
        </Badge>
      )}
      {item.law_type?.map((lt) => (
        <Badge key={lt} variant="outline" className="font-normal capitalize text-muted-foreground">
          {lt}
        </Badge>
      ))}
      {item.judge && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          {item.judge.name}
        </span>
      )}
    </div>
  );
}

function PrincipleRow({
  item,
  selected,
  isMutating,
  onToggleSelect,
  onApprove,
  onEdit,
  onReject,
}: {
  item: CasePrincipleReviewItem;
  selected: boolean;
  isMutating: boolean;
  onToggleSelect: (id: number) => void;
  onApprove: (item: CasePrincipleReviewItem) => void;
  onEdit: (item: CasePrincipleReviewItem) => void;
  onReject: (item: CasePrincipleReviewItem) => void;
}) {
  return (
    <div className="flex gap-3 p-3">
      {/* Selection (unreviewed only) */}
      <div className="pt-0.5">
        {item.reviewed ? (
          <span className="flex h-4 w-4 items-center justify-center">
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </span>
        ) : (
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(item.id)}
            aria-label="Select principle"
          />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.principle}</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PrincipleMeta item={item} />
          {item.reviewed ? (
            <span className="text-xs text-muted-foreground">
              {item.reviewed_by ? `Approved by ${item.reviewed_by.name}` : 'Approved'}
              {item.reviewed_at && ` · ${format(new Date(item.reviewed_at), 'MMM d, yyyy')}`}
            </span>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                onClick={() => onApprove(item)}
                disabled={isMutating}
              >
                <Check className="mr-1 h-4 w-4" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2"
                onClick={() => onEdit(item)}
                disabled={isMutating}
              >
                <Pencil className="mr-1 h-4 w-4" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-destructive hover:text-destructive"
                onClick={() => onReject(item)}
                disabled={isMutating}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Reject
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PrincipleReviewList({
  items,
  isLoading,
  selectedIds,
  isMutating,
  onToggleSelect,
  onSelectCase,
  onApprove,
  onApproveCase,
  onEdit,
  onReject,
}: PrincipleReviewListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        Nothing to review here
      </div>
    );
  }

  const groups = groupByCase(items);

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const selectedInGroup = group.unreviewedIds.filter((id) => selectedIds.has(id));
        const allSelected =
          group.unreviewedIds.length > 0 &&
          selectedInGroup.length === group.unreviewedIds.length;
        const someSelected = selectedInGroup.length > 0 && !allSelected;

        return (
          <div key={group.key} className="overflow-hidden rounded-lg border">
            {/* Case header */}
            <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                {group.unreviewedIds.length > 0 && (
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={() => onSelectCase(group.unreviewedIds, !allSelected)}
                    aria-label="Select all in case"
                  />
                )}
                <div className="min-w-0">
                  {group.caseRef ? (
                    <Link
                      href={`/admin/cases/${group.caseRef.slug}`}
                      className="block truncate text-sm font-semibold hover:underline"
                    >
                      {getCaseDisplayTitle(group.caseRef)}
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold text-muted-foreground">
                      Unknown case
                    </span>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {group.caseRef?.court && (
                      <span className="inline-flex items-center gap-1">
                        <Scale className="h-3 w-3" />
                        {group.caseRef.court}
                      </span>
                    )}
                    {group.caseRef?.country && <span>{group.caseRef.country}</span>}
                    <span>
                      {group.unreviewedIds.length} unreviewed · {group.items.length} total
                    </span>
                  </div>
                </div>
              </div>

              {group.unreviewedIds.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0"
                  onClick={() => onApproveCase(group.unreviewedIds)}
                  disabled={isMutating}
                >
                  <CheckCheck className="mr-1.5 h-4 w-4" />
                  Approve all
                </Button>
              )}
            </div>

            {/* Rows */}
            <div className="divide-y">
              {group.items.map((item) => (
                <PrincipleRow
                  key={item.id}
                  item={item}
                  selected={selectedIds.has(item.id)}
                  isMutating={isMutating}
                  onToggleSelect={onToggleSelect}
                  onApprove={onApprove}
                  onEdit={onEdit}
                  onReject={onReject}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
