'use client';

import { Button } from '@/components/ui/button';
import { V1_COOKIE_SET } from '@/v2/cookie';
import { removeServiceWorker } from '@/v2/runtime/sw/register';

/**
 * Chooses the classic design (`lawexa-ui=v1`: with the new design the default
 * for everyone, clearing the opt-in would only land back in it) and
 * hard-navigates home. A full page load (not a
 * router transition) is required so no prefetched v2 RSC payload survives the
 * switch back to v1. Exported so the sidebar/drawer footer button AND the header
 * overflow menu (`V2HeaderMenu`) share ONE definition of the exit.
 *
 * The v2 service worker is removed before leaving, so the first v1 page is not
 * served by it. `removeServiceWorker` never takes longer than 1.5 s, and the
 * worker's own route removes it on the next load if this does not finish.
 */
export function switchBackToV1() {
  document.cookie = V1_COOKIE_SET;
  void removeServiceWorker().then(() => window.location.assign('/'));
}

export function SwitchBackButton() {
  return (
    <Button variant="outline" onClick={switchBackToV1}>
      Switch to classic Lawexa
    </Button>
  );
}
