'use client';

import { useId, useSyncExternalStore } from 'react';
import { Clock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DEFAULT_BUILDER_STATE,
  builderToCron,
  cronToBuilder,
  describeCron,
  ordinal,
  parseCronExpression,
  type ScheduleBuilderState,
  type ScheduleFrequency,
} from '@/lib/utils/cron';
import { TimezonePicker } from './TimezonePicker';

/**
 * SchedulePicker — schedule selection without cron literacy, rebuilt with the
 * REAL form semantics the study required:
 *
 *  - the whole control is a `<fieldset>` whose `<legend>` is the visible
 *    "Schedule" group label (legend first child — the researched rule);
 *  - the FREQUENCY is a real radio group: four native `<input type="radio">`
 *    styled as segmented pills. Native radios give arrow-key movement,
 *    form semantics, and group announcement for free — no ARIA re-plumbing;
 *  - the day/time refinements read as one sentence under the pills, each
 *    control individually labelled;
 *  - the TIMEZONE line states the consequence ("Your current time — 3:41 PM
 *    (Africa/Lagos)") so the user confirms their zone rather than hunting for
 *    it, with the full-search {@link TimezonePicker} behind "Change".
 *
 * v1's "N messages left" rode on the timezone line; per the study it moved to
 * the review dialog, beside the cost line it belongs to.
 *
 * A raw-cron input appears only as the automatic fallback for an existing
 * expression the builder cannot represent (reachable in edit mode) — there is
 * no manual switch into it.
 */

