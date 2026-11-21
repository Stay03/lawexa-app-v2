'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';

import { BarFinalsWrapped } from '@/components/wrapped/BarFinalsWrapped';
import { WrappedError } from '@/components/wrapped/WrappedError';
import { WrappedLanding } from '@/components/wrapped/WrappedLanding';
import { Wrapped26Story } from '@/components/wrapped26/Wrapped26Story';
import { useWrapped2026 } from '@/lib/hooks/useWrapped2026';
import { useAuthStore } from '@/lib/stores/authStore';
import { wrappedSignedIn } from '@/lib/wrapped/access';
import { wrappedFontFamilies } from './fonts';

const noSubscribe = () => () => {};

/**
 * One page for everybody (see ./layout.tsx; Techlead, 21 November 2026). The
 * server's HTML is the landing page, which is also what a link preview reads.
 * On the device, a signed-in person with a Wrapped 2026 record gets the 2026
 * story. Without one (the server's 404: none, hidden, or outside the window)
 * the Bar Finals edition answers as it did before, and its own address is
 * /wrapped/bar-finals. A failed 2026 read gets Try again.
 */
export default function WrappedPage() {
  const router = useRouter();
  // The sign-in lives in the device's storage: until the page runs there, it is the landing page.
  const onDevice = useSyncExternalStore(noSubscribe, () => true, () => false);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const isGuest = useAuthStore((state) => state.isGuest);
  const signedIn = onDevice && wrappedSignedIn({ token, user, isGuest });
  const hidden = signedIn && Boolean(user?.wrapped_hidden);
  const wrapped2026 = useWrapped2026({ enabled: signedIn && !hidden });
  const close = useCallback(() => router.push('/'), [router]);

  if (hidden) return <WrappedLanding signedIn reason="hidden" />;

  if (signedIn && wrapped2026.isPending) {
    return (
      <div className="wr-stage" role="status" aria-label="Opening your Wrapped">
        <p style={{ color: 'var(--wr-cream)', font: '800 1.4rem/1.2 var(--wr-display)' }}>Opening your Wrapped…</p>
      </div>
    );
  }

  if (signedIn && wrapped2026.data) {
    return <Wrapped26Story record={wrapped2026.data} fonts={wrappedFontFamilies} onClose={close} />;
  }

  if (signedIn && wrapped2026.isError) {
    return <WrappedError retrying={wrapped2026.isFetching} onRetry={() => void wrapped2026.refetch()} />;
  }

  // No 2026 record, or signed out: the Bar Finals edition and its landing page, as before.
  return <BarFinalsWrapped fonts={wrappedFontFamilies} />;
}
