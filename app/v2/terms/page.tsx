import type { Metadata } from 'next';

import TermsOfServiceArticle from '@/app/(legal)/terms/page';
import { LegalScreen } from '@/v2/features/legal/LegalScreen';

/**
 * v2 `/terms`: the Terms of Service inside the v2 shell (owner, 4 October 2026).
 *
 * The wording is v1's article, imported as it stands (see `LegalScreen`). The
 * metadata matches v1's page word for word, canonical and indexing included:
 * the proxy rewrites this address into the v2 tree only for a reader holding
 * the v2 cookie, so search engines keep reading the v1 page at the same URL.
 */
export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms governing your use of Lawexa, its websites, applications, AI Services, and related services from Law Guide Technology Limited.',
  alternates: { canonical: '/terms' },
  robots: { index: true, follow: true },
};

export default function V2TermsPage() {
  return (
    <LegalScreen current="terms">
      <TermsOfServiceArticle />
    </LegalScreen>
  );
}
