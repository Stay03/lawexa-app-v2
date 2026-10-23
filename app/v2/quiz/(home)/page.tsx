import type { Metadata } from 'next';

import { SEO, getAppUrl } from '@/lib/constants/seo';
import { QuizHomeScreen } from '@/v2/features/quiz/home/QuizHomeScreen';

/**
 * v2 `/quiz` — the Quiz home: Explore and My quizzes, as two tabs (Stay, 23
 * October 2026). The practice hub that was here is hidden; see
 * `../(practice)/layout.tsx`.
 *
 * A PUBLIC SURFACE, because its first tab is: the public list answers with no
 * token, a visitor can read it, and a shared link should unfurl. So it takes
 * the treatment `/quiz/explore` had — title, description, canonical, an OG card
 * and `robots: index`. My quizzes (`?tab=mine`) is the same page; its rows are
 * an account's own and never rendered on the server.
 *
 * OUTSIDE the `(practice)` and `(solo)` groups on purpose: no gate stands over
 * it, and the My quizzes tab says its own refusals (`QuizHomeScreen`). The
 * `(home)` group exists so its shape lives in `(home)/loading.tsx` and wraps
 * this page only; the segment boundary (`../loading.tsx`) stays neutral.
 *
 * NO SERVER PREFETCH: the rows are per-viewer (`is_mine`), and the client
 * query cache owns them and re-checks on every arrival.
 */
export function generateMetadata(): Metadata {
  const canonical = `${getAppUrl().replace(/\/$/, '')}/quiz`;
  const title = 'Quiz';
  const description =
    'Public quizzes from verified authors on Lawexa, and the quizzes you write: take one at your own pace or share it.';

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

/** The segment awaits nothing, so a re-used router payload cannot show stale
 *  data; the rows re-check through the query layer on every arrival. */
export const unstable_dynamicStaleTime = 300;

export default function V2QuizHomePage() {
  return <QuizHomeScreen />;
}
