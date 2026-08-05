'use client';

import { Paperclip, SearchX, Upload } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CollabEmpty } from '@/v2/features/collab/kit/CollabEmpty';
import { CollabFailure } from '@/v2/features/collab/kit/CollabFailure';
import { FileMarkSkeleton } from './FileMark';

/**
 * The Files tab's three states, each designed as itself.
 *
 * THE EMPTY STATE IS THE DROP ZONE. A file library with nothing in it has
 * exactly one job — teach the two ways to fill it — so the panel itself
 * becomes the target: a dashed field that warms to gold while a drag is over
 * the tab, with the picker button inside it. That is the same affordance the
 * populated list has (drop anywhere), made visible at the one moment the
 * reader has no other clue it exists.
 */

/** One skeleton row at `FileRow`'s exact geometry — mark, name, meta line. */
function FileRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-2 py-2.5">
      <FileMarkSkeleton />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-2/5 rounded" />
        <Skeleton className="h-3 w-32 max-w-[60%] rounded" />
      </div>
      <Skeleton className="h-3 w-8 shrink-0 rounded" />
    </div>
  );
}

/**
 * The library's reserved shape. It reproduces the REAL structure the tab
 * renders — `gap-4` sections, each led by an 11px uppercase date heading — and
 * not a flat run of rows, because a flat skeleton under a sectioned list jumps
 * the whole column by a heading's height per group at the swap. Two groups is
 * the honest average: a channel's files are usually a recent handful plus
 * older ones.
 *
 * The type-filter strip is deliberately NOT reserved here. It appears only for
 * a library big enough to need it, so reserving it would be wrong more often
 * than right; the tab instead grows it with the shared grid-rows collapse, so
 * its arrival is a 200ms open rather than a snap.
 */
const SKELETON_GROUPS: readonly number[] = [2, 2];

export function FilesSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      {SKELETON_GROUPS.map((rows, group) => {
        // Derived, not accumulated in a mutable counter: nothing in render may
        // depend on the order React calls it in.
        const offset = SKELETON_GROUPS.slice(0, group).reduce(
          (total, count) => total + count,
          0,
        );
        return (
          <div key={group}>
            <div className="px-2 pb-1">
              <Skeleton className="h-3 w-16 rounded" />
            </div>
            <div className="flex flex-col">
              {Array.from({ length: rows }).map((_, index) => (
                <div
                  key={index}
                  style={{ opacity: Math.max(0.3, 1 - (offset + index) * 0.18) }}
                >
                  <FileRowSkeleton />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Nothing here yet — and the panel is the way to change that. */
export function FilesEmptyState({
  dragging,
  onUpload,
}: {
  /** A drag is over the tab: the field answers so the target is unmistakable. */
  dragging: boolean;
  onUpload: () => void;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border-2 border-dashed transition-colors duration-200 motion-reduce:transition-none',
        dragging ? 'border-primary/60 bg-primary/5' : 'border-border',
      )}
    >
      <CollabEmpty
        icon={Paperclip}
        title="No files yet"
        description="Share documents with everyone in this channel. Drop them anywhere on this tab, or pick them from your device."
        action={
          <Button size="sm" onClick={onUpload}>
            <Upload aria-hidden className="size-4" />
            Upload a file
          </Button>
        }
        footnote="PDFs, documents, sheets, slides, images and zips, up to 15 MB each."
        className="pb-10 pt-8"
      />
    </div>
  );
}

/** The library is fine — this TYPE filter is empty. A different state from
 *  "no files", because the reader has not lost anything. */
export function FilesNoMatchState({ onReset }: { onReset: () => void }) {
  return (
    <CollabEmpty
      icon={SearchX}
      title="Nothing of that type"
      description="This channel has files, just none in the type you picked."
      action={
        <Button variant="outline" size="sm" onClick={onReset}>
          Show all files
        </Button>
      }
    />
  );
}

/** The load failed with nothing cached to keep on screen. */
export function FilesErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <CollabFailure
      presentation="panel"
      title="Couldn't load files"
      message={
        message?.trim() || 'Something went wrong on our side. Please try again.'
      }
      onRetry={onRetry}
    />
  );
}
