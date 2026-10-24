'use client';

import { HomeTimeline } from '@/v2/features/home-timeline/HomeTimeline';
import { HOME_SURFACE_TIMELINE } from './home-frame';

/**
 * TimelineHome — the Work or Study tab for a signed-in reader: the day-by-day
 * timeline of their Spaces. The chat box under it is the home's shared one
 * (`HomeFrame`, Stay, 24 October 2026), pinned at the foot of the screen, so
 * the last row scrolls up above it.
 */
export function TimelineHome({ tab }: { tab: 'work' | 'study' }) {
  return (
    <div data-v2-marker="V2-HOME" data-home-tab={tab} className={HOME_SURFACE_TIMELINE}>
      <HomeTimeline type={tab} />
    </div>
  );
}
