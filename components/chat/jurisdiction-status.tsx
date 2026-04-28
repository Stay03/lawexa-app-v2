'use client';

import { useMemo, useState } from 'react';
import { Layers, RotateCcw, ChevronDown } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/authStore';
import { useJurisdictions, findDefaultJurisdiction } from '@/lib/hooks/useJurisdictions';
import { JurisdictionPicker } from '@/components/chat/jurisdiction-picker';
import { JurisdictionFlag, jurisdictionFlagCode } from '@/components/chat/jurisdiction-flag';
import type { Jurisdiction, JurisdictionChoice } from '@/types/jurisdiction';

interface JurisdictionStatusProps {
  value: JurisdictionChoice;
  onChange: (next: JurisdictionChoice) => void;
  className?: string;
  disabled?: boolean;
}

// Backend's documented default fallback when profile country is unknown.
const DEFAULT_FALLBACK_SLUG = 'nigeria';

export function JurisdictionStatus({
  value,
  onChange,
  className,
  disabled,
}: JurisdictionStatusProps) {
  const [open, setOpen] = useState(false);
  const profileCountry = useAuthStore((s) => s.user?.profile?.country);
  const { data: jurisdictions, isLoading } = useJurisdictions();

  // What the user is *effectively* researching as for the auto path:
  // profile country → backend default fallback (Nigeria).
  const autoMatch = useMemo<Jurisdiction | undefined>(() => {
    const fromProfile = findDefaultJurisdiction(jurisdictions, profileCountry);
    if (fromProfile) return fromProfile;
    return jurisdictions?.find((j) => j.slug === DEFAULT_FALLBACK_SLUG);
  }, [jurisdictions, profileCountry]);

  const overrideMatch = useMemo<Jurisdiction | undefined>(() => {
    if (value.mode !== 'override') return undefined;
    return jurisdictions?.find((j) => j.slug === value.slug);
  }, [jurisdictions, value]);

  const display = renderDisplay({ choice: value, autoMatch, overrideMatch });
  const isOverridden = value.mode !== 'auto';

  return (
    <div className={cn('flex items-center gap-1.5 text-xs', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1',
              'text-foreground/80 hover:bg-muted hover:text-foreground transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isOverridden && 'border-primary/50 bg-primary/5 text-foreground',
            )}
            aria-label={`Jurisdiction: ${display.label}`}
          >
            {display.icon}
            <span className="truncate max-w-[200px] font-medium">{display.label}</span>
            <ChevronDown className="size-3 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-[320px] p-2"
        >
          <JurisdictionPicker
            jurisdictions={jurisdictions ?? []}
            value={value}
            onChange={(next) => {
              onChange(next);
              setOpen(false);
            }}
            isLoading={isLoading}
          />
        </PopoverContent>
      </Popover>

      {isOverridden && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onChange({ mode: 'auto' })}
          aria-label="Reset jurisdiction to default"
        >
          <RotateCcw className="size-3" />
        </Button>
      )}
    </div>
  );
}

function renderDisplay(args: {
  choice: JurisdictionChoice;
  autoMatch: Jurisdiction | undefined;
  overrideMatch: Jurisdiction | undefined;
}) {
  const { choice, autoMatch, overrideMatch } = args;

  if (choice.mode === 'none') {
    return {
      icon: <Layers className="size-3.5 text-muted-foreground" />,
      label: 'No jurisdiction',
    };
  }

  const j = choice.mode === 'override' ? overrideMatch : autoMatch;
  const code = jurisdictionFlagCode(j);
  return {
    icon: <JurisdictionFlag code={code} />,
    label: j?.name ?? (choice.mode === 'override' ? choice.slug : 'Loading…'),
  };
}
