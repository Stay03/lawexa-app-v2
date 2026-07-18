'use client';

import { Button } from '@/components/ui/button';
import { V2_COOKIE_CLEAR } from '@/v2/cookie';

/**
 * Clears the v2 opt-in cookie and hard-navigates home. A full page load (not a
 * router transition) is required so no prefetched v2 RSC payload survives the
 * switch back to v1. Exported so the sidebar/drawer footer button AND the header
 * overflow menu (`V2HeaderMenu`) share ONE definition of the exit.
 */
export function switchBackToV1() {
  document.cookie = V2_COOKIE_CLEAR;
  window.location.assign('/');
}

export function SwitchBackButton() {
  return (
    <Button variant="outline" onClick={switchBackToV1}>
      Switch back to v1
    </Button>
  );
}
