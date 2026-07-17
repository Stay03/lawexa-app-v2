'use client';

import { Button } from '@/components/ui/button';
import { V2_COOKIE_CLEAR } from '@/v2/cookie';

/**
 * Clears the v2 opt-in cookie and hard-navigates home. A full page load (not a
 * router transition) is required so no prefetched v2 RSC payload survives the
 * switch back to v1.
 */
export function SwitchBackButton() {
  function switchBack() {
    document.cookie = V2_COOKIE_CLEAR;
    window.location.assign('/');
  }

  return (
    <Button variant="outline" onClick={switchBack}>
      Switch back to v1
    </Button>
  );
}
