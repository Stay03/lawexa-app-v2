'use client';

import { V1_COOKIE_SET } from '@/v2/cookie';
import { removeServiceWorker } from '@/v2/runtime/sw/register';

/**
 * Chooses the classic design (`lawexa-ui=v1`: with the new design the default
 * for everyone, clearing the opt-in would only land back in it) and
 * hard-navigates home. A full page load (not a
 * router transition) is required so no prefetched v2 RSC payload survives the
 * switch back to v1.
 *
 * Its one caller is the Developer screen's "New Lawexa (v2)" switch. The
 * sidebar's "Switch to classic Lawexa" button and the bar menu's row were
 * removed when the new design became everyone's default (Stay, 26 October
 * 2026).
 *
 * The v2 service worker is removed before leaving, so the first v1 page is not
 * served by it. `removeServiceWorker` never takes longer than 1.5 s, and the
 * worker's own route removes it on the next load if this does not finish.
 */
export function switchBackToV1() {
  document.cookie = V1_COOKIE_SET;
  void removeServiceWorker().then(() => window.location.assign('/'));
}
