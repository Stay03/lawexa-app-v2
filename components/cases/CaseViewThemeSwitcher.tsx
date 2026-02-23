'use client';

import { useState, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/lib/hooks/useAuth';
import { useCaseViewTheme } from '@/lib/hooks/useCaseViewTheme';
import { cn } from '@/lib/utils';
import type { CaseViewTheme } from '@/lib/stores/caseViewThemeStore';

const THEMES: Array<{ value: CaseViewTheme; label: string }> = [
  { value: 'default', label: 'Default' },
  { value: 'blog', label: 'Blog' },
];

/**
 * Superadmin-only dropdown to switch the case view page theme.
 * Returns null for non-superadmin users.
 */
function CaseViewThemeSwitcher() {
  const [mounted, setMounted] = useState(false);
  const { user } = useAuth();
  const { caseViewTheme, setCaseViewTheme } = useCaseViewTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Only visible to superadmin
  if (!user || user.role !== 'superadmin') return null;
  if (!mounted) return null;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'transition-colors',
                caseViewTheme !== 'default' && 'bg-primary/10 text-primary'
              )}
              aria-label="Case view theme"
            >
              <Palette className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Case View Theme</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Case View Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map((theme) => (
          <DropdownMenuItem
            key={theme.value}
            onClick={() => setCaseViewTheme(theme.value)}
            className="gap-2"
          >
            <Check
              className={cn(
                'h-4 w-4',
                caseViewTheme === theme.value ? 'opacity-100' : 'opacity-0'
              )}
            />
            {theme.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { CaseViewThemeSwitcher };
