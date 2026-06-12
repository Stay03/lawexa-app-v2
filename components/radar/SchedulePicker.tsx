'use client';

import { useState } from 'react';
import { Coins, Globe, SlidersHorizontal } from 'lucide-react';

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUserLimits } from '@/lib/hooks/useUserLimits';
import { cn } from '@/lib/utils';
import {
  SCHEDULE_PRESETS,
  describeCron,
  estimateScansPerMonth,
  matchPreset,
  parseCronExpression,
} from '@/lib/utils/cron';

export interface ScheduleValue {
  cron: string;
  timezone: string;
}

interface SchedulePickerProps {
  value: ScheduleValue;
  onChange: (value: ScheduleValue) => void;
}

const TIMEZONES = Intl.supportedValuesOf('timeZone');

function OptionCard({
  selected,
  onSelect,
  title,
  subtitle,
}: {
  selected: boolean;
  onSelect: () => void;
  title: React.ReactNode;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-selected={selected}
      className={cn(
        'rounded-xl border p-3 text-left transition-colors',
        'hover:border-primary/40 hover:bg-muted/40',
        'data-[selected=true]:border-primary data-[selected=true]:bg-primary/5'
      )}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">
        {subtitle}
      </span>
    </button>
  );
}

/**
 * Schedule selection: human presets first, raw cron as the advanced option,
 * a timezone picker, and an always-visible billing line (every scan debits
 * one AI message).
 */
function SchedulePicker({ value, onChange }: SchedulePickerProps) {
  const [isCustom, setIsCustom] = useState(() => matchPreset(value.cron) === null);
  const [timezoneSearch, setTimezoneSearch] = useState('');
  const [isTimezoneSearching, setIsTimezoneSearching] = useState(false);
  const { data: limitsData } = useUserLimits();

  const selectedPreset = isCustom ? null : matchPreset(value.cron);
  const cronIsValid = parseCronExpression(value.cron) !== null;
  const cronSummary = describeCron(value.cron);
  const scansPerMonth = estimateScansPerMonth(value.cron);
  const messagesRemaining = limitsData?.data?.ai_messages.total_remaining ?? null;

  const filteredTimezones = isTimezoneSearching
    ? TIMEZONES.filter((timezone) =>
        timezone.toLowerCase().includes(timezoneSearch.trim().toLowerCase())
      )
    : TIMEZONES;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SCHEDULE_PRESETS.map((preset) => (
          <OptionCard
            key={preset.id}
            selected={selectedPreset === preset.id}
            onSelect={() => {
              setIsCustom(false);
              onChange({ ...value, cron: preset.cron });
            }}
            title={preset.label}
            subtitle={preset.sublabel}
          />
        ))}
        <OptionCard
          selected={isCustom}
          onSelect={() => setIsCustom(true)}
          title={
            <span className="inline-flex items-center gap-1.5">
              <SlidersHorizontal className="size-3.5" />
              Custom
            </span>
          }
          subtitle="Write a cron expression"
        />
      </div>

      {isCustom && (
        <div className="space-y-1.5">
          <Label htmlFor="radar-custom-cron">Cron expression</Label>
          <Input
            id="radar-custom-cron"
            value={value.cron}
            onChange={(event) => onChange({ ...value, cron: event.target.value })}
            placeholder="0 18 * * *"
            className="font-mono"
            aria-invalid={!cronIsValid}
          />
          {cronIsValid ? (
            <p className="text-xs text-muted-foreground">
              {cronSummary ?? (
                <>
                  Custom schedule — <code className="font-mono">{value.cron}</code>
                </>
              )}
            </p>
          ) : (
            <p className="text-xs text-destructive">
              Enter a valid 5-field cron expression (minute hour day month
              weekday)
            </p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="radar-timezone">Timezone</Label>
        <Combobox
          value={value.timezone}
          onValueChange={(timezone) => {
            if (typeof timezone === 'string' && timezone) {
              onChange({ ...value, timezone });
            }
            setTimezoneSearch('');
            setIsTimezoneSearching(false);
          }}
        >
          <ComboboxInput
            id="radar-timezone"
            placeholder="Search timezones…"
            value={isTimezoneSearching ? timezoneSearch : value.timezone}
            onChange={(event) => {
              setIsTimezoneSearching(true);
              setTimezoneSearch(event.target.value);
            }}
            onFocus={() => {
              setIsTimezoneSearching(true);
              setTimezoneSearch('');
            }}
            onBlur={() => {
              setIsTimezoneSearching(false);
              setTimezoneSearch('');
            }}
          />
          <ComboboxContent>
            <ComboboxList>
              {filteredTimezones.slice(0, 50).map((timezone) => (
                <ComboboxItem key={timezone} value={timezone}>
                  <Globe className="text-muted-foreground" />
                  {timezone}
                </ComboboxItem>
              ))}
              {filteredTimezones.length === 0 && (
                <ComboboxEmpty>No timezones found</ComboboxEmpty>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <p className="text-xs text-muted-foreground">
          The schedule runs in this timezone.
        </p>
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 px-3.5 py-3 text-sm">
        <Coins className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground">
          {scansPerMonth !== null ? (
            <>
              ≈ <span className="font-medium text-foreground">{scansPerMonth}</span>{' '}
              {scansPerMonth === 1 ? 'scan' : 'scans'}/month · each scan uses 1 AI
              message
            </>
          ) : (
            <>Each scan uses 1 AI message — exactly like a chat turn</>
          )}
          {messagesRemaining !== null && (
            <> · you have {messagesRemaining} messages remaining</>
          )}
        </p>
      </div>
    </div>
  );
}

export { SchedulePicker };
