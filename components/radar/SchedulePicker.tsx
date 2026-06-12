'use client';

import { useState, useSyncExternalStore } from 'react';
import { Clock, Coins } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUserLimits } from '@/lib/hooks/useUserLimits';
import {
  DEFAULT_BUILDER_STATE,
  builderToCron,
  cronToBuilder,
  describeCron,
  estimateScansPerMonth,
  parseCronExpression,
  type ScheduleBuilderState,
  type ScheduleFrequency,
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

const FREQUENCY_OPTIONS: { value: ScheduleFrequency; label: string }[] = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays (Mon–Fri)' },
  { value: 'weekly', label: 'Once a week' },
  { value: 'monthly', label: 'Once a month' },
];

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

function ordinal(day: number): string {
  if (day >= 11 && day <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

const MONTH_DAY_OPTIONS = Array.from({ length: 28 }, (_, index) => index + 1);

// A coarse clock for the "current time" confirmation line. Time is external
// mutable state, so it's read through useSyncExternalStore to keep renders
// pure; the snapshot is quantized so it only changes once per tick.
const CLOCK_TICK_MS = 30_000;

function subscribeToClock(onTick: () => void): () => void {
  const id = setInterval(onTick, CLOCK_TICK_MS);
  return () => clearInterval(id);
}

function useNowMs(): number {
  return useSyncExternalStore(
    subscribeToClock,
    () => Math.floor(Date.now() / CLOCK_TICK_MS) * CLOCK_TICK_MS,
    () => 0
  );
}

function formatTimeIn(nowMs: number, timeZone: string): string | null {
  if (nowMs === 0) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone,
    }).format(new Date(nowMs));
  } catch {
    return null;
  }
}

/**
 * Billing copy for the schedule's firing rate. Sparse schedules (fewer than
 * one scan a month) are stated per year rather than rounded up to 1/month.
 */
function formatScanRate(scansPerMonth: number | null): React.ReactNode {
  if (scansPerMonth === null) {
    return <>Each scan uses 1 AI message — exactly like a chat turn</>;
  }
  if (scansPerMonth === 0) {
    return <>This schedule never runs — check the day and month combination</>;
  }
  if (scansPerMonth < 1) {
    const perYear = Math.round(scansPerMonth * 12);
    return (
      <>
        ≈ <span className="font-medium text-foreground">{perYear}</span>{' '}
        {perYear === 1 ? 'scan' : 'scans'}/year · each scan uses 1 AI message
      </>
    );
  }
  const perMonth = Math.round(scansPerMonth);
  return (
    <>
      ≈ <span className="font-medium text-foreground">{perMonth}</span>{' '}
      {perMonth === 1 ? 'scan' : 'scans'}/month · each scan uses 1 AI message
    </>
  );
}

/**
 * Schedule selection without cron literacy: a frequency + day + time builder
 * that writes the cron expression behind the scenes, a current-time line so
 * the user confirms (rather than hunts for) their timezone, and an
 * always-visible billing estimate. A raw cron input remains available as a
 * discreet advanced option and is forced on for expressions the builder
 * can't represent.
 */
