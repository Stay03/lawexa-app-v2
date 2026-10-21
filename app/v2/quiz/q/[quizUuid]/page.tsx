import type { Metadata } from 'next';

import { SEO, getAppUrl } from '@/lib/constants/seo';
import { fetchQuizPreviewForMetadata } from '@/lib/api/server';
import { QuizFrontScreen } from '@/v2/features/quiz/solo/front/QuizFrontScreen';

/**
 * v2 `/quiz/q/[quizUuid]` — server shell for one quiz's front.
 *
 * A quiz is SHARED BY ITS LINK, so a pasted address has to unfurl with the
 * quiz's own title, whoever opens it. The page is a server shell that owns
 * `generateMetadata` (read through the public preview, with no credentials)
 * and renders the `'use client'` screen. It sits OUTSIDE the `(practice)` and
 * `(solo)` route groups on purpose: anyone may open a quiz's front, and only
 * Start asks for an account (Arthur's option B, 21 October 2026).
 *
 * THE FIXED `q` PREFIX IS LOAD-BEARING: `app/v2/quiz/(practice)/[sessionUuid]`
 * catches any other `/quiz/{id}`, so a quiz cannot live at `/quiz/{uuid}`.
 *
 * Only a PUBLIC quiz is indexable. A `link` quiz unfurls for the people it is
 * sent to and asks search engines to stay out; a private or unknown one falls
 * back to the site card and `noindex`, never a broken card.
 */
interface QuizFrontPageProps {
  params: Promise<{ quizUuid: string }>;
}

export async function generateMetadata({ params }: QuizFrontPageProps): Promise<Metadata> {
  const { quizUuid } = await params;
  const appUrl = getAppUrl().replace(/\/$/, '');
  const quiz = await fetchQuizPreviewForMetadata(quizUuid);

  if (!quiz) {
    return {
      title: { absolute: SEO.defaultTitle },
      description: SEO.defaultDescription,
      robots: { index: false, follow: false },
    };
  }

  const canonical = `${appUrl}/quiz/q/${quizUuid}`;
  const title = quiz.title;
  const length = `${quiz.question_count} ${quiz.question_count === 1 ? 'question' : 'questions'}`;
  const description =
    quiz.description ??
    (quiz.author ? `A ${length} quiz by ${quiz.author} on Lawexa.` : `A ${length} quiz on Lawexa.`);
  const indexable = quiz.visibility === 'public';

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
    robots: { index: indexable, follow: indexable },
  };
}

/** Same router-cache lever and safety argument as `/quiz` beside it: the
 *  segment awaits only its metadata, and the screen's own reads re-check
 *  on their own schedule. */
export const unstable_dynamicStaleTime = 300;

export default async function V2QuizFrontPage({ params }: QuizFrontPageProps) {
  const { quizUuid } = await params;
  return <QuizFrontScreen quizUuid={quizUuid} />;
}
