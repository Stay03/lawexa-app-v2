'use client';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WorkflowOption } from './useWorkflowSelection';

/**
 * WorkflowField — the composer's role-aware workflow selector, now PRESENTATIONAL:
 * all state (role branch, admin fetch, options, default, override) lives in
 * `useWorkflowSelection`, which the composer owns so the resolved workflow id also
 * reaches the SUBMIT payload. This component only renders the current selection
 * (studied from v1's `app/(main)/page.tsx`):
 *
 *  - a skeleton chip while the admin catalogue loads (skeleton-first rule);
 *  - nothing when there are no options (v1 hides the selector);
 *  - otherwise the Select, cross-fading in.
 */

const TRIGGER_CLASS =
  'v2-interactive h-8 shrink-0 gap-1 rounded-full border-none bg-transparent px-2.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&>span]:truncate';

interface WorkflowFieldProps {
  options: WorkflowOption[];
  value: string;
  onChange: (next: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  /** Keep clicks inside portaled content from bubbling to PromptInput's root. */
  stop: (event: React.SyntheticEvent) => void;
}

export function WorkflowField({
  options,
  value,
  onChange,
  isLoading,
  disabled,
  stop,
}: WorkflowFieldProps) {
  // Admin list still loading → a skeleton chip in place of the Select.
  if (isLoading) {
    return <Skeleton className="h-8 w-24 shrink-0 rounded-full" />;
  }

  // Empty (loaded) catalogue → nothing to select (v1 hides it).
  if (options.length === 0) return null;

  return (
    <div className="shrink-0 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          size="sm"
          onClick={stop}
          aria-label="Workflow"
          className={cn(TRIGGER_CLASS, 'max-w-[9rem]')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent onClick={stop}>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
