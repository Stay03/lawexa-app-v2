import { redirect } from 'next/navigation';

import { LIBRARY_HREF } from '@/v2/features/quiz/solo/model';

/**
 * v2 `/quiz/library`, retired into the Quiz home's My quizzes tab (Stay, 23
 * October 2026: the home is two tabs). Old links and bookmarks land on the
 * tab. Temporary (307), like `/notes/mine`: the v2 experience is still an
 * opt-in, so a permanent redirect must wait for cutover.
 */
export default function V2QuizLibraryPage(): never {
  redirect(LIBRARY_HREF);
}
