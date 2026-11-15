'use client';

import { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { canAccessQuizPlayer } from '@/lib/utils/quiz-access';
import { useGuestPassFailed } from '@/v2/runtime/guest-pass';
import { useV2Session } from '@/v2/runtime/session-context';
import { signInHref } from '@/v2/runtime/sign-in-href';
import { replaceUrlParams } from '@/v2/runtime/url-params';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { ScreenTitle } from '@/v2/shell/ScreenTitle';
import { SearchFieldShape } from '@/v2/shell/SearchField';
import { NO_QUIZ_FILTERS } from '../solo/home-model';
import { ExploreList, ExploreListSkeleton } from '../solo/explore/ExploreScreen';
import { LibraryList, LibraryListSkeleton, useQuizForm } from '../solo/library/LibraryScreen';
import { SoloCreateAccountState, SoloSignedOutState } from '../solo/states';
import { parseQuizHomeTab, type QuizHomeTab } from './quiz-home-tab';
import { QuizHomeTabs } from './QuizHomeTabs';
import { CodeSheet, LiveNowRow } from './LiveNowRow';

/**
 * QuizHomeScreen — `/quiz`, two tabs: Explore (`/quiz`) and My quizzes
 * (`/quiz?tab=mine`) (Stay, 23 October 2026: "Should be tabs discover/explore
 * and my quiz"). The practice quiz that was this page is hidden until it is
 * reworked with the question data (Stay, same day); its screens stay in the
 * code, and its addresses redirect here (`app/v2/quiz/(practice)/layout.tsx`).
 *
 * ── EXPLORE FIRST, AND FOR ANYONE ──────────────────────────────────────────
 * The public list answers with no token, so the home renders signed out and
 * opens on Explore. My quizzes is an account's own, so that tab says the same
 * two refusals the solo gate says (`access.tsx`): sign in when signed out,
 * create an account on a guest pass. While a visitor's guest pass is still
 * being minted it draws the list's skeleton, so the panel does not flash.
 *
 * ── THE TOP AREA IS CONCEPT C (Stay, 15 November 2026: "Go with C") ──────
 * A quiet header: the title, and a round + for Create quiz. Under it, for an
 * account that may play, the row of circles (`LiveNowRow`): "Enter code"
 * first, which opens the code sheet, then each live public game. Then the tabs
 * as text on a hairline. Gold is kept for the way into a game.
 *
 * The form belongs to the home (`useQuizForm`), so the + and a card's Edit
 * open the same dialog. It shows on Explore and on My quizzes alike (Stay, 23
 * October 2026: "Both"), and only to an account that may write one: a guest
 * and a visitor never see it.
 *
 * The tab is the query string, read on every render, so the strip is static
 * chrome and a tab is a shareable link.
 */

const PANEL_ID = 'quiz-home-panel';

/** The list column, widened so the card grid fits four across on a computer
 *  (version C, 23 October 2026), the quiz front's width. */
const HOME_COLUMN = cn(LIST_COLUMN, 'max-w-5xl');

export function QuizHomeScreen() {
  const session = useV2Session();
  const { signedIn, role, userId: viewerId } = session;
  const guestPassFailed = useGuestPassFailed();
  const pathname = usePathname() ?? '/quiz';
  const searchParams = useSearchParams();
  const tab = parseQuizHomeTab(searchParams.get('tab'));
  const canWrite = signedIn && canAccessQuizPlayer(role);
  const { openForm, dialog } = useQuizForm(viewerId);
  const [codeOpen, setCodeOpen] = useState(false);

  // Each tab has its own choices, so a tab starts with none set.
  const setTab = (next: QuizHomeTab) => {
    replaceUrlParams({ ...NO_QUIZ_FILTERS, tab: next === 'explore' ? null : next });
  };

  return (
    <div className={HOME_COLUMN}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <ScreenTitle className="mb-0 min-w-0 truncate" />
        {canWrite ? (
          <button
            type="button"
            onClick={() => openForm()}
            aria-label="Create quiz"
            title="Create quiz"
            className={cn(
              'v2-interactive inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-secondary/70',
              FOCUS_RING,
            )}
          >
            {/* "Create", not "New" (Arthur, 28 October 2026: "New quiz
                presupposes to play a new quiz"). */}
            <Plus aria-hidden className="size-5" />
          </button>
        ) : null}
      </div>

      {/* The live games and the join code, on both tabs, for an account that may play (live quiz without a Space). */}
      {canWrite ? <LiveNowRow viewerId={viewerId} onCode={() => setCodeOpen(true)} /> : null}

      <div className="mb-4">
        <QuizHomeTabs value={tab} onChange={setTab} panelId={PANEL_ID} />
      </div>

      <div id={PANEL_ID} role="tabpanel" aria-labelledby={`${PANEL_ID}-tab-${tab}`}>
        {tab === 'explore' ? (
          <ExploreList />
        ) : canWrite ? (
          <LibraryList openForm={openForm} />
        ) : !signedIn && !guestPassFailed ? (
          <LibraryListSkeleton />
        ) : !signedIn ? (
          <SoloSignedOutState signInHref={signInHref(`${pathname}?tab=mine`)} />
        ) : (
          <SoloCreateAccountState signInHref={signInHref(`${pathname}?tab=mine`)} />
        )}
      </div>

      {canWrite ? dialog : null}
      {canWrite ? <CodeSheet open={codeOpen} onOpenChange={setCodeOpen} /> : null}
    </div>
  );
}

/**
 * The home's route fallback (`app/v2/quiz/(home)/loading.tsx`): the same
 * title and tab strip, drawn for real but inert, over the row skeleton, so the
 * boundary hands over to the live screen without a jump. Create quiz is not
 * reserved: whether it exists depends on the viewer.
 */
export function QuizHomeFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading quizzes
      </span>
      {/* `aria-hidden` + `inert` (standards §8ii): a Suspense fallback is
          DELETED when content arrives, so nothing in it may hold focus. */}
      <div aria-hidden inert className={HOME_COLUMN}>
        <div className="mb-2 flex min-h-11 items-center">
          <ScreenTitle className="mb-0" />
        </div>
        <div className="mb-4">
          <QuizHomeTabs value="explore" onChange={() => undefined} panelId={PANEL_ID} />
        </div>
        <div className="mb-3 h-5 w-3/5 max-w-full" />
        {/* The search box is static chrome (SearchField's reservation). */}
        <SearchFieldShape className="mb-3" />
        <ExploreListSkeleton />
      </div>
    </>
  );
}
