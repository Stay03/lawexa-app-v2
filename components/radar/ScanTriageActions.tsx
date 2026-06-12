'use client';

import {
  Archive,
  CheckCircle2,
  Flag,
  Inbox,
  Mail,
  MailOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTriageScan } from '@/lib/hooks/useRadars';
import { extractApiError } from '@/lib/utils/api-error';
import { cn } from '@/lib/utils';
import type { RadarScan, TriageScanPayload } from '@/types/radar';

interface TriageAction {
  key: string;
  label: string;
  icon: LucideIcon;
  payload: TriageScanPayload;
  iconClassName?: string;
}

function triageActionsForScan(scan: RadarScan): TriageAction[] {
  const actions: TriageAction[] = [];

  actions.push(
    scan.read_at === null
      ? { key: 'read', label: 'Mark read', icon: MailOpen, payload: { read: true } }
      : { key: 'read', label: 'Mark unread', icon: Mail, payload: { read: false } }
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
        }
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

interface ScanTriageActionsProps {
  radarUuid: string;
  scan: RadarScan;
  variant: 'menu' | 'toolbar';
}

/**
 * Triage controls for a scan, rendered either as dropdown menu items
 * (inbox rows) or as an icon-button toolbar (report page). All updates are
 * optimistic via useTriageScan.
 */
function ScanTriageActions({ radarUuid, scan, variant }: ScanTriageActionsProps) {
  const triageScan = useTriageScan();
  const actions = triageActionsForScan(scan);

  const runAction = async (action: TriageAction) => {
    try {
      await triageScan.mutateAsync({
        radarUuid,
        scanUuid: scan.uuid,
        payload: action.payload,
      });
    } catch (error) {
      toast.error('Could not update report', {
        description: extractApiError(error).message,
      });
    }
  };

  if (variant === 'menu') {
    return (
      <>
        {actions.map((action) => (
          <DropdownMenuItem key={action.key} onClick={() => runAction(action)}>
            <action.icon className={action.iconClassName} />
            {action.label}
          </DropdownMenuItem>
        ))}
      </>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {actions.map((action) => (
        <Tooltip key={action.key}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              onClick={() => runAction(action)}
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

export { ScanTriageActions };
