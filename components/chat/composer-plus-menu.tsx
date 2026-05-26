'use client';

import { useState } from 'react';
import { Plus, Paperclip, VenetianMask } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { FileUploadTrigger } from '@/components/ui/file-upload';
import { cn } from '@/lib/utils';

interface ComposerPlusMenuProps {
  // Pending redacted-mode toggle (home-page only). On an active conversation
  // this becomes a read-only badge — the flag is immutable after turn 1.
  isRedactedPending: boolean;
  onRedactedToggle: () => void;
  // True when the menu is rendered inside a conversation whose redacted flag
  // is already set on the server. The toggle row becomes locked + on.
  isRedactedLocked?: boolean;
  // Compact (28px) trigger for the in-conversation composer; default (32px)
  // matches the home page composer.
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export function ComposerPlusMenu({
  isRedactedPending,
  onRedactedToggle,
  isRedactedLocked = false,
  size = 'md',
  disabled = false,
}: ComposerPlusMenuProps) {
  const [open, setOpen] = useState(false);

  const redactedActive = isRedactedLocked || isRedactedPending;
  const triggerSize = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="More actions"
          aria-pressed={redactedActive || undefined}
          className={cn(
            'relative flex shrink-0 cursor-pointer items-center justify-center rounded-2xl transition-colors',
            'hover:bg-secondary-foreground/10',
            'disabled:cursor-not-allowed disabled:opacity-50',
            triggerSize,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Plus className={cn('text-primary transition-transform', iconSize, open && 'rotate-45')} />
          {redactedActive && (
            <span
              className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-indigo-500 ring-2 ring-background"
              aria-hidden
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={10}
        className="w-64 p-1.5 gap-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Attach — delegates to the existing FileUpload context. Closes the
            menu before opening the file picker so the popover doesn't linger. */}
        <FileUploadTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={() => setOpen(false)}
          >
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-left">Attach file</span>
          </button>
        </FileUploadTrigger>

        <div className="my-1 h-px bg-border" aria-hidden />

        {/* Redacted mode toggle. Sticky after first turn — disabled with a
            locked-on visual on existing redacted conversations. The row is a
            clickable div (not a button) so the nested Switch — itself a
            button — produces valid HTML. */}
        <div
          role={isRedactedLocked ? undefined : 'button'}
          tabIndex={isRedactedLocked ? undefined : -1}
          aria-pressed={isRedactedLocked ? undefined : redactedActive}
          onClick={() => {
            if (!isRedactedLocked) onRedactedToggle();
          }}
          className={cn(
            'flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors select-none',
            !isRedactedLocked && 'hover:bg-accent hover:text-accent-foreground cursor-pointer',
            isRedactedLocked && 'cursor-default',
          )}
        >
          <VenetianMask
            className={cn(
              'mt-0.5 h-4 w-4 shrink-0',
              redactedActive ? 'text-indigo-500' : 'text-muted-foreground',
            )}
          />
          <span className="flex-1 text-left">
            <span className="block font-medium leading-tight">Redacted mode</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {isRedactedLocked
                ? 'Locked on for this conversation'
                : 'Hide names, addresses & IDs from the model'}
            </span>
          </span>
          <Switch
            checked={redactedActive}
            disabled={isRedactedLocked}
            onCheckedChange={() => {
              if (!isRedactedLocked) onRedactedToggle();
            }}
            aria-label="Redacted mode"
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
