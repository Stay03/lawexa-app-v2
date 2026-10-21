import { QuizAccessGate } from '@/v2/features/quiz/access';

/**
 * v2 `/quiz/*`, the SOLO half that needs an account — the reader's own
 * library (`/quiz/library`) and an attempt in play or reviewed
 * (`/quiz/attempts/{uuid}`, `.../results`).
 *
 * The same gate as the practice group's, in the solo surface's words: the
 * server answers `401` to a visitor and `403` to a guest pass on every
 * attempt route, and the library is by definition an account's own. The two
 * solo addresses anyone may open — `/quiz/explore` and `/quiz/q/{uuid}` —
 * are NOT in this group: they sit directly under `app/v2/quiz/` with no gate,
 * and the quiz front shows the sign-in door only on Start (Arthur's option B,
 * 21 October 2026).
 *
 * The group adds no segment to the URL. See `../(practice)/layout.tsx` for
 * why the gate is a layout and why it is synchronous.
 */
export default function V2QuizSoloLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <QuizAccessGate surface="solo">{children}</QuizAccessGate>;
}
