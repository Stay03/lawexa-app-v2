'use client';

import { useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/authStore';
import { canAccessQuizPlayer } from '@/lib/utils/quiz-access';
import { canAccessSpaces } from '@/lib/utils/spaces-access';
import type { UserRole } from '@/types/auth';
import { useMounted } from '@/v2/shell/use-mounted';
import { REVEAL } from './modules';
import { HomeGreeting } from './HomeGreeting';
import { HomeComposer } from './HomeComposer';
import { HomePrompts } from './HomePrompts';
import { useComposerDraft } from './composer/useComposerDraft';
import { QuizModule } from './study/QuizModule';
import { StudySpaces } from './study/StudySpaces';
import { RecentlyViewed } from './study/RecentlyViewed';
import { RecentBookmarks } from './study/RecentBookmarks';
import { RecentConversations } from './study/RecentConversations';
import { StudyModeCard, StudyModeChip } from './study/StudyMode';

/**
 * StudyHome — the Study tab's home surface (owner #34). The shared greeting +
 * composer + prompts stay the primary action; a workspace of learning modules
 * gathers around them for signed-in users:
 *
 *  - Quiz (role-gated to the quiz soft-launch audience, `canAccessQuizPlayer`):
 *    continue an open session, a stats strip, recent topics — all to the real v1
 *    quiz routes.
 *  - Study spaces (`type: 'study'`) with the §17 unread/mention badges.
 *  - A study-mode CTA — student-gated exactly like v1 (`profile.profession ===
 *    'student'`), read client-side from the sanctioned authStore. It flips a LOCAL
 *    study-mode state that marks the composer with a quiet status chip. The real
 *    `study_mode: true`-on-submit wiring lands with the chat wave.
 *  - Recent bookmarks, recently viewed, and a recent-conversations strip.
 *
 * DESKTOP LAYOUT (owner #37) uses the SAME orphan-proof composition as WorkHome —
 * two top-aligned single-cell columns that each flow independently, so a tall rail
 * can never inflate the left column into a void:
 *   - LEFT (primary, ~1fr): the TIGHT compose cluster (composer → prompts) then
 *     the primary learning modules — Quiz, and the student-gated study-mode CTA.
 *   - RIGHT (rail, 20rem): the glances — Recently viewed, Study spaces, Bookmarks,
 *     Recent chats.
 * The left wrapper is `display:contents` on mobile so the composer hoists to the
 * root scroll flex and its sticky dock keeps working; on desktop it becomes the
 * real left column.
 *
 * MOBILE keeps the hard-won structure: greeting on top, modules scrolling between
 * (Quiz + study-mode first, then the rail), prompts sinking toward the thumb, and
 * the composer floating alone in a sticky bottom dock with a soft fade. Per-block
 * `order` interleaves the left-column children with the rail into one scroll.
 *
 * GUESTS get the honest-minimum surface (greeting + composer + prompts, no
 * modules). ONE subtle staggered entrance (`REVEAL`, `fill-mode-both`, instant
 * under reduced motion). Both paths carry `data-home-tab="study"` + the
 * server-renderable `data-v2-marker="V2-HOME"` marker.
 */
export function StudyHome({
  name,
  signedIn = false,
  role,
}: {
  name?: string;
  signedIn?: boolean;
  role?: UserRole;
}) {
  const [input, setInput] = useComposerDraft();
  const [confidential, setConfidential] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const composerAreaRef = useRef<HTMLDivElement>(null);

  // v1 parity: filling a prompt stub also focuses the textarea (places the
  // cursor / opens the mobile keyboard) so the user can complete the stub.
  const fillPrompt = (prompt: string) => {
    setInput(prompt);
    composerAreaRef.current?.querySelector('textarea')?.focus();
  };

  // Shared composer props — spread into the one composer each branch renders. The
  // Study tab's study-mode CTA rides in as `studyMode`, so its create sends
  // `study_mode: true` (v1 parity).
  const composerProps = {
    value: input,
    onValueChange: setInput,
    signedIn,
    role,
    confidential,
    onConfidentialChange: setConfidential,
    studyMode,
    className: 'p-2.5 shadow-lg',
    textareaClassName: 'text-base md:text-lg',
    sendButtonClassName: 'md:size-10',
  };

  // Study-mode is v1's STUDENT gate (`profile.profession === 'student'`), which is
  // client-only (not in the server-threaded props) — read from the sanctioned
  // authStore. `mounted` keeps the first client render identical to the server, so
  // the CTA fades in post-hydration instead of causing a mismatch. Quiz uses the
  // server-stable role, so it needs no guard.
  const mounted = useMounted();
  const profession = useAuthStore((s) => s.user?.profile?.profession);
  const isStudent = mounted && profession === 'student';
  const showQuiz = signedIn && canAccessQuizPlayer(role);

  // GUEST / signed-out — the honest minimum, mirroring the Chat/Work tabs.
  if (!signedIn) {
    return (
      <div
        data-v2-marker="V2-HOME"
        data-home-tab="study"
        className="relative mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 pb-8 pt-10 md:pb-12 md:pt-36"
      >
        <HomeGreeting
          name={name}
          confidential={confidential}
          align="center"
          subline="Quizzes, bookmarks, and everything you're learning."
          headingClassName="font-comfortaa text-[1.75rem] font-semibold tracking-tight text-balance sm:text-[2rem] md:text-[2.25rem]"
        />

        <div className="mt-auto md:mt-10">
          <div className="mb-3 md:hidden">
            <HomePrompts variant="mobile" onSelect={fillPrompt} />
          </div>
          <div ref={composerAreaRef}>
            <HomeComposer {...composerProps} />
          </div>
          <div className="mt-3 hidden md:block">
            <HomePrompts variant="desktop" onSelect={fillPrompt} />
          </div>
        </div>
      </div>
    );
  }

  // SIGNED-IN — the workspace. Mobile is one flex column (`order` sequences the
  // blocks); desktop is the two-column grid (`md:grid` overrides the flex).
  return (
    <div
      data-v2-marker="V2-HOME"
      data-home-tab="study"
      className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 pb-8 pt-8 sm:px-6 md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:items-start md:gap-x-8 md:gap-y-6 md:pb-12 md:pt-12"
    >
      {/* Greeting — full-width, left-aligned (workspace feel). */}
      <div className={cn(REVEAL, 'order-1 duration-500 md:col-span-2 md:row-start-1')}>
        <HomeGreeting
          name={name}
          confidential={confidential}
          align="left"
          subline="Your quizzes, spaces, and saved research."
          headingClassName="font-comfortaa text-[26px] font-semibold leading-tight md:text-[32px]"
        />
      </div>

      {/* LEFT COLUMN — `display:contents` on mobile so the composer hoists to the
          root scroll flex; a real flex column (grid col 1) on desktop. */}
      <div className="contents md:flex md:min-w-0 md:flex-col md:gap-4 md:col-start-1 md:row-start-2">
        {/* Composer dock — MOBILE: `sticky bottom-0`, floating alone with a soft
            bottom fade. DESKTOP: static, top of the left column. The entrance
            transform lives on the inner wrapper so it never touches the sticky
            element. */}
        <div className="sticky bottom-0 z-10 order-6 -mx-4 px-4 pb-3 pt-6 sm:-mx-6 sm:px-6 md:static md:z-auto md:order-1 md:mx-0 md:px-0 md:pb-0 md:pt-0">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full bg-gradient-to-t from-background via-background/85 to-transparent md:hidden"
          />
          <div
            ref={composerAreaRef}
            className={cn(REVEAL, 'duration-500')}
            style={{ animationDelay: '80ms' }}
          >
            {/* Study-mode marker — rides ABOVE the composer, animating symmetrically
                in/out (owner #24). Only mounted for students, matching the CTA. */}
            {isStudent ? (
              <StudyModeChip active={studyMode} onClear={() => setStudyMode(false)} />
            ) : null}
            <HomeComposer {...composerProps} />
          </div>
        </div>

        {/* Suggested prompts — MOBILE: `mt-auto` toward the thumb. DESKTOP: directly
            under the composer, the tight cluster. */}
        <div
          className={cn(
            REVEAL,
            'order-5 mt-auto pt-8 duration-500 md:order-2 md:mt-0 md:pt-0',
          )}
          style={{ animationDelay: '160ms' }}
        >
          <div className="md:hidden">
            <HomePrompts variant="mobile" onSelect={fillPrompt} />
          </div>
          <div className="hidden md:block">
            <HomePrompts variant="desktop" onSelect={fillPrompt} />
          </div>
        </div>

        {/* Quiz — the primary learning module. MOBILE: scrolls under the greeting
            (order-2). DESKTOP: left column, below the compose cluster. */}
        {showQuiz ? (
          <div
            className={cn(REVEAL, 'order-2 mt-6 duration-500 md:order-3 md:mt-0')}
            style={{ animationDelay: '200ms' }}
          >
            <QuizModule />
          </div>
        ) : null}

        {/* Study-mode CTA — student-gated; resolves post-hydration (client-only
            profession read), so it fades in on mount rather than popping in.
            MOBILE order-3 (beside Quiz); DESKTOP below Quiz in the left column. */}
        {isStudent ? (
          <div className="order-3 mt-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 md:order-4 md:mt-0">
            <StudyModeCard checked={studyMode} onCheckedChange={setStudyMode} />
          </div>
        ) : null}
      </div>

      {/* RAIL — the glance modules. MOBILE: scrolls between the learning modules
          and the compose cluster (order-4). DESKTOP: the right column (grid col 2). */}
      <div
        className={cn(
          REVEAL,
          'order-4 mt-6 flex flex-col gap-4 duration-500 md:col-start-2 md:row-start-2 md:mt-0 md:min-w-0',
        )}
        style={{ animationDelay: '240ms' }}
      >
        {/* Recently viewed — backend Ask A, LIVE. Available to every signed-in user
            (not spaces-gated), top of the rail. */}
        <RecentlyViewed />
        {/* Spaces are soft-launch role-gated in v1 (canAccessSpaces). */}
        {canAccessSpaces(role) ? <StudySpaces /> : null}
        <RecentBookmarks />
        <RecentConversations />
      </div>
    </div>
  );
}
