'use client';

import { useState } from 'react';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, IdCard, Landmark, Mail, MapPin, Phone, UserRound, VenetianMask, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DialogClose } from '@/components/ui/dialog';
import { redactionDefaultApi } from '@/lib/api/redaction-default';
import { cn } from '@/lib/utils';
import { hiddenCount, hiddenSummary, shortLabelsOf, toggleCategory, type ShortLabels } from '@/lib/utils/redaction-categories';
import { useV2Session } from '@/v2/runtime/session-context';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import type { RedactionCategory } from '@/types/redaction';
import { FitText } from './FitText';
import { LAST_KIND_NOTE } from './what-to-hide-copy';

/** The person's current choice of what a new redacted chat hides (the server's default), per signed-in person. */
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

/** Each kind's picture on its tile. */
const ICON: Readonly<Record<RedactionCategory, LucideIcon>> = {
  names: UserRound,
  addresses: MapPin,
  phones: Phone,
  emails: Mail,
  identity: IdCard,
  financial: Landmark,
};

/**
 * RedactionChoice — "What to hide", under the home box while redacted mode is
 * on for a new chat. One line says what the chat will hide (the names when
 * they fit the row, else a count: it never cuts off); "Change" opens the six
 * kinds as tiles in two columns (Stay's pick, V3, 14 November 2026, thread
 * cce2eafe), a sheet on a phone and a card on a computer, at least one kept
 * on.
 *
 * NOTHING IS SAVED HERE (Stay: "don't ask to save default. What ever the user
 * selects becomes their current default"). The ticks open on the person's
 * current default, are sent with the first message as `redaction_categories`,
 * and the server makes them the default when it creates the chat. The choice
 * is fixed for the chat's life.
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
  /** The ticks for this chat; null until the current default has answered. */
  chosen: RedactionCategory[] | null;
  onChange: (next: RedactionCategory[]) => void;
  disabled: boolean;
}) {
  const saved = useQuery(redactionDefaultQuery(userId));
  const [open, setOpen] = useState(false);
  const options = saved.data?.data.options ?? [];
  const summary = chosen === null ? null : hiddenSummary(chosen, shortLabelsOf(options));

  return (
    <div className="flex min-w-0 items-center gap-1.5 px-3 pt-2 text-xs text-indigo-600 dark:text-indigo-400">
      <VenetianMask aria-hidden className="size-3.5 shrink-0" />
      {/* Never cut off: the names when they fit the row, else the count (Techlead, 14 November 2026). */}
      {summary === null || chosen === null ? (
        <span className="min-w-0 flex-1">Redacted: loading what it hides…</span>
      ) : (
        <FitText className="flex-1" full={`Redacted: ${summary}`} short={`Redacted: ${hiddenCount(chosen)}`} />
      )}
      <button
        type="button"
        disabled={disabled || chosen === null}
        onClick={() => setOpen(true)}
        className="v2-interactive flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        Change
        <ChevronDown aria-hidden className="size-3" />
      </button>
      <ResponsiveOverlay
        open={open}
        onOpenChange={setOpen}
        // No paragraph under the title: the tiles say it (Stay, 14 November 2026).
        title="What to hide"
        size="content"
        // The page's 16px phone gutter (Techlead, 14 November 2026); the shared sheet's own is 8px.
        className="left-4 right-4"
        footer={
          <DialogClose asChild>
            <Button type="button" className="w-full md:w-auto">
              Done
            </Button>
          </DialogClose>
        }
      >
        <div role="group" aria-label="What to hide" className="grid grid-cols-2 gap-2">
          {options.map((option) => {
            const Icon = ICON[option.key];
            const on = chosen?.includes(option.key) ?? false;
            const last = on && chosen?.length === 1;
            return (
              <button
                key={option.key}
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-disabled={last || undefined}
                aria-describedby={last ? 'what-to-hide-last' : undefined}
                onClick={() => {
                  if (!chosen || last) return;
                  onChange(toggleCategory(chosen, option.key));
                }}
                className={cn(
                  'v2-interactive relative flex min-h-[4.5rem] flex-col items-start justify-between gap-2 rounded-2xl border p-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                  on ? 'border-primary/60 bg-primary/10' : 'border-border bg-transparent hover:bg-foreground/[0.04]',
                  last && 'cursor-default',
                )}
              >
                {Icon ? <Icon aria-hidden className={cn('size-5', on ? 'text-primary' : 'text-muted-foreground')} /> : <span />}
                <span className="pr-6 text-[14px] leading-snug font-medium text-foreground">{option.label}</span>
                <span className="absolute top-3 right-3">
                  <Mark on={on} />
                </span>
              </button>
            );
          })}
        </div>
        {chosen?.length === 1 ? (
          <p id="what-to-hide-last" className="mt-3 text-[13px] text-muted-foreground">
            {LAST_KIND_NOTE}
          </p>
        ) : null}
      </ResponsiveOverlay>
    </div>
  );
}

/** The Settings tick: a square, filled when on, so on and off read apart at a glance. */
function Mark({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-150 motion-reduce:transition-none',
        on ? 'border-primary bg-primary text-primary-foreground' : 'border-foreground/25 text-transparent',
      )}
    >
      <Check aria-hidden className={cn('size-3.5', !on && 'invisible')} strokeWidth={3} />
    </span>
  );
}
