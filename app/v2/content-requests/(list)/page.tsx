import type { Metadata } from 'next';
import { RequestsScreen } from '@/v2/features/settings/requests/RequestsScreen';

/**
 * v2 `/content-requests`: My requests, opened from Settings. v1's address,
 * kept, because the request emails link under it. `v2/routes.manifest.ts`
 * claims `/content-requests/*` for v2 readers only; a v1 reader keeps v1's
 * page. `noindex`: every row is one person's own request.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'My requests',
    description: 'The cases and notes you asked for, and where each one stands.',
    robots: { index: false, follow: false },
  };
}

/** Every read is a client query the screen owns; the segment awaits nothing. */
export const unstable_dynamicStaleTime = 300;

export default function V2RequestsPage() {
  return <RequestsScreen />;
}
