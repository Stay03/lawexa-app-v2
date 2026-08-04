import { SpacesFallback } from '@/v2/features/spaces/list/SpacesScreen';

/**
 * Route-level loading boundary for `/spaces` — inside the `(list)` route group
 * so the LIST's shape wraps only the list, never `/spaces/[spaceId]` beneath
 * the same segment (the quiz `(hub)` precedent).
 *
 * It renders the SAME component the screen exports as its own Suspense
 * fallback, so route boundary → Suspense fallback → live list is one
 * continuous shape and nothing moves at either hand-off. The fallback owns its
 * `aria-hidden` + `inert` and its still (unpulsed) skeleton itself, in
 * `SpacesScreen`, so this file cannot drift from it.
 */
export default function SpacesLoading() {
  return <SpacesFallback />;
}
