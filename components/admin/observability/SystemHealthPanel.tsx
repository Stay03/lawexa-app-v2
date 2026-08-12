'use client';

import {
  AlertTriangle,
  Database,
  HardDrive,
  Mail,
  Layers,
  type LucideIcon,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { StatusTone } from '@/lib/utils/observability';
import {
  isCheckDown,
  mailFailureCount,
  pendingTotal,
  type HealthCheckBase,
  type SystemHealth,
} from '@/types/system-health';
import { StatusBadge } from './StatusBadge';

const COUNT_TONE: Record<StatusTone, string> = {
  neutral: 'text-foreground',
  info: 'text-sky-600 dark:text-sky-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-destructive',
};

/**
 * SystemHealthPanel — is mail sending, is the queue draining, and how much has
 * quietly failed.
 *
 * NOT A {@link JobHealthCard}, deliberately. Those summarise one job family and
 * carry a "View" link to its list; this has no list to link to, and covers the
 * services underneath every job family rather than one of them. It borrows
 * their visual language so the dashboard still reads as one page.
 *
 * THE BACKLOG IS THE HEADLINE, and it is the reason this exists. 711 failures
 * going back to 6 July had never once been looked at, because nothing in the
 * product ever said the number out loud. Everything else here is a light that
 * is usually green; that figure is the one a person is meant to act on.
 */

function CheckPill({
  icon: Icon,
  label,
  check,
}: {
  icon: LucideIcon;
  label: string;
  check: HealthCheckBase;
}) {
  const down = isCheckDown(check);
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border px-3 py-2',
        down && 'border-destructive/40 bg-destructive/5',
      )}
    >
      <Icon
        className={cn('h-4 w-4 shrink-0', down ? 'text-destructive' : 'text-muted-foreground')}
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {/* The server's own word, never a mapped guess — an unknown status
              must read as itself rather than be flattened into "down". */}
          {check.status} · {check.ms}ms
        </p>
      </div>
    </div>
  );
}

/** "Mail", "Mail and Cache", "Mail, Queue and Cache". */
function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function Figure({
  value,
  label,
  tone = 'neutral',
  large,
}: {
  value: string;
  label: string;
  tone?: StatusTone;
  large?: boolean;
}) {
  return (
    <div>
      <p
        className={cn(
          'font-semibold tabular-nums',
          large ? 'text-3xl' : 'text-xl',
          COUNT_TONE[tone],
        )}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function SystemHealthPanel({
  health,
  message,
  isLoading,
  isError,
}: {
  health: SystemHealth | undefined;
  /** The server's own sentence, e.g. "All systems operational." */
  message: string | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  const checks = health?.checks;
  const failures = checks ? mailFailureCount(checks.mail) : 0;
  const waiting = checks ? pendingTotal(checks.queue) : 0;
  const backlog = checks?.queue.failed.total ?? 0;
  const workersStopped = checks ? !checks.queue.workers_running : false;
  /* Named, not counted. "A service is not answering" makes somebody open four
     things to find out which one; the panel already knows. */
  const down = checks
    ? (
        [
          ['Mail', checks.mail],
          ['Queue', checks.queue],
          ['Database', checks.database],
          ['Cache', checks.cache],
        ] as const
      )
        .filter(([, check]) => isCheckDown(check))
        .map(([name]) => name)
    : [];

  /* The faults worth interrupting somebody for, most serious first. The
     backlog is NOT one of them: it is 711 and has been for weeks, so a red
     banner about it would be permanent furniture and would train everyone to
     ignore the banner. It gets a number, not an alarm. */
  const alarm = workersStopped
    ? 'Queue workers are not running — nothing is being processed'
    : down.length > 0
      ? `${listNames(down)} ${down.length === 1 ? 'is' : 'are'} not answering`
      : failures > 0
        ? `${failures.toLocaleString()} mail failure${failures === 1 ? '' : 's'} in the last ${checks?.mail.window_minutes ?? 0} minutes`
        : null;

  return (
    <Card className={cn(alarm && 'border-destructive/40')}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">System health</CardTitle>
        {health && (
          /* The badge is the SERVER's verdict, toned by the server's own word —
             never by what this panel noticed. Tinting it red because of our own
             alarm produced a red pill reading "healthy", which is a screen
             arguing with itself. The banner below carries our finding. */
          <StatusBadge
            meta={{
              label: health.status,
              tone: health.status === 'healthy' ? 'success' : 'danger',
            }}
          />
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError || !checks ? (
          /* The health check itself being unreachable is its own kind of news,
             and saying so plainly beats an empty card that looks fine. */
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Couldn&apos;t reach the health check.
          </div>
        ) : (
          <>
            {alarm && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {alarm}
              </div>
            )}

            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <Figure
                large
                value={backlog.toLocaleString()}
                label="Failed jobs waiting to be cleared"
                tone={backlog > 0 ? 'warning' : 'success'}
              />
              <Figure
                value={checks.queue.failed.last_day.toLocaleString()}
                label="Failed today"
                tone={checks.queue.failed.last_day > 0 ? 'warning' : 'neutral'}
              />
              <Figure
                value={checks.queue.failed.last_hour.toLocaleString()}
                label="Failed this hour"
                tone={checks.queue.failed.last_hour > 0 ? 'danger' : 'neutral'}
              />
              <Figure
                value={waiting.toLocaleString()}
                label={
                  checks.queue.oldest_pending_minutes === null
                    ? 'Waiting in the queue'
                    : `Waiting — oldest ${checks.queue.oldest_pending_minutes}m`
                }
                tone={checks.queue.oldest_pending_minutes === null ? 'neutral' : 'warning'}
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <CheckPill icon={Mail} label="Mail" check={checks.mail} />
              <CheckPill icon={Layers} label="Queue" check={checks.queue} />
              <CheckPill icon={Database} label="Database" check={checks.database} />
              <CheckPill icon={HardDrive} label="Cache" check={checks.cache} />
            </div>

            <p className="text-xs text-muted-foreground">
              {message} Mail transport {checks.mail.transport}, {failures.toLocaleString()}{' '}
              failure{failures === 1 ? '' : 's'} in {checks.mail.window_minutes} minutes. Queue
              on {checks.queue.driver}, workers{' '}
              {checks.queue.workers_running ? 'running' : 'stopped'}.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