const FREQUENCY_OPTIONS: { value: ScheduleFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
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

/** 1–28, so the day exists in every month. */
const MONTH_DAY_OPTIONS = Array.from({ length: 28 }, (_, index) => index + 1);

// A coarse clock for the current-time confirmation line. Time is external
// mutable state, so it is read through useSyncExternalStore (render stays
// pure); the snapshot is quantized so it changes once per tick.
const CLOCK_TICK_MS = 30_000;

function subscribeToClock(onTick: () => void): () => void {
  const id = setInterval(onTick, CLOCK_TICK_MS);
  return () => clearInterval(id);
}

function useNowMs(): number {
  return useSyncExternalStore(
    subscribeToClock,
    () => Math.floor(Date.now() / CLOCK_TICK_MS) * CLOCK_TICK_MS,
    () => 0,
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

export interface ScheduleValue {
  cron: string;
  /**
   * The RESOLVED zone, or `null` while the untouched device default is still
   * resolving (server + hydration render — see `use-device-timezone.ts`).
   * While `null` the zone line holds a neutral shape and the change control
   * waits; `onChange` echoes the `null` back untouched.
   */
  timezone: string | null;
}

export function SchedulePicker({
  value,
  onChange,
  error,
  errorId,
}: {
  value: ScheduleValue;
  onChange: (value: ScheduleValue) => void;
  /** The schedule_cron validation message, rendered inside the fieldset. */
  error?: string;
  errorId?: string;
}) {
  const uid = useId();
  const builder = cronToBuilder(value.cron);
  const advanced = builder === null;

  const nowMs = useNowMs();
  const localTime =
    value.timezone !== null ? formatTimeIn(nowMs, value.timezone) : null;

  const cronIsValid = parseCronExpression(value.cron) !== null;
  const cronSummary = describeCron(value.cron);

  const updateBuilder = (patch: Partial<ScheduleBuilderState>) => {
    const next = { ...(builder ?? DEFAULT_BUILDER_STATE), ...patch };
    onChange({ ...value, cron: builderToCron(next) });
  };

  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="text-sm font-medium text-foreground">Schedule</legend>

      {!advanced && builder ? (
        <>
          {/* The frequency — real radios styled as segmented pills. */}
          <div
            role="radiogroup"
            aria-label="How often to scan"
            className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto overscroll-x-contain rounded-full bg-secondary/60 p-0.5"
          >
            {FREQUENCY_OPTIONS.map((option) => {
              const checked = builder.frequency === option.value;
              const inputId = `${uid}-freq-${option.value}`;
              return (
                <span key={option.value} className="shrink-0">
                  <input
                    type="radio"
                    id={inputId}
                    name={`${uid}-frequency`}
                    value={option.value}
                    checked={checked}
                    onChange={() => updateBuilder({ frequency: option.value })}
                    className="peer sr-only"
                  />
                  <label
                    htmlFor={inputId}
                    className={cn(
                      'v2-interactive inline-flex min-h-8 cursor-pointer items-center rounded-full px-3.5 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none',
                      checked
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                      'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
                    )}
                  >
                    {option.label}
                  </label>
                </span>
              );
            })}
          </div>

          {/* The refinements, reading as one sentence. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-muted-foreground">
            {builder.frequency === 'weekly' ? (
              <>
                <span>on</span>
                <Select
                  value={String(builder.weekday)}
                  onValueChange={(weekday) =>
                    updateBuilder({ weekday: Number(weekday) })
                  }
                >
                  <SelectTrigger
                    aria-label="Day of the week"
                    className="w-36 shrink-0"
                  >
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
            ) : null}

            {builder.frequency === 'monthly' ? (
              <>
                <span>on the</span>
                <Select
                  value={String(builder.monthDay)}
                  onValueChange={(monthDay) =>
                    updateBuilder({ monthDay: Number(monthDay) })
                  }
                >
                  <SelectTrigger
                    aria-label="Day of the month"
                    className="w-24 shrink-0"
                  >
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
            ) : null}

            <label htmlFor={`${uid}-time`}>at</label>
            <Input
              id={`${uid}-time`}
              aria-label="Time of day"
              type="time"
              value={builder.time}
              onChange={(event) => {
                if (event.target.value) {
                  updateBuilder({ time: event.target.value });
                }
              }}
              className="w-32 shrink-0"
            />
          </div>
        </>
      ) : (
        /* The automatic fallback for an expression the builder can't hold. */
        <div className="space-y-1.5">
          <label
            htmlFor={`${uid}-cron`}
            className="text-xs text-muted-foreground"
          >
            Cron expression
          </label>
          <Input
            id={`${uid}-cron`}
            value={value.cron}
            onChange={(event) =>
              onChange({ ...value, cron: event.target.value })
            }
            placeholder="0 18 * * *"
            className="font-mono"
            aria-invalid={!cronIsValid}
            aria-describedby={errorId}
          />
          {cronIsValid ? (
            <p className="text-xs text-muted-foreground">
              {cronSummary ?? (
                <>
                  Custom schedule —{' '}
                  <code className="font-mono">{value.cron}</code>
                </>
              )}
            </p>
          ) : null}
        </div>
      )}

      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {/* The consequence line — confirm the zone, don't hunt for it. Until
          the device zone resolves (one frame past hydration) the time AND
          the zone name hold neutral shapes: rendering the server's zone
          would be a hydration error, and rendering a guess would be a lie. */}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
        <Clock aria-hidden className="size-3.5 shrink-0" />
        <span>
          Your current time —{' '}
          {localTime ? (
            <span className="font-medium text-foreground">{localTime}</span>
          ) : (
            <span
              aria-hidden
              className="inline-block h-3 w-14 animate-pulse rounded bg-secondary align-middle"
            />
          )}{' '}
          {value.timezone !== null ? (
            <>({value.timezone.replace(/_/g, ' ')})</>
          ) : (
            <span
              aria-hidden
              className="inline-block h-3 w-24 animate-pulse rounded bg-secondary align-middle"
            />
          )}
        </span>
        {value.timezone !== null ? (
          <TimezonePicker
            value={value.timezone}
            onChange={(timezone) => onChange({ ...value, timezone })}
          />
        ) : null}
      </div>
    </fieldset>
  );
}
