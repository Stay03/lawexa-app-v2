'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LogOut,
  Monitor,
  MonitorSmartphone,
  RotateCw,
  Smartphone,
  Tablet,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import type { Session } from '@/types/auth';
import { formatRelativeTime } from '@/v2/shell/designs/modules';
import { SETTINGS_BLOCK, SETTINGS_COLUMN } from '../SettingsList';
import { SettingsFormGroup } from '../SettingsForm';
import { SettingsState } from '../SettingsState';
import { deviceKind, deviceLabel, splitSessions, type DeviceKind } from './model';
import { devicesQueries } from './queries';
import { SignOutDialog, type SignOutTarget } from './SignOutDialog';
import { DevicesFallback } from './states';

const KIND_ICON: Record<DeviceKind, LucideIcon> = {
  desktop: Monitor,
  phone: Smartphone,
  tablet: Tablet,
  other: MonitorSmartphone,
};

/** "Active now", "Active 3h ago", or "Not used yet" when the API has no time. */
function activity(session: Session, now: number): string {
  const ago = formatRelativeTime(session.last_used_at, now);
  if (!ago) return 'Not used yet';
  return ago === 'now' ? 'Active now' : `Active ${ago} ago`;
}

/**
 * DevicesScreen — v2 `/settings/devices`: every device signed in to this
 * account, and a way to sign any of them out. New in v2 (v1 only ever had a
 * "coming soon" card for sessions).
 *
 * The device you are reading on is shown on its own, with no sign-out button:
 * ending your own session is "Log out", and the API refuses it here anyway
 * (400, "Use logout instead"). Every other device has one. "Sign out of all
 * other devices" appears only when there are two or more, since with one the
 * row's own button is the same action.
 *
 * The IP address is never shown. The location line is enough to recognise a
 * device, and an IP on screen is a detail people screenshot and share.
 */
export function DevicesScreen() {
  const query = useQuery(devicesQueries.list());
  // One clock per visit, read once (React Compiler lint: no Date.now in render).
  const [now] = useState(() => Date.now());
  const [target, setTarget] = useState<SignOutTarget | null>(null);

  if (query.isPending) return <DevicesFallback />;

  if (query.isError) {
    const apiError = extractApiError(query.error);
    return (
      <div className={SETTINGS_COLUMN}>
        <Heading />
        <SettingsState
          icon={TriangleAlert}
          tone="alarm"
          title="Your devices did not load"
          description={
            apiError.status >= 400 && apiError.status < 500
              ? apiError.message
              : 'Check your connection and try again.'
          }
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
            >
              <RotateCw
                aria-hidden
                className={cn('size-4', query.isFetching && 'animate-spin')}
              />
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  const { current, others } = splitSessions(query.data);

  return (
    <div className={SETTINGS_COLUMN}>
      <Heading />
      <div className="flex flex-col gap-5">
        {current ? (
          <SettingsFormGroup id="devices-current" label="This device">
            <DeviceRow session={current} now={now} isCurrent />
          </SettingsFormGroup>
        ) : null}

        <SettingsFormGroup
          id="devices-others"
          label="Other devices"
          description="Signing a device out ends its session there. It will need to log in again."
        >
          {others.length > 0 ? (
            others.map((session) => (
              <DeviceRow
                key={session.id}
                session={session}
                now={now}
                onSignOut={() => setTarget({ kind: 'one', session })}
              />
            ))
          ) : (
            <li className="flex min-h-14 items-center px-4 py-2.5 text-[15px] leading-snug text-muted-foreground">
              No other devices are signed in.
            </li>
          )}
        </SettingsFormGroup>

        {others.length >= 2 ? (
          <ul className={SETTINGS_BLOCK}>
            <li>
              <button
                type="button"
                onClick={() => setTarget({ kind: 'others', count: others.length })}
                className={cn(
                  'group v2-interactive flex min-h-14 w-full items-center gap-3.5 px-4 py-2.5 text-left',
                  'text-destructive transition-colors duration-150 hover:bg-destructive/[0.06] motion-reduce:transition-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                )}
              >
                <LogOut aria-hidden className="size-5 shrink-0" />
                <span className="text-[15px] leading-snug font-medium">
                  Sign out of all other devices
                </span>
              </button>
            </li>
          </ul>
        ) : null}
      </div>

      <SignOutDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}

function Heading() {
  return (
    <h1 className="sr-only md:not-sr-only md:mb-5 md:text-2xl md:font-semibold md:tracking-tight md:text-foreground">
      Signed-in devices
    </h1>
  );
}

function DeviceRow({
  session,
  now,
  isCurrent = false,
  onSignOut,
}: {
  session: Session;
  now: number;
  isCurrent?: boolean;
  onSignOut?: () => void;
}) {
  const Icon = KIND_ICON[deviceKind(session)];
  const location = session.device?.location?.trim();
  const detail = [location, isCurrent ? 'Active now' : activity(session, now)]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="flex min-h-14 items-center gap-3.5 px-4 py-2.5">
      <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] leading-snug font-medium text-foreground">
          {deviceLabel(session)}
        </span>
        <span className="truncate text-[13px] leading-snug text-muted-foreground">
          {detail}
        </span>
      </span>
      {onSignOut ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={onSignOut}
          aria-label={`Sign out of ${deviceLabel(session)}`}
          className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          Sign out
        </Button>
      ) : null}
    </li>
  );
}
