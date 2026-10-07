'use client';

import { useEffect } from 'react';
import { ensureServiceWorker } from './register';

/**
 * ServiceWorkerMount — registers the v2 service worker (`lawexa-sw.js`), or
 * removes it when the `sw` performance layer is off. Renders nothing. Mounted
 * once in `app/v2/layout.tsx`, so only v2 pages register it.
 */
export function ServiceWorkerMount(): null {
  useEffect(() => ensureServiceWorker(), []);
  return null;
}
