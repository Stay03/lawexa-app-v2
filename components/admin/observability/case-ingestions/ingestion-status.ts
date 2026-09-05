import { makeStatusMeta } from '@/lib/utils/observability';
import type { CaseIngestionStatus } from '@/types/admin-case-ingestions';

export const ingestionStatusMeta = makeStatusMeta<CaseIngestionStatus>({
  pending: { label: 'Pending', tone: 'neutral' },
  running: { label: 'Running', tone: 'info', spinning: true },
  completed: { label: 'Completed', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  /* Warning, not danger and not success: nothing went wrong and nothing was
     created. A danger tone would send somebody to retry the very thing the
     check refused, and a success tone would hide it in a list of new cases. */
  duplicate: { label: 'Already held', tone: 'warning' },
});
