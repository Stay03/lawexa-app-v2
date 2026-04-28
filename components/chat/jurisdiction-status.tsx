'use client';

import { useMemo, useState } from 'react';
import { RotateCcw, ChevronDown } from 'lucide-react';

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
  triggerClassName?: string;
  disabled?: boolean;
}

// Backend's documented default fallback when profile country is unknown.
const DEFAULT_FALLBACK_SLUG = 'nigeria';

export function JurisdictionStatus({
  value,
  onChange,
  className,
  triggerClassName,
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
            title={display.tooltip}
            aria-label={display.tooltip}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1',
              'text-foreground/80 hover:bg-muted hover:text-foreground transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isOverridden && 'border-primary/50 bg-primary/5 text-foreground',
              triggerClassName,
            )}
          >
            <span className="font-medium">Jurisdiction:</span>
            {display.value}
            <ChevronDown className="size-3 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-[320px] p-2"
          // React synthetic events bubble through the React tree even from
          // portaled content. PromptInput's root div listens for onClick
          // and refocuses its textarea, which Radix interprets as
          // focus-outside and closes the popover. Stop propagation here
          // so events inside the picker stay inside.
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
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
      value: <span className="font-medium">None</span>,
      tooltip: 'Jurisdiction: None (comparative)',
    };
  }

  const j = choice.mode === 'override' ? overrideMatch : autoMatch;
  const code = jurisdictionFlagCode(j);
  const name = j?.name ?? (choice.mode === 'override' ? choice.slug : 'Loading…');
  return {
    value: <JurisdictionFlag code={code} />,
    tooltip: `Jurisdiction: ${name}`,
  };
}
