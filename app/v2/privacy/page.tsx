import type { Metadata } from 'next';

import PrivacyPolicyArticle from '@/app/(legal)/privacy/page';
import { LegalScreen } from '@/v2/features/legal/LegalScreen';

/**
 * v2 `/privacy`: the Privacy Policy inside the v2 shell (owner, 4 October 2026).
 *
 * The wording is v1's article, imported as it stands (see `LegalScreen`). The
 * metadata matches v1's page word for word, canonical and indexing included:
 * the proxy rewrites this address into the v2 tree only for a reader holding
 * the v2 cookie, so search engines keep reading the v1 page at the same URL.
 */
export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Law Guide Technology Limited collects, uses, shares, and protects your information when you use Lawexa.',
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: true },
};

export default function V2PrivacyPage() {
  return (
    <LegalScreen current="privacy">
      <PrivacyPolicyArticle />
    </LegalScreen>
  );
}
