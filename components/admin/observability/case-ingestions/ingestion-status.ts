import { makeStatusMeta } from '@/lib/utils/observability';
import type { CaseIngestionStatus } from '@/types/admin-case-ingestions';

export const ingestionStatusMeta = makeStatusMeta<CaseIngestionStatus>({
  pending: { label: 'Pending', tone: 'neutral' },
  running: { label: 'Running', tone: 'info', spinning: true },
  completed: { label: 'Completed', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
});
