'use client';

import { usePathname } from 'next/navigation';
import { FlagIcon } from '@/v2/shell/FlagIcon';
import { useCasePeek, type CasePeek } from '../case-peek';
import { formatCaseDate } from '../case-row-model';
import { CASE_COLUMN, CaseDocumentSkeleton } from './states';
import './case-masthead.css';

/**
 * The case page's loading shape: the document skeleton at the real geometry.
 * `CaseScreen` renders it as its Suspense fallback, `CaseLoading` while the
 * memory cache holds nothing drawable, and the `app/v2/cases` segment boundary
 * for every list → case click.
 *
 * ITS OWN FILE ON PURPOSE. A loading boundary ships every module its imports
 * reach, before the page it stands in for has arrived. Exported from
 * `CaseScreen.tsx`, this put the whole case reader (the document, the outline,
 * the chat) behind the cases LIST's loading screen; here it reaches only the
 * skeleton. Nothing in this file may import a screen.
 *
 * THE TAPPED ROW'S NAME, AT ONCE (speed step 4, 17 October 2026). When the
 * reader came from a case row, the row left its name, court, date and flag
 * (`case-peek.ts`), and the masthead draws them in its own type and place
 * while the rest stays skeleton. The name is on screen before any request has
 * answered, and the case arriving changes nothing in it.
 */
export function CaseFallback() {
  const peek = useCasePeek(slugOf(usePathname()));
  return (
    <>
      <span role="status" className="sr-only">
        Loading case
      </span>
      <div aria-hidden inert className={CASE_COLUMN}>
        <CaseDocumentSkeleton masthead={peek ? <PeekMasthead peek={peek} /> : undefined} />
      </div>
    </>
  );
}

/** The case's slug from `/cases/{slug}`, or undefined on any other path. */
function slugOf(pathname: string | null): string | undefined {
  const match = pathname?.match(/\/cases\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

/** The kicker and the name exactly as `CaseDocument`'s header sets them. The
 *  verified mark is left out: the row does not know it, and it joins the end
 *  of the kicker when the case arrives. */
function PeekMasthead({ peek }: { peek: CasePeek }) {
  const date = formatCaseDate(peek.judgmentDate, 'long');
  return (
    <div className="v2-case-doc contents">
      <p className="doc-kicker flex flex-wrap items-center gap-x-2 gap-y-1">
        {peek.countryCode ? (
          <FlagIcon code={peek.countryCode} title={peek.countryName ?? undefined} className="-mt-px" />
        ) : null}
        {peek.court ? <span>{peek.court}</span> : null}
        {date ? (
          <>
            {peek.court ? (
              <span aria-hidden className="text-muted-foreground/40">
                ·
              </span>
            ) : null}
            <span className="tabular-nums">{date}</span>
          </>
        ) : null}
      </p>
      <h1 className="doc-title text-foreground" title={peek.rawTitle}>
        {peek.title}
      </h1>
    </div>
  );
}
