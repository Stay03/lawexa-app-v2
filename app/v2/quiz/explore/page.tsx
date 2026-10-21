import type { Metadata } from 'next';

import { SEO, getAppUrl } from '@/lib/constants/seo';
import { ExploreScreen } from '@/v2/features/quiz/solo/explore/ExploreScreen';

/**
 * v2 `/quiz/explore` — server shell for the public quiz list.
 *
 * A PUBLIC SURFACE, like `/cases`: the list answers with no token (measured
 * 21 October 2026), a visitor can read it, and a shared link to it should
 * unfurl. So it gets the full treatment — real title, description, canonical
 * URL, an OG card and `robots: index` — where the account-only quiz pages get
 * a bare title and `noindex`. It sits OUTSIDE the `(practice)` and `(solo)`
 * route groups on purpose: no gate stands over it.
 *
 * NO SERVER PREFETCH, deliberately: the rows are per-viewer (`is_mine`), the
 * client query cache owns them, paints them instantly on a return visit and
 * re-checks on every arrival. The one cost is a skeleton on a hard load, the
 * same as every other list in the solo quiz.
 */
export function generateMetadata(): Metadata {
  const canonical = `${getAppUrl().replace(/\/$/, '')}/quiz/explore`;
  const title = 'Explore quizzes';
  const description =
    'Public quizzes from verified authors on Lawexa — open one and take it at your own pace.';

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SEO.siteName,
      type: 'website',
      locale: SEO.locale,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      site: SEO.twitterHandle,
    },
    robots: { index: true, follow: true },
  };
}

/** Same router-cache lever and safety argument as `/quiz` beside it — the
 *  segment awaits nothing, so a re-used payload cannot show stale data. */
export const unstable_dynamicStaleTime = 300;

export default function V2QuizExplorePage() {
  return <ExploreScreen />;
}
