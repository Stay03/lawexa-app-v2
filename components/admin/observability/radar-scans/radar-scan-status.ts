import { makeStatusMeta } from '@/lib/utils/observability';
import type { RadarScanStatus } from '@/types/admin-radar-scans';

export const radarScanStatusMeta = makeStatusMeta<RadarScanStatus>({
  queued: { label: 'Queued', tone: 'neutral' },
  running: { label: 'Running', tone: 'info', spinning: true },
  completed: { label: 'Completed', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  skipped_no_balance: { label: 'No balance', tone: 'warning' },
});

export function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}
