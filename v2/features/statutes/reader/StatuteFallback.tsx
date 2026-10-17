'use client';

import { usePathname } from 'next/navigation';
import { FlagIcon } from '@/v2/shell/FlagIcon';
import { useStatutePeek, type StatutePeek } from '../statute-peek';
import { STATUTE_COLUMN, StatuteDocumentSkeleton } from './states';
import './statute-masthead.css';

/**
 * The statute reader's loading shape — what `app/v2/statutes/[slug]/loading.tsx`
 * and the `app/v2/statutes` segment boundary render.
 *
 * ITS OWN FILE ON PURPOSE, for the reason `CaseFallback` gives: exported from
 * `StatuteScreen.tsx`, this put the whole statute reader behind the statutes
 * LIST's loading screen. Nothing in this file may import a screen.
 *
 * THE TAPPED ROW'S NAME, AT ONCE (speed step 5, 17 October 2026). When the
 * reader came from a statute row, the row left its name, designation, flag,
 * country and year (`statute-peek.ts`), and the masthead draws them in its own
 * type and place while the rest stays skeleton.
 */
export function StatuteFallback() {
  const peek = useStatutePeek(slugOf(usePathname()));
  return (
    <>
      <span role="status" className="sr-only">
        Loading statute
      </span>
      <div aria-hidden inert className={STATUTE_COLUMN}>
        <StatuteDocumentSkeleton masthead={peek ? <PeekMasthead peek={peek} /> : undefined} />
      </div>
    </>
  );
}

/** The statute's slug from `/statutes/{slug}` (a provision may follow), or
 *  undefined on any other path. */
function slugOf(pathname: string | null): string | undefined {
  const match = pathname?.match(/\/statutes\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

/** The kicker, the name and the designation as `StatuteHeader` sets them. The
 *  document type joins the end of the kicker when the statute arrives. */
function PeekMasthead({ peek }: { peek: StatutePeek }) {
  return (
    <div className="v2-statute-doc contents">
      <p className="doc-kicker flex flex-wrap items-center gap-x-2 gap-y-1">
        {peek.countryCode ? (
          <FlagIcon code={peek.countryCode} title={peek.countryName ?? undefined} className="-mt-px" />
        ) : null}
        {peek.countryName ? <span>{peek.countryName}</span> : null}
        {peek.countryName ? (
          <span aria-hidden className="text-muted-foreground/40">
            ·
          </span>
        ) : null}
        <span className="tabular-nums">{peek.year}</span>
      </p>
      <h1 className="doc-title text-foreground">{peek.title}</h1>
      {peek.shortTitle ? <p className="doc-citation">{peek.shortTitle}</p> : null}
    </div>
  );
}
