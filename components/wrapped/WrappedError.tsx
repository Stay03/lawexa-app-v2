'use client';

import Link from 'next/link';
import { Loader2, RotateCw } from 'lucide-react';

/**
 * /wrapped when the record could not be read (a server error, or the phone is
 * offline). It says so and offers Try again, so a student with a Wrapped is
 * never told theirs is not ready.
 */
export function WrappedError({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <main className="wr-stage">
      <div className="wr-error" role="alert">
        <p className="wr-error-title">Your Wrapped didn&rsquo;t load.</p>
        <p>Lawexa couldn&rsquo;t reach your Wrapped just now. Check your connection, then try again.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <button type="button" className="wr-cta" data-tone="gold" onClick={onRetry} disabled={retrying} aria-busy={retrying}>
            {retrying ? <Loader2 aria-hidden size={18} className="wr-spin" /> : <RotateCw aria-hidden size={18} />}
            Try again
          </button>
          <Link className="wr-cta" data-tone="outline" href="/">
            Open Lawexa
          </Link>
        </div>
      </div>
    </main>
  );
}
