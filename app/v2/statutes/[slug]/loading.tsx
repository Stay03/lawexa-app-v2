import { StatuteFallback } from '@/v2/features/statutes/reader/StatuteScreen';

/**
 * Route-level loading boundary for `/statutes/[slug]` — and, sitting above
 * the `[[...provision]]` catch-all, for the citation deep links
 * (`/statutes/[slug]/section-54-2`) too: both forms suspend into the same
 * reader-shaped skeleton the reader renders while its own metadata query
 * resolves, so route boundary → skeleton → live document is one continuous
 * shape. See `app/v2/statutes/loading.tsx` for why the parent segment
 * boundary renders this same shape.
 */
export default function StatuteLoading() {
  return <StatuteFallback />;
}
