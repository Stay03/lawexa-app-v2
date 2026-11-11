import type { Metadata } from 'next';
import { CertificatesScreen } from '@/v2/features/settings/certificates/CertificatesScreen';

/**
 * v2 `/settings/certificates`: the certificates issued to this account.
 * `v2/routes.manifest.ts` claims this EXACT path. `noindex`: one person's own page.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Certificates',
    description: 'Your certificates, their PDFs and their verify links.',
    robots: { index: false, follow: false },
  };
}

/** Every read is a client query the screen owns; the segment awaits nothing. */
export const unstable_dynamicStaleTime = 300;

export default function V2CertificatesPage() {
  return <CertificatesScreen />;
}