function SchedulePicker({ value, onChange }: SchedulePickerProps) {
  const builder = cronToBuilder(value.cron);
  const [advancedToggled, setAdvancedToggled] = useState(false);
  const advanced = advancedToggled || builder === null;

  const [editingTimezone, setEditingTimezone] = useState(false);
  const [timezoneSearch, setTimezoneSearch] = useState('');
  const { data: limitsData } = useUserLimits();

  const nowMs = useNowMs();
  const localTime = formatTimeIn(nowMs, value.timezone);

  const cronIsValid = parseCronExpression(value.cron) !== null;
  const cronSummary = describeCron(value.cron);
  const scansPerMonth = estimateScansPerMonth(value.cron);
  const messagesRemaining = limitsData?.data?.ai_messages.total_remaining ?? null;

  const updateBuilder = (patch: Partial<ScheduleBuilderState>) => {
    const next = { ...(builder ?? DEFAULT_BUILDER_STATE), ...patch };
    onChange({ ...value, cron: builderToCron(next) });
  };

  const filteredTimezones = timezoneSearch.trim()
    ? TIMEZONES.filter((timezone) =>
        timezone.toLowerCase().includes(timezoneSearch.trim().toLowerCase())
      )
    : TIMEZONES;

  return (
    <div className="space-y-4">
      {!advanced && builder && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="radar-frequency">How often</Label>
            <Select
              value={builder.frequency}
              onValueChange={(frequency) =>
                updateBuilder({ frequency: frequency as ScheduleFrequency })
              }
            >
              <SelectTrigger id="radar-frequency" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {builder.frequency === 'weekly' && (
            <div className="space-y-1.5">
              <Label htmlFor="radar-weekday">On</Label>
              <Select
                value={String(builder.weekday)}
                onValueChange={(weekday) =>
                  updateBuilder({ weekday: Number(weekday) })
                }
              >
                <SelectTrigger id="radar-weekday" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {builder.frequency === 'monthly' && (
            <div className="space-y-1.5">
              <Label htmlFor="radar-month-day">On the</Label>
              <Select
                value={String(builder.monthDay)}
                onValueChange={(monthDay) =>
                  updateBuilder({ monthDay: Number(monthDay) })
                }
              >
                <SelectTrigger id="radar-month-day" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_DAY_OPTIONS.map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      {ordinal(day)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="radar-time">At</Label>
            <Input
              id="radar-time"
              type="time"
              value={builder.time}
              onChange={(event) => {
                if (event.target.value) updateBuilder({ time: event.target.value });
              }}
              className="w-32"
            />
          </div>
        </div>
      )}

      {advanced && (
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

      <button
        type="button"
        className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        onClick={() => {
          if (advanced) {
            // Returning to the builder from an unrepresentable expression
            // deliberately resets to the default daily schedule.
            if (builder === null) {
              onChange({ ...value, cron: builderToCron(DEFAULT_BUILDER_STATE) });
            }
            setAdvancedToggled(false);
          } else {
            setAdvancedToggled(true);
          }
        }}
      >
        {advanced ? 'Switch to simple schedule' : 'Use a cron expression instead'}
      </button>

      <div className="space-y-2 rounded-lg border px-3.5 py-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <Clock className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">
            Your current time:{' '}
            <span className="font-medium text-foreground">
              {localTime ?? '—'}
            </span>{' '}
            · {value.timezone.replace(/_/g, ' ')}
          </span>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() => {
              setEditingTimezone((editing) => !editing);
              setTimezoneSearch('');
            }}
          >
            {editingTimezone ? 'Done' : 'Wrong? Change it'}
          </Button>
        </div>

        {editingTimezone && (
          <Combobox
            value={value.timezone}
            onValueChange={(timezone) => {
              if (typeof timezone === 'string' && timezone) {
                onChange({ ...value, timezone });
                setEditingTimezone(false);
              }
              setTimezoneSearch('');
            }}
          >
            <ComboboxInput
              placeholder="Search timezones…"
              value={timezoneSearch}
              onChange={(event) => setTimezoneSearch(event.target.value)}
              autoFocus
            />
            <ComboboxContent>
              <ComboboxList>
                {filteredTimezones.slice(0, 50).map((timezone) => (
                  <ComboboxItem key={timezone} value={timezone}>
                    {timezone.replace(/_/g, ' ')}
                  </ComboboxItem>
                ))}
                {filteredTimezones.length === 0 && (
                  <ComboboxEmpty>No timezones found</ComboboxEmpty>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        )}

        <p className="text-xs text-muted-foreground">
          Scans run on this clock — if the time above looks right, you&apos;re
          set.
        </p>
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 px-3.5 py-3 text-sm">
        <Coins className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground">
          {formatScanRate(scansPerMonth)}
          {messagesRemaining !== null && (
            <> · you have {messagesRemaining} messages remaining</>
          )}
        </p>
      </div>
    </div>
  );
}

export { SchedulePicker };
