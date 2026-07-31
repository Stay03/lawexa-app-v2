import type { Metadata } from 'next';
import { CreateRadarScreen } from '@/v2/features/radars/create/CreateRadarScreen';

/**
 * v2 `/radars/new` — server shell for the create form. PRIVATE surface
 * (the conversations precedent): bare title, noindex, no canonical/OG.
 * The segment awaits nothing — the form is static chrome and the one data
 * dependency (the jurisdiction list) is a static-tier client query.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'New radar',
    description: 'Create a scheduled AI watch over legal developments.',
    robots: { index: false, follow: false },
  };
}

/** Same router-cache lever and safety argument as `/radars` beside it. */
export const unstable_dynamicStaleTime = 300;

export default function V2NewRadarPage() {
  return <CreateRadarScreen />;
}
