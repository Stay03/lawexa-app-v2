'use client';

import { useLayoutEffect } from 'react';
import { markRouteSkeleton } from './route-skeleton-state';

/**
 * Rendered inside the conversation route's skeleton (loading.tsx). Draws
 * nothing; it only marks the route skeleton as on screen while it is mounted,
 * so the screen hands over without holding its own skeleton
 * (route-skeleton-state.ts).
 */
export function RouteSkeletonMark(): null {
  useLayoutEffect(() => markRouteSkeleton(), []);
  return null;
}
