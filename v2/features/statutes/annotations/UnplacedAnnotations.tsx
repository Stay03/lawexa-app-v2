'use client';

import { useState } from 'react';
import { ChevronDown, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import type { ReaderAnnotation } from './model';

/**
 * The reader's annotations that no longer have a place in the text: the
 * statute's words were edited, or the part was removed. Nothing is moved on
 * the reader's behalf (backend 814188e2, point 4); each is listed with its
 * words, to delete, or to make again by selecting the words anew.
 */
export function UnplacedAnnotations({
  annotations,
  onDelete,
}: {
  annotations: readonly ReaderAnnotation[];
  onDelete: (uuid: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (annotations.length === 0) return null;
  const count = annotations.length;

  return (
    <section className="mb-6 rounded-2xl bg-amber-500/10 text-[13px] text-amber-900 dark:text-amber-200">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn('v2-interactive flex w-full items-center gap-2 px-4 py-3 text-left', FOCUS_RING)}
      >
        <TriangleAlert aria-hidden className="size-4 shrink-0" />
        <span className="flex-1">
          {count === 1 ? '1 annotation' : `${count} annotations`} could not be placed, because the text changed.
        </span>
        <ChevronDown aria-hidden className={cn('size-4 shrink-0 transition-transform duration-150', open && 'rotate-180')} />
      </button>
      {open ? (
        <ul className="flex flex-col gap-3 px-4 pb-4">
          {annotations.map((annotation) => (
            <li key={annotation.uuid} className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-foreground">“{annotation.quote}”</p>
                {annotation.body ? <p className="mt-0.5 text-muted-foreground">{annotation.body}</p> : null}
              </div>
              <Button variant="outline" size="sm" onClick={() => onDelete(annotation.uuid)}>
                Delete
              </Button>
            </li>
          ))}
          <li className="text-muted-foreground">To keep one, select its words again and annotate them.</li>
        </ul>
      ) : null}
    </section>
  );
}
