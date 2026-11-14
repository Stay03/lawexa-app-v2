'use client';

import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, VenetianMask } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { redactionDefaultApi } from '@/lib/api/redaction-default';
import { cn } from '@/lib/utils';
import { hiddenSummary, sameCategories, shortLabelsOf, toggleCategory, type ShortLabels } from '@/lib/utils/redaction-categories';
import { useV2Session } from '@/v2/runtime/session-context';
import type { RedactionCategory, RedactionDefaultResponse } from '@/types/redaction';

/** The person's saved choice of what a new redacted chat hides, per signed-in person. */
export const redactionDefaultQuery = (userId: number | null) =>
  queryOptions({
    queryKey: ['redaction-default', userId] as const,
    queryFn: redactionDefaultApi.get,
    staleTime: 5 * 60_000,
  });

/**
 * The server's short name for each kind ("phone numbers", "IDs"), for a line
 * or a pill that says what a chat hides. From the same cached answer as the
 * new-chat choice, so an open chat asks at most once. Empty until it answers.
 */
export function useRedactionShortLabels(enabled: boolean): ShortLabels {
  const { userId } = useV2Session();
  const saved = useQuery({ ...redactionDefaultQuery(userId), enabled: enabled && userId !== null });
  return saved.data ? shortLabelsOf(saved.data.data.options) : {};
}

/**
 * RedactionChoice — "What to hide", under the home box while redacted mode is
 * on for a new chat (Stay, 13 November 2026, thread cce2eafe: "only the 5").
 * One quiet line says what the chat will hide; "Change" opens the five kinds
 * as ticks (labels and explanations from the server), pre-ticked from the
 * person's saved default, with at least one kept on. "Save as my default" at
 * the foot saves the ticks for the next redacted chat. The choice is sent
 * with the first message and fixed for the chat's life.
 *
 * Nothing here takes typing: the box above stays the one place to type.
 */
export function RedactionChoice({
  userId,
  chosen,
  onChange,
  disabled,
}: {
  userId: number | null;
  /** The ticks for this chat; null until the saved default has answered. */
  chosen: RedactionCategory[] | null;
  onChange: (next: RedactionCategory[]) => void;
  disabled: boolean;
}) {
  const queryClient = useQueryClient();
  const saved = useQuery(redactionDefaultQuery(userId));
  const save = useMutation({
    mutationFn: (categories: RedactionCategory[]) => redactionDefaultApi.save(categories),
    onSuccess: (response: RedactionDefaultResponse) => queryClient.setQueryData(redactionDefaultQuery(userId).queryKey, response),
  });
  const options = saved.data?.data.options ?? [];
  const summary = chosen === null ? null : hiddenSummary(chosen, shortLabelsOf(options));
  const savedCategories = saved.data?.data.categories ?? null;
  const isSaved = chosen !== null && savedCategories !== null && sameCategories(chosen, savedCategories);

  return (
    <div className="flex min-w-0 items-center gap-1.5 px-3 pt-2 text-xs text-indigo-600 dark:text-indigo-400">
      <VenetianMask aria-hidden className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">
        {summary === null ? 'Redacted: loading what it hides…' : `Redacted: ${summary}`}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={disabled || chosen === null}
            className="v2-interactive flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            Change
            <ChevronDown aria-hidden className="size-3" />
          </button>
        </DropdownMenuTrigger>
        {/* Ends on the "Change" button and keeps a 16px gutter: on a phone it never runs off the screen. */}
        <DropdownMenuContent
          align="end"
          side="top"
          sideOffset={8}
          collisionPadding={16}
          className="w-80 max-w-[calc(100vw-2rem)]"
        >
          <DropdownMenuLabel>What to hide</DropdownMenuLabel>
          {options.map((option) => {
            const on = chosen?.includes(option.key) ?? false;
            const last = on && chosen?.length === 1;
            return (
              <DropdownMenuCheckboxItem
                key={option.key}
                checked={on}
                disabled={last}
                onCheckedChange={() => chosen && onChange(toggleCategory(chosen, option.key))}
                onSelect={(event) => event.preventDefault()}
                // The row under the pointer or the keyboard is a faint wash, lighter than a tick, and
                // none on a touch screen: a tap leaves no fill that reads as chosen.
                className="items-start focus:bg-muted/50 [@media(hover:none)]:focus:bg-transparent"
              >
                <span className="flex flex-col">
                  <span className="font-medium leading-tight">{option.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {last ? 'At least one kind stays hidden.' : option.description}
                  </span>
                </span>
              </DropdownMenuCheckboxItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={chosen === null || isSaved || save.isPending}
            onSelect={(event) => {
              event.preventDefault();
              if (chosen) save.mutate(chosen);
            }}
            className={cn('justify-between', isSaved && 'text-muted-foreground')}
          >
            {isSaved ? 'Saved as your default' : save.isPending ? 'Saving…' : 'Save as my default'}
          </DropdownMenuItem>
          {save.isError && (
            <p role="alert" className="px-2 pb-1.5 text-xs text-destructive">
              That did not save. Try again.
            </p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
