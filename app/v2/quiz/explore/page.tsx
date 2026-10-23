import { redirect } from 'next/navigation';

import { EXPLORE_HREF } from '@/v2/features/quiz/solo/model';

/**
 * v2 `/quiz/explore`, retired into the Quiz home's Explore tab (Stay, 23
 * October 2026: the home is two tabs). Old and shared links land on the tab,
 * which now carries the public page's title, canonical and card. Temporary
 * (307), like `/notes/mine`, until cutover.
 */
export default function V2QuizExplorePage(): never {
  redirect(EXPLORE_HREF);
}
