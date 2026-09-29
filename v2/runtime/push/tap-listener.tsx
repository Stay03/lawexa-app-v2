'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { tapTarget } from './tap';

/**
 * V2PushTapListener — the open-app half of a notification tap. Renders
 * nothing. Mounted once in `app/v2/layout.tsx` beside `V2PushLifecycle`.
 *
 * When a notification is tapped while Lawexa is open, the service worker
 * brings the tab to the front and, because the browser refuses to move a page
 * the worker does not control, posts the link here (see `tap.ts`). This
 * routes the open app to that message, as a tap on a closed app already does.
 *
 * `startMessages()` is needed because the listener is added with
 * `addEventListener`: until it is called, the browser holds worker messages
 * for this page and delivers none.
 */
export function V2PushTapListener(): null {
  const router = useRouter();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const container = navigator.serviceWorker;
    const onMessage = (event: MessageEvent) => {
      const target = tapTarget(event.data, window.location.origin);
      if (target) router.push(target);
    };
    container.addEventListener('message', onMessage);
    container.startMessages();
    return () => container.removeEventListener('message', onMessage);
  }, [router]);

  return null;
}
