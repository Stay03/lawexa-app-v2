'use client';

import { Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Dictate, in Send's place while a message box is empty (design A2). One
 * button for every message box that dictates (Arthur, 26 November 2026,
 * thread ce4eb347: the chat page, the homepage, Space channels and threads,
 * the agent panel), so each looks and reads the same. The box shows it only
 * when `canDictate` (the session's `user.can_dictate`) is true.
 */
export function DictateButton({
  onStart,
  disabled = false,
  className,
}: {
  onStart: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label="Dictate"
      onClick={(event) => {
        event.stopPropagation();
        onStart();
      }}
      disabled={disabled}
      className={cn(
        'v2-interactive text-foreground hover:bg-secondary focus-visible:ring-ring flex size-8 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <Mic aria-hidden className="size-4" />
    </button>
  );
}
