/** The Quiz home's two tabs (Stay, 23 October 2026). */
export type QuizHomeTab = 'explore' | 'mine';

/** `?tab=mine` is My quizzes; anything else, or nothing, is Explore. */
export function parseQuizHomeTab(raw: string | null): QuizHomeTab {
  return raw === 'mine' ? 'mine' : 'explore';
}
