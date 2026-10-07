'use client';

import { Button } from '@/components/ui/button';
import { V2_COOKIE_CLEAR } from '@/v2/cookie';
import { removeServiceWorker } from '@/v2/runtime/sw/register';

/**
 * Clears the v2 opt-in cookie and hard-navigates home. A full page load (not a
 * router transition) is required so no prefetched v2 RSC payload survives the
 * switch back to v1. Exported so the sidebar/drawer footer button AND the header
 * overflow menu (`V2HeaderMenu`) share ONE definition of the exit.
 *
 * The v2 service worker is removed before leaving, so the first v1 page is not
 * served by it. `removeServiceWorker` never takes longer than 1.5 s, and the
 * worker's own route removes it on the next load if this does not finish.
 */
export function switchBackToV1() {
  document.cookie = V2_COOKIE_CLEAR;
  void removeServiceWorker().then(() => window.location.assign('/'));
}

export function SwitchBackButton() {
  return (
    <Button variant="outline" onClick={switchBackToV1}>
      Switch back to v1
    </Button>
  );
}
