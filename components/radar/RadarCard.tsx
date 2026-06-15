'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  Archive,
  CalendarClock,
  MoreHorizontal,
  Pause,
  Play,
  Settings,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArchiveRadarDialog } from './ArchiveRadarDialog';
import { RadarMetaRow } from './RadarMetaRow';
import { RadarStatusDot } from './RadarStatusDot';
import { usePauseRadar, useResumeRadar, useScanNow } from '@/lib/hooks/useRadars';
import { extractApiError } from '@/lib/utils/api-error';
import { describeCron } from '@/lib/utils/cron';
import type { RadarListItem } from '@/types/radar';

interface RadarCardProps {
  radar: RadarListItem;
}

function scheduleSummary(radar: RadarListItem): string {
  return describeCron(radar.schedule_cron) ?? `Custom — ${radar.schedule_cron}`;
}

function RadarCard({ radar }: RadarCardProps) {
  const router = useRouter();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const scanNow = useScanNow();
  const pauseRadar = usePauseRadar();
  const resumeRadar = useResumeRadar();

  const handleScanNow = async () => {
    try {
      await scanNow.mutateAsync(radar.uuid);
      toast.success('Scan dispatched', {
        description: 'The report will land in the inbox shortly.',
      });
    } catch (error) {
      toast.error('Could not start scan', {
        description: extractApiError(error).message,
      });
    }
  };

  const handlePause = async () => {
    try {
      await pauseRadar.mutateAsync(radar.uuid);
      toast.success('Radar paused', {
        description: 'Scans are stopped — nothing is billed while paused.',
      });
    } catch (error) {
      toast.error('Could not pause radar', {
        description: extractApiError(error).message,
      });
    }
  };

  const handleResume = async () => {
    try {
      await resumeRadar.mutateAsync(radar.uuid);
      toast.success('Radar resumed', {
        description: 'The schedule picks back up from here.',
      });
    } catch (error) {
      toast.error('Could not resume radar', {
        description: extractApiError(error).message,
      });
    }
  };

  return (
    <div className="group relative rounded-xl border bg-card p-5 transition-colors hover:border-primary/30 hover:bg-muted/30">
      <Link
        href={`/radars/${radar.uuid}`}
        className="absolute inset-0 rounded-xl"
        aria-label={`Open ${radar.name}`}
      />

      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <RadarStatusDot status={radar.status} className="relative z-10" />
            <h3 className="min-w-0 flex-1 truncate font-semibold">{radar.name}</h3>
            {radar.unread_reports_count > 0 && (
              <Badge className="shrink-0">{radar.unread_reports_count} new</Badge>
            )}
          </div>
          {radar.description && (
            <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
              {radar.description}
            </p>
          )}
        </div>

        {radar.status !== 'archived' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative z-10 size-8 shrink-0 text-muted-foreground"
                aria-label="Radar actions"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {radar.status === 'active' ? (
                <>
                  <DropdownMenuItem
                    onClick={handleScanNow}
                    disabled={scanNow.isPending}
                  >
                    <Zap />
                    Scan now
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handlePause}
                    disabled={pauseRadar.isPending}
                  >
                    <Pause />
                    Pause
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem
                  onClick={handleResume}
                  disabled={resumeRadar.isPending}
                >
                  <Play />
                  Resume
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => router.push(`/radars/${radar.uuid}/settings`)}
              >
                <Settings />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setArchiveOpen(true)}
              >
                <Archive />
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <RadarMetaRow className="mt-4">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="size-3.5" />
          {scheduleSummary(radar)}
        </span>
        <span>
          {radar.last_scan_at
            ? `Last scan ${formatDistanceToNow(new Date(radar.last_scan_at), { addSuffix: true })}`
            : 'Never scanned'}
        </span>
        {radar.status === 'active' && radar.next_scan_at && (
          <span>
            Next scan{' '}
            {formatDistanceToNow(new Date(radar.next_scan_at), {
              addSuffix: true,
            })}
          </span>
        )}
        {radar.status === 'paused' && (
          <span>Paused — no scans scheduled</span>
        )}
      </RadarMetaRow>

      <ArchiveRadarDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        radar={radar}
      />
    </div>
  );
}

export { RadarCard };
