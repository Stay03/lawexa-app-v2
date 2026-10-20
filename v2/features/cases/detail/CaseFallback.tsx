'use client';

import { usePathname } from 'next/navigation';
import { ArrowUp, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isAccountRole } from '@/v2/runtime/account';
import { useV2Session } from '@/v2/runtime/session-context';
import { useCasePeek, type CasePeek } from '../case-peek';
import { CaseActionsShape } from './CaseActionsShape';
import { CaseHeader } from './CaseHeader';
import { CaseDocumentSkeleton } from './states';
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
  return <CaseFallbackFor slug={slugOf(usePathname())} />;
}

/**
 * The same loading shape for a case the address bar does not name yet: the
 * move-first frame a case link raises in the tap (`v2/shell/move-first.tsx`;
 * "a case opens at once", Stay, 17 October 2026), drawn while the router is
 * still on the list. The row's peek is already kept when it draws: the row's
 * click handler runs before the link's navigation.
 *
 * THE ASK BOX IS PART OF THE SHAPE. The case page ends in the "Ask about this
 * case" box; drawing it here too means the frame, this boundary and the page
 * all show it in the same place, so it never appears late or blinks between
 * them. The column is the page's own (`CaseScreen`): a full-height flex
 * column with the box pinned to its bottom. A visitor without an account has
 * no box on the page (Stay, 19 October 2026), so the frame draws none for them
 * either and keeps the page's bottom room instead.
 */
export function CaseFallbackFor({ slug }: { slug: string | undefined }) {
  const peek = useCasePeek(slug);
  const { signedIn: sessionSignedIn, role } = useV2Session();
  // The page's own rule (`CaseScreen`): the ask box is an account's, and a
  // guest pass reads the case as a visitor.
  const signedIn = sessionSignedIn && isAccountRole(role);
  return (
    <>
      <span role="status" className="sr-only">
        Loading case
      </span>
      <div aria-hidden inert className="flex min-h-full w-full">
        <div
          className={cn(
            'v2-case-doc relative mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pt-5 sm:pt-8',
            !signedIn && 'pb-24',
          )}
        >
          <CaseDocumentSkeleton header={peek ? <PeekHeader peek={peek} /> : undefined} />
          {signedIn ? <CaseAskShell /> : null}
        </div>
      </div>
    </>
  );
}

/** The case's slug from `/cases/{slug}`, or undefined on any other path. */
export function slugOf(pathname: string | null): string | undefined {
  const match = pathname?.match(/\/cases\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * The closed "Ask about this case" box, still: `CaseAskDock`'s resting
 * wrapper (sticky at the column's bottom, the gradient under it, the 26rem
 * card) around `PromptInput`'s box with the composer's row (+, the
 * placeholder, Send off). Nothing in it takes a tap or focus; the real box
 * replaces it when the case screen mounts.
 */
function CaseAskShell() {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-auto px-4 pb-3 pt-10">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full bg-gradient-to-t from-background from-35% via-background/80 to-transparent" />
      <div className="mx-auto w-full max-w-[26rem] rounded-2xl border border-transparent">
        <div className="gold-shimmer rounded-3xl p-[1px]">
          <div className="rounded-3xl bg-background p-2 shadow-[0_6px_16px_-8px_rgba(0,0,0,0.28)]">
            <div className="flex items-end gap-1.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-primary">
                <Plus className="size-4" />
              </span>
              <span className="min-h-9 flex-1 px-2 py-2 text-base text-muted-foreground md:text-sm">
                Ask about this case
              </span>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-50">
                <ArrowUp className="size-4" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The page's heading block, drawn from the tapped row's facts by the page's own
 * `CaseHeader` (Stay, 20 October 2026: "The loading is jumpy"). Both lists
 * carry every fact the header shows; one the list did not send is left out
 * until the case arrives. "Full judgment" is drawn when the case has a report:
 * the page leaves it off only past the view limit, which the row cannot know.
 */
function PeekHeader({ peek }: { peek: CasePeek }) {
  return (
    <CaseHeader
      facts={{
        countryCode: peek.countryCode,
        countryName: peek.countryName,
        court: peek.court,
        judgmentDate: peek.judgmentDate,
        isVerified: peek.isVerified,
        name: peek.title,
        rawTitle: peek.rawTitle,
        citation: peek.fullCitation,
        suitNo: peek.suitNo,
        topic: peek.topic,
        outcome: peek.outcome,
      }}
      actions={
        <CaseActionsShape
          fullReport={peek.hasFullReport}
          isBookmarked={peek.isBookmarked}
          bookmarksCount={peek.bookmarksCount}
        />
      }
    />
  );
}
