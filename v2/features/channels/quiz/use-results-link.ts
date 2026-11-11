'use client';

import { useState } from 'react';

import { publicQuizResultsPath } from '@/lib/constants/quiz-share';
import { useShareUrl } from '@/v2/features/sharing/useShareUrl';

/**
 * A finished game's public results link, as everything that shares it hands
 * it out (`ShareResults`, `ResultCardShare`): the page's own origin, the
 * public results path, and an ambassador's code when the sharer has one, so a
 * signup from it credits them.
 *
 * The origin is read through a lazy `useState` initialiser, never in render:
 * both callers render only inside a mounted game, so the empty server value is
 * never painted, and reading `window` in render is a compiler-lint error.
 */
export function useResultsLink(gameUuid: string): string {
  const [origin] = useState(() => (typeof window === 'undefined' ? '' : window.location.origin));
  const shareUrl = useShareUrl();
  return origin ? shareUrl(`${origin}${publicQuizResultsPath(gameUuid)}`) : '';
}
