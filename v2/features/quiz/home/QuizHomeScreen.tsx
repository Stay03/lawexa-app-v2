'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { canAccessQuizPlayer } from '@/lib/utils/quiz-access';
import { useGuestPassFailed } from '@/v2/runtime/guest-pass';
import { useV2Session } from '@/v2/runtime/session-context';
import { signInHref } from '@/v2/runtime/sign-in-href';
import { replaceUrlParams } from '@/v2/runtime/url-params';
import { CREATE_PILL, FOCUS_RING } from '@/v2/shell/designs/modules';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { ScreenTitle } from '@/v2/shell/ScreenTitle';
import { ExploreList, ExploreListSkeleton } from '../solo/explore/ExploreScreen';
import { LibraryList, LibraryListSkeleton, useQuizForm } from '../solo/library/LibraryScreen';
import { SoloCreateAccountState, SoloSignedOutState } from '../solo/states';
import { parseQuizHomeTab, type QuizHomeTab } from './quiz-home-tab';
import { QuizHomeTabs } from './QuizHomeTabs';

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
 * ── NEW QUIZ IS ON THE TABS LINE, ON MY QUIZZES ────────────────────────────
 * The form belongs to the home (`useQuizForm`), so the pill on the tabs line
 * and a row's Edit open the same dialog. It shows only on My quizzes, and only
 * to an account that may write one.
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

  const setTab = (next: QuizHomeTab) => {
    replaceUrlParams({ tab: next === 'explore' ? null : next });
  };

  return (
    <div className={HOME_COLUMN}>
      <ScreenTitle />

      <div className="mb-3 flex items-center justify-between gap-3">
        <QuizHomeTabs value={tab} onChange={setTab} panelId={PANEL_ID} />
        {tab === 'mine' && canWrite ? (
          <button
            type="button"
            onClick={() => openForm()}
            className={cn(CREATE_PILL, 'shrink-0', FOCUS_RING)}
          >
            <Plus aria-hidden className="size-4" />
            New quiz
          </button>
        ) : null}
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
    </div>
  );
}

/**
 * The home's route fallback (`app/v2/quiz/(home)/loading.tsx`): the same
 * title and tab strip, drawn for real but inert, over the row skeleton, so the
 * boundary hands over to the live screen without a jump. New quiz is not
 * reserved: whether it exists depends on the tab and the viewer.
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
        <ScreenTitle />
        <div className="mb-3 flex items-center justify-between gap-3">
          <QuizHomeTabs value="explore" onChange={() => undefined} panelId={PANEL_ID} />
        </div>
        <div className="mb-3 h-5 w-3/5 max-w-full" />
        <ExploreListSkeleton />
      </div>
    </>
  );
}
