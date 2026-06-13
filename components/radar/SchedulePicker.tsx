'use client';

import { useState, useSyncExternalStore } from 'react';
import { Clock } from 'lucide-react';

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
 * Schedule selection without cron literacy: a frequency + day + time builder
 * that writes the cron expression behind the scenes and a current-time line
 * so the user confirms (rather than hunts for) their timezone. A raw cron
 * input is shown only as an automatic fallback for an existing expression the
 * builder can't represent — there's no manual switch into it.
 */
function SchedulePicker({ value, onChange }: SchedulePickerProps) {
  const builder = cronToBuilder(value.cron);
  const advanced = builder === null;

  const [editingTimezone, setEditingTimezone] = useState(false);
  const [timezoneSearch, setTimezoneSearch] = useState('');
  const { data: limitsData } = useUserLimits();

  const nowMs = useNowMs();
  const localTime = formatTimeIn(nowMs, value.timezone);

  const cronIsValid = parseCronExpression(value.cron) !== null;
  const cronSummary = describeCron(value.cron);
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
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-muted-foreground">
          <span>Run</span>
          <Select
            value={builder.frequency}
            onValueChange={(frequency) =>
              updateBuilder({ frequency: frequency as ScheduleFrequency })
            }
          >
            <SelectTrigger aria-label="How often" className="w-44 shrink-0">
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

          {builder.frequency === 'weekly' && (
            <>
              <span>on</span>
              <Select
                value={String(builder.weekday)}
                onValueChange={(weekday) =>
                  updateBuilder({ weekday: Number(weekday) })
                }
              >
                <SelectTrigger aria-label="Day of the week" className="w-36 shrink-0">
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
            </>
          )}

          {builder.frequency === 'monthly' && (
            <>
              <span>on the</span>
              <Select
                value={String(builder.monthDay)}
                onValueChange={(monthDay) =>
                  updateBuilder({ monthDay: Number(monthDay) })
                }
              >
                <SelectTrigger aria-label="Day of the month" className="w-24 shrink-0">
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
            </>
          )}

          <span>at</span>
          <Input
            aria-label="Time of day"
            type="time"
            value={builder.time}
            onChange={(event) => {
              if (event.target.value) updateBuilder({ time: event.target.value });
            }}
            className="w-32 shrink-0"
          />
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

      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
        <Clock className="size-3.5 shrink-0" />
        <span>
          Your current time —{' '}
          <span className="font-medium text-foreground">{localTime ?? '—'}</span>{' '}
          ({value.timezone.replace(/_/g, ' ')})
        </span>
        <button
          type="button"
          className="font-medium text-primary underline-offset-2 hover:underline"
          onClick={() => {
            setEditingTimezone((editing) => !editing);
            setTimezoneSearch('');
          }}
        >
          {editingTimezone ? 'Done' : 'Change'}
        </button>
        {messagesRemaining !== null && (
          <>
            <span aria-hidden>·</span>
            <span>{messagesRemaining} messages left</span>
          </>
        )}
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
            className="w-72"
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
    </div>
  );
}

export { SchedulePicker };
