import { CaseReportFallback } from '@/v2/features/cases/report/CaseReportScreen';

/**
 * Route-level loading boundary for `/cases/[slug]/report` — the document shape,
 * held still. See `app/v2/cases/(library)/loading.tsx` for the full note.
 */
export default function CaseReportLoading() {
  return <CaseReportFallback />;
}
