'use client';

import { Heart } from 'lucide-react';

/**
 * PulsingHeart - A Valentine's Day greeting component with animated heart icon
 * Features a smooth heartbeat animation using custom CSS keyframes
 */
export function PulsingHeart() {
  return (
    <div className="inline-flex items-center gap-2">
      <Heart
        className="h-9 w-9 fill-red-500 text-red-500 animate-heartbeat"
        aria-label="Valentine's Day heart"
      />
    </div>
  );
}
