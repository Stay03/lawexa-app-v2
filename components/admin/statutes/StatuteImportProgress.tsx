'use client';

import { Loader2, CheckCircle2, XCircle, AlertTriangle, Ban } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { useImportStatus, useCancelImport } from '@/lib/hooks/useAdminStatutes';
import { extractApiError } from '@/lib/utils/api-error';
import type { ImportStatus } from '@/types/admin-statutes';

/******************************************************************************
                                Component Props
******************************************************************************/

interface StatuteImportProgressProps {
  uuid: string;
  onDone?: () => void;
}

/******************************************************************************
                                Helpers
******************************************************************************/

function statusIcon(status: ImportStatus) {
  switch (status) {
    case 'pending':
      return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
    case 'processing':
      return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-destructive" />;
  }
}

function statusBadgeVariant(status: ImportStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'completed':
      return 'default';
    case 'processing':
      return 'secondary';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
}

/******************************************************************************
                                Main Component
******************************************************************************/

export function StatuteImportProgress({ uuid, onDone }: StatuteImportProgressProps) {
  const { data, isLoading } = useImportStatus(uuid);
  const cancelMutation = useCancelImport();

  const importData = data?.data;

  if (isLoading || !importData) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading import status...</span>
        </CardContent>
      </Card>
    );
  }

  const isActive = importData.status === 'pending' || importData.status === 'processing';
  const progressPercent = Math.round(importData.progress);

  const handleCancel = () => {
    cancelMutation.mutate(uuid, {
      onSuccess: (response) => {
        toast.success(response.message || 'Import cancelled');
        onDone?.();
      },
      onError: (error) => {
        const apiError = extractApiError(error);
        toast.error(apiError.message);
      },
    });
  };

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        {/* Header Row */}
        <div className="flex items-center gap-3">
          {statusIcon(importData.status)}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {importData.original_filename}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={statusBadgeVariant(importData.status)}>
                {importData.status_label}
              </Badge>
              {importData.total_nodes > 0 && (
                <span className="text-xs text-muted-foreground">
                  {importData.processed_nodes.toLocaleString()} / {importData.total_nodes.toLocaleString()} nodes
                </span>
              )}
            </div>
          </div>

          {/* Cancel button for active imports */}
          {isActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Ban className="mr-1 h-3 w-3" />
              )}
              Cancel
            </Button>
          )}
        </div>

        {/* Progress Bar */}
        {isActive && (
          <div className="space-y-1">
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">
              {progressPercent}%
            </p>
          </div>
        )}

        {/* Completed: Link to statute */}
        {importData.status === 'completed' && importData.statute_slug && (
          <div className="flex items-center gap-2">
            <Link
              href={`/statutes/${importData.statute_slug}`}
              className="text-sm text-primary hover:underline"
              target="_blank"
            >
              View imported statute
            </Link>
            <Link
              href={`/admin/statutes/${importData.statute_slug}`}
              className="text-sm text-muted-foreground hover:underline"
            >
              View details
            </Link>
          </div>
        )}

        {/* Failed: Error message */}
        {importData.status === 'failed' && importData.error_message && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">{importData.error_message}</p>
          </div>
        )}

        {/* Warnings */}
        {importData.warnings && importData.warnings.length > 0 && (
          <div className="space-y-1">
            {importData.warnings.map((warning, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-50/50 dark:bg-yellow-950/20 p-2"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 mt-0.5 shrink-0" />
                <p className="text-xs text-yellow-700 dark:text-yellow-400">{warning}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
