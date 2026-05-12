import type {
  PaystackWebhookProcessingStatus,
  PaystackWebhookRow,
} from '@/types/admin-paystack-webhooks';

export const STATUS_TONE: Record<
  PaystackWebhookProcessingStatus,
  { label: string; className: string }
> = {
  received: {
    label: 'Received',
    className: 'text-muted-foreground bg-muted',
  },
  processed: {
    label: 'Processed',
    className:
      'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950',
  },
  skipped_duplicate: {
    label: 'Skipped (duplicate)',
    className: 'text-muted-foreground bg-muted',
  },
  skipped_unhandled: {
    label: 'Skipped (unhandled)',
    className:
      'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950',
  },
  failed_signature: {
    label: 'Bad signature',
    className: 'text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-950',
  },
  failed_processing: {
    label: 'Failed',
    className: 'text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-950',
  },
};

export type ReplayMode = 'primary' | 'hidden';

// Replay-button gating per backend's confirmed matrix:
// - primary on `failed_processing` / `received`
// - hidden on `skipped_*`, `failed_signature`, `processed`, and any truncated payload
export function canReplay(
  row: Pick<PaystackWebhookRow, 'processing_status' | 'payload_truncated'>
): ReplayMode {
  if (row.payload_truncated) return 'hidden';
  if (
    row.processing_status === 'failed_processing' ||
    row.processing_status === 'received'
  ) {
    return 'primary';
  }
  return 'hidden';
}

// Strip the `App\Models\` (or similar) namespace prefix so the subject cell is readable.
export function shortSubjectType(raw: string): string {
  const tail = raw.split('\\').pop() ?? raw;
  return tail;
}
