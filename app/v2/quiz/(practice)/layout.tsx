import { redirect } from 'next/navigation';

/**
 * v2 `/quiz/*`, the PRACTICE half — the session player and its results, the
 * history and the stats — HIDDEN (Stay, 23 October 2026: "the current practice
 * quiz should not be there because we need to work on it alongside the
 * question data"). Every address here goes to the Quiz home. The screens, the
 * queries and the server's data stay as they are, for when practice comes
 * back; restoring it is this layout's old body:
 * `<QuizAccessGate surface="practice">{children}</QuizAccessGate>`.
 *
 * The practice hub that was `/quiz` moved out: `/quiz` is now the Quiz home
 * (`../(home)/page.tsx`), and `QuizHubScreen` is kept, unmounted.
 *
 * A layout, so ONE place hides every practice address, including v1's
 * `/quiz/play?s=` resume link. Temporary (307): practice is coming back.
 */
export default function V2QuizPracticeLayout(): never {
  redirect('/quiz');
}
