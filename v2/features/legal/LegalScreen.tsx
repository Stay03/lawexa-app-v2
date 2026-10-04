import Link from 'next/link';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * LegalScreen — the v2 frame for the Terms of Service and the Privacy Policy.
 *
 * ONE TEXT, TWO FRAMES. The legal wording lives in v1's pages
 * (`app/(legal)/terms/page.tsx`, `app/(legal)/privacy/page.tsx`), which render
 * the whole document as one `<article>`. The v2 routes import that article as
 * it stands and put it inside the v2 shell, so the wording a v2 reader sees can
 * never drift from the wording search engines and v1 readers see. Copying it
 * here would make two legal texts; moving it would edit frozen v1 for no harm.
 *
 * The frame adds only what the v2 shell lacks on these addresses: a reading
 * column (the same measure as v1's legal layout, `max-w-3xl`) and a way across
 * to the other document, which v1's legal header and footer gave and the v2
 * shell does not. The back arrow and the bar's title come from
 * `v2/shell/pushed-route.ts`; the article carries its own `<h1>`.
 */
export function LegalScreen({
  current,
  children,
}: {
  current: 'terms' | 'privacy';
  children: React.ReactNode;
}) {
  const other =
    current === 'terms'
      ? { href: '/privacy', label: 'Privacy policy' }
      : { href: '/terms', label: 'Terms of service' };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4 sm:pt-8">
      {children}

      <nav
        aria-label="Legal"
        className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-6 text-sm text-muted-foreground"
      >
        <Link
          href={other.href}
          className={cn(
            'rounded-sm underline-offset-4 transition-colors hover:text-foreground hover:underline',
            FOCUS_RING,
          )}
        >
          {other.label}
        </Link>
        <span aria-hidden className="text-muted-foreground/40">
          ·
        </span>
        <span>Law Guide Technology Limited</span>
      </nav>
    </div>
  );
}
