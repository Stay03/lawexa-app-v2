'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';

import { WrappedError } from '@/components/wrapped/WrappedError';
import { WrappedLanding } from '@/components/wrapped/WrappedLanding';
import { WrappedStory } from '@/components/wrapped/WrappedStory';
import { useWrapped } from '@/lib/hooks/useWrapped';
import { useAuthStore } from '@/lib/stores/authStore';
import { wrappedSignedIn } from '@/lib/wrapped/access';
import type { ShareFonts } from '@/lib/wrapped/share-image';

const noSubscribe = () => () => {};

/**
 * The Bar Finals edition (live 8 November 2026): a signed-in student with a
 * record gets the story; a failed read gets Try again; anyone else stays on
 * the landing page, which says why when they are signed in (hidden, or none
 * yet). Shown at /wrapped/bar-finals, and at /wrapped for someone with no
 * 2026 record (app/wrapped/page.tsx).
 */
export function BarFinalsWrapped({ fonts }: { fonts: ShareFonts }) {
  const router = useRouter();
  // The sign-in lives in the device's storage: until the page runs there, it is the landing page.
  const onDevice = useSyncExternalStore(noSubscribe, () => true, () => false);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const isGuest = useAuthStore((state) => state.isGuest);
  const signedIn = onDevice && wrappedSignedIn({ token, user, isGuest });
  const hidden = signedIn && Boolean(user?.wrapped_hidden);
  const wrapped = useWrapped({ enabled: signedIn && !hidden });
  const close = useCallback(() => router.push('/'), [router]);

  if (hidden) return <WrappedLanding signedIn reason="hidden" />;

  if (signedIn && wrapped.isPending) {
    return (
      <div className="wr-stage" role="status" aria-label="Opening your Wrapped">
        <p style={{ color: 'var(--wr-cream)', font: '800 1.4rem/1.2 var(--wr-display)' }}>Opening your Wrapped…</p>
      </div>
    );
  }

  if (signedIn && wrapped.data) {
    return <WrappedStory record={wrapped.data} fonts={fonts} onClose={close} />;
  }

  if (signedIn && wrapped.isError) {
    return <WrappedError retrying={wrapped.isFetching} onRetry={() => void wrapped.refetch()} />;
  }

  return <WrappedLanding signedIn={signedIn} reason={signedIn ? 'not-ready' : undefined} />;
}
