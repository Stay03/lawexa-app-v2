import { ReportFallback } from '@/v2/features/radars/report/ScanReportScreen';

/**
 * Route-level loading boundary for a scan report: the report silhouette,
 * pulsing, identical to the screen's own pending shape. One appearance for a
 * wait, whichever boundary draws it (standards section 8i).
 */
export default function ScanReportLoading() {
  return <ReportFallback />;
}
