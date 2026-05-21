'use client';

import { usePathname } from 'next/navigation';
import { Shield, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useConfidentialModeStore } from '@/lib/stores/confidentialModeStore';
import { cn } from '@/lib/utils';

interface ConfidentialModeToggleProps {
  // When true, render a compact full-width row variant for the mobile kebab popover.
  variant?: 'icon' | 'menu-item';
}

export function ConfidentialModeToggle({ variant = 'icon' }: ConfidentialModeToggleProps) {
  const pathname = usePathname();
  const isPending = useConfidentialModeStore((s) => s.isPending);
  const togglePending = useConfidentialModeStore((s) => s.togglePending);
  const isConfidential = useConfidentialModeStore((s) => s.isConfidential);

  const conversationId = pathname.startsWith('/c/') ? pathname.split('/')[2] : null;
  const conversationIsConfidential = isConfidential(conversationId);

  // On the home page, the toggle controls the pending flag for the next chat.
  // On a confidential conversation page, the icon is a read-only indicator.
  // On a non-confidential conversation page, hide the toggle entirely (per
  // contract, the flag is immutable mid-conversation).
  const onHome = pathname === '/';
  const onConversation = pathname.startsWith('/c/');

  if (onConversation && !conversationIsConfidential) return null;

  const active = onHome ? isPending : conversationIsConfidential;
  const interactive = onHome;

  const Icon = active ? ShieldCheck : Shield;
  const label = active
    ? 'Confidential mode is on — messages are not stored on our servers'
    : 'Turn on Confidential Chat — your messages will not be stored';

  const handleClick = () => {
    if (interactive) togglePending();
  };

  if (variant === 'menu-item') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={!interactive}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          active && 'text-emerald-600 dark:text-emerald-500',
          !interactive && 'cursor-default opacity-90',
        )}
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1 text-left">
          {active ? 'Confidential Chat: On' : 'Confidential Chat'}
        </span>
      </button>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClick}
            disabled={!interactive}
            aria-pressed={active}
            aria-label={label}
            className={cn(
              'relative h-8 w-8 transition-colors',
              active
                ? 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-500'
                : 'text-muted-foreground hover:text-foreground',
              !interactive && 'cursor-default',
            )}
          >
            <Icon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[220px] text-center">
          <p className="text-xs">
            {active
              ? 'Confidential — messages are not stored. Closing the tab ends the chat.'
              : 'Confidential Chat — your messages will not be stored on our servers.'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
