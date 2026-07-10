import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type {
  EnrichmentStatus,
  EnrichmentTrigger,
} from '@/types/admin-case-enrichments';

const STATUS_CLASSES: Record<EnrichmentStatus, string> = {
  completed:
    'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  failed: 'border-transparent bg-destructive/10 text-destructive dark:bg-destructive/20',
  running:
    'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
  skipped: 'border-transparent bg-muted text-muted-foreground',
};

const STATUS_LABELS: Record<EnrichmentStatus, string> = {
  completed: 'Completed',
  failed: 'Failed',
  running: 'Running',
  skipped: 'Skipped',
};

export function EnrichmentStatusBadge({ status }: { status: EnrichmentStatus }) {
  return (
    <Badge variant="outline" className={cn('gap-1 font-medium', STATUS_CLASSES[status])}>
      {status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
      {STATUS_LABELS[status]}
    </Badge>
  );
}

const TRIGGER_LABELS: Record<EnrichmentTrigger, string> = {
  ingest: 'Ingest',
  backfill: 'Backfill',
  manual: 'Manual',
};

export function EnrichmentTriggerBadge({ trigger }: { trigger: EnrichmentTrigger }) {
  return (
    <Badge variant="secondary" className="font-normal">
      {TRIGGER_LABELS[trigger]}
    </Badge>
  );
}
