'use client';

import {
  Archive,
  CheckCircle2,
  Flag,
  Inbox,
  Mail,
  MailOpen,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { RadarScan, TriageScanPayload } from '@/types/radar';
import { useTriageScan } from '../use-triage-scan';

/**
 * The triage vocabulary — ONE derivation of which actions a scan offers
 * (v1's `triageActionsForScan`, ported), rendered two ways: menu items for a
 * scan row's `⋯`, an icon toolbar for the report page. Both fire the same
 * optimistic `useTriageScan`, so a triage from either surface moves rows and
 * counters identically.
 */

interface TriageAction {
  key: string;
  label: string;
  icon: LucideIcon;
  payload: TriageScanPayload;
  iconClassName?: string;
}

export function triageActionsForScan(scan: RadarScan): TriageAction[] {
  const actions: TriageAction[] = [];

  actions.push(
    scan.read_at === null
      ? { key: 'read', label: 'Mark read', icon: MailOpen, payload: { read: true } }
      : { key: 'read', label: 'Mark unread', icon: Mail, payload: { read: false } },
  );

  actions.push(
    scan.priority
      ? {
          key: 'priority',
          label: 'Remove priority',
          icon: Flag,
          payload: { priority: false },
          iconClassName: 'fill-amber-500 text-amber-500',
        }
      : {
          key: 'priority',
          label: 'Mark priority',
          icon: Flag,
          payload: { priority: true },
        },
  );

  if (scan.workflow_status === 'active') {
    actions.push({
      key: 'complete',
      label: 'Mark complete',
      icon: CheckCircle2,
      payload: { workflow_status: 'complete' },
    });
  } else {
    actions.push({
      key: 'inbox',
      label: 'Move to inbox',
      icon: Inbox,
      payload: { workflow_status: 'active' },
    });
  }

  if (scan.workflow_status !== 'archive') {
    actions.push({
      key: 'archive',
      label: 'Archive report',
      icon: Archive,
      payload: { workflow_status: 'archive' },
    });
  }

  return actions;
}

/** The row-menu presentation — render inside a `DropdownMenuContent`. */
export function ScanTriageMenuItems({
  radarUuid,
  scan,
}: {
  radarUuid: string;
  scan: RadarScan;
}) {
  const triageScan = useTriageScan();
  return (
    <>
      {triageActionsForScan(scan).map((action) => (
        <DropdownMenuItem
          key={action.key}
          onClick={() =>
            triageScan.mutate({
              radarUuid,
              scanUuid: scan.uuid,
              payload: action.payload,
            })
          }
        >
          <action.icon className={action.iconClassName} />
          {action.label}
        </DropdownMenuItem>
      ))}
    </>
  );
}

/** The report page's icon toolbar presentation. */
export function ScanTriageToolbar({
  radarUuid,
  scan,
}: {
  radarUuid: string;
  scan: RadarScan;
}) {
  const triageScan = useTriageScan();
  return (
    <div className="flex items-center gap-1">
      {triageActionsForScan(scan).map((action) => (
        <Tooltip key={action.key}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              onClick={() =>
                triageScan.mutate({
                  radarUuid,
                  scanUuid: scan.uuid,
                  payload: action.payload,
                })
              }
              aria-label={action.label}
            >
              <action.icon className={cn('size-4', action.iconClassName)} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{action.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
