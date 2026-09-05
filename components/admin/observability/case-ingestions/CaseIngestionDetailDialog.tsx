'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/admin/observability';
import { ingestionStatusMeta } from './ingestion-status';
import { sourceFormatLabel, isProviderFetch } from './source-format';
import type { CaseIngestion } from '@/types/admin-case-ingestions';

interface CaseIngestionDetailDialogProps {
  ingestion: CaseIngestion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="col-span-2 break-words text-sm">{children}</dd>
    </div>
  );
}

export function CaseIngestionDetailDialog({
  ingestion,
  open,
  onOpenChange,
}: CaseIngestionDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Case ingestion</DialogTitle>
          <DialogDescription className="font-mono text-xs">{ingestion?.id}</DialogDescription>
        </DialogHeader>

        {ingestion && (
          <dl className="divide-y divide-border">
            <Row label="Source">{sourceFormatLabel(ingestion.source_format)}</Row>
            {/* A provider fetch has a provider id and no file; an upload is the
                other way round. Showing the row that is always empty for this
                job's kind reads as missing data, so each kind shows its own. */}
            {isProviderFetch(ingestion.source_format) ? (
              <Row label="Provider case">
                <span className="font-mono text-xs">{ingestion.provider_case_id ?? '—'}</span>
              </Row>
            ) : (
              <Row label="File">{ingestion.report_file_name ?? '—'}</Row>
            )}
            <Row label="Requested by">
              {ingestion.user ? `${ingestion.user.name} · ${ingestion.user.email}` : '—'}
            </Row>
            <Row label="Country">{ingestion.country?.name ?? '—'}</Row>
            <Row label="Status">
              <StatusBadge meta={ingestionStatusMeta(ingestion.status)} />
            </Row>
            {ingestion.status === 'completed' && ingestion.result && (
              <Row label="Created case">
                <Link
                  href={`/admin/cases/${ingestion.result.case_slug}`}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  {ingestion.result.case_slug}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Row>
            )}
            {ingestion.status === 'failed' && (
              <Row label="Error">
                <div className="space-y-1">
                  {ingestion.status_code != null && (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      HTTP {ingestion.status_code}
                    </Badge>
                  )}
                  <p className="whitespace-pre-wrap text-destructive">{ingestion.error}</p>
                </div>
              </Row>
            )}
            {!isProviderFetch(ingestion.source_format) && (
              <Row label="Storage path">
                <span className="font-mono text-xs">{ingestion.report_file_path ?? '—'}</span>
              </Row>
            )}
            <Row label="Started">
              {ingestion.started_at ? format(new Date(ingestion.started_at), 'PPpp') : '—'}
            </Row>
            <Row label="Completed">
              {ingestion.completed_at ? format(new Date(ingestion.completed_at), 'PPpp') : '—'}
            </Row>
          </dl>
        )}
      </DialogContent>
    </Dialog>
  );
}
