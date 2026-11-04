'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';

import { WrappedLanding } from '@/components/wrapped/WrappedLanding';
import { WrappedStory } from '@/components/wrapped/WrappedStory';
import { useWrapped } from '@/lib/hooks/useWrapped';
import { useAuthStore } from '@/lib/stores/authStore';
import { wrappedFontFamilies } from './fonts';

const noSubscribe = () => () => {};

/**
 * One page for everybody (see ./layout.tsx). The server's HTML is the landing
 * page, which is also what a link preview reads. On the device, a signed-in
 * student with a Wrapped gets the story; anyone else stays on the landing
 * page, which says why when they are signed in.
 */
export default function WrappedPage() {
  const router = useRouter();
  // The sign-in lives in the device's storage: until the page runs there, it is the landing page.
  const onDevice = useSyncExternalStore(noSubscribe, () => true, () => false);
  const token = useAuthStore((state) => state.token);
  const isGuest = useAuthStore((state) => state.isGuest);
  const signedIn = onDevice && Boolean(token) && !isGuest;
  const wrapped = useWrapped({ enabled: signedIn });
  const close = useCallback(() => router.push('/'), [router]);

  if (signedIn && wrapped.isPending) {
    return (
      <div className="wr-stage" role="status" aria-label="Opening your Wrapped">
        <p style={{ color: 'var(--wr-cream)', font: '800 1.4rem/1.2 var(--wr-display)' }}>Opening your Wrapped…</p>
      </div>
    );
  }

  if (signedIn && wrapped.data) {
    return <WrappedStory record={wrapped.data} fonts={wrappedFontFamilies} onClose={close} />;
  }

  return <WrappedLanding signedIn={signedIn} />;
}
