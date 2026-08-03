import { QuizSegmentFallback } from '@/v2/features/quiz/ui/states';

/**
 * The `/quiz` SEGMENT boundary — the fallback for whatever CHILD is being
 * navigated into (player, history, stats). Those children do not share a body
 * shape, so per the house rule in `app/v2/loading.tsx` this boundary is
 * NEUTRAL — a quiet beat, not one sibling's silhouette. Each child carries its
 * own page-shaped `loading.tsx`.
 *
 * The hub's OWN shape lives beside the hub page in the `(hub)` route group, so
 * it wraps the hub and nothing else. Do not "simplify" the two files into one.
 */
export default function QuizSegmentLoading() {
  return <QuizSegmentFallback />;
}
