'use client';

import { ArrowLeft, ListChecks, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CollabEmpty } from '@/v2/features/collab/kit/CollabEmpty';
import { CollabFailure } from '@/v2/features/collab/kit/CollabFailure';

/**
 * The Lists tab's states — index and detail, each at the geometry of the thing
 * it replaces, and the empty and the failure told apart by shape as well as by
 * words (the `CollabEmpty` / `CollabFailure` split).
 */

/** The card grid's reserved shape — same two columns, same card box. */
export function ListsIndexSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div aria-hidden className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {Array.from({ length: cards }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col gap-3 rounded-xl border bg-card p-3.5"
          style={{ opacity: Math.max(0.3, 1 - index * 0.2) }}
        >
          <div className="flex items-start gap-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5 rounded" />
              <Skeleton className="h-3 w-2/5 rounded" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-3 w-10 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A silent impression of two cards — the ghost above the empty copy. */
function ListsGhost() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[0, 1].map((card) => (
        <div key={card} className="flex flex-col gap-3 rounded-xl border bg-card p-3">
          <div className="flex items-start gap-3">
            <span className="size-8 shrink-0 rounded-full border-[3px] border-secondary" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <span className="block h-3 w-3/4 rounded bg-secondary" />
              <span className="block h-2.5 w-1/2 rounded bg-secondary/70" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <CollabEmpty
      icon={ListChecks}
      title="No lists yet"
      description="A shared task list keeps work visible to everyone in this channel — anyone can add, tick and reorder items."
      ghost={<ListsGhost />}
      action={
        <Button size="sm" onClick={onCreate}>
          <Plus aria-hidden className="size-4" />
          New list
        </Button>
      }
    />
  );
}

export function ListsErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <CollabFailure
      presentation="panel"
      title="Couldn't load lists"
      message={
        message?.trim() || 'Something went wrong on our side. Please try again.'
      }
      onRetry={onRetry}
    />
  );
}

/** The detail's reserved shape — header, ring, and three item rows. */
export function ListDetailSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 shrink-0 rounded-lg" />
        <Skeleton className="h-5 w-2/5 rounded" />
        <Skeleton className="ml-auto size-9 shrink-0 rounded-full" />
      </div>
      <div className="space-y-2 pt-1">
        {[0, 1, 2].map((index) => (
          <div key={index} style={{ opacity: Math.max(0.3, 1 - index * 0.25) }}>
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A deleted list, or one whose channel access was lost. A designed refusal
 * with a way back — never a redirect. `gone` and a genuine failure are told
 * apart because the reader's next move differs: retry, or go back.
 */
export function ListGoneState({
  gone,
  onRetry,
  onBack,
}: {
  gone: boolean;
  onRetry: () => void;
  onBack: () => void;
}) {
  if (gone) {
    return (
      <CollabEmpty
        icon={ListChecks}
        title="This list is no longer available"
        description="It may have been deleted, or you no longer have access to this channel."
        action={
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft aria-hidden className="size-4" />
            Back to lists
          </Button>
        }
      />
    );
  }
  return (
    <div className="flex flex-col items-center">
      <CollabFailure
        presentation="panel"
        title="Couldn't load this list"
        message="Something went wrong on our side. Please try again."
        onRetry={onRetry}
        className="pb-4"
      />
      {/* The second way out: retrying is the first thing to try, going back is
          the thing that always works. */}
      <Button variant="ghost" size="sm" className="mb-12" onClick={onBack}>
        <ArrowLeft aria-hidden className="size-4" />
        Back to lists
      </Button>
    </div>
  );
}
