import { ReportFallback } from '@/v2/features/radars/report/ScanReportScreen';

/**
 * Route-level loading boundary for a scan report — the report silhouette,
 * held still, identical to the screen's own pending shape.
 */
export default function ScanReportLoading() {
  return <ReportFallback />;
}
