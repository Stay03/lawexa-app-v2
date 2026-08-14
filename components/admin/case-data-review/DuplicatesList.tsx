'use client';

import { CopyCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { DuplicateGroupCard } from './DuplicateGroupCard';
import type { DuplicateGroup } from '@/types/admin-case-data-review';

interface DuplicatesListProps {
  groups: DuplicateGroup[];
  isLoading: boolean;
  emptyMessage: string;
}

export function DuplicatesList({
  groups,
  isLoading,
  emptyMessage,
}: DuplicatesListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3" aria-busy>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[260px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
        <CopyCheck className="h-6 w-6 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      {groups.map((group) => (
        <DuplicateGroupCard key={group.key} group={group} />
      ))}
    </div>
  );
}
