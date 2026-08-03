import { QuizHubFallback } from '@/v2/features/quiz/hub/QuizHubScreen';

/**
 * Route-level loading boundary for `/quiz` — inside the `(hub)` route group so
 * the HUB's shape wraps only the hub, never the player / history / stats routes
 * beneath the same segment (see `app/v2/quiz/loading.tsx` and the skeleton-system
 * note in `app/v2/loading.tsx`).
 *
 * It renders the SAME component the screen exports, so route boundary → live hub
 * is one continuous shape and nothing moves at the hand-off. A hand-drawn
 * fallback diverges from the real surface within two design rounds.
 */
export default function QuizHubLoading() {
  return <QuizHubFallback />;
}
