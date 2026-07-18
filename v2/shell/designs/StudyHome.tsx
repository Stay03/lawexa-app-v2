'use client';

import { useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/authStore';
import { canAccessQuizPlayer } from '@/lib/utils/quiz-access';
import { canAccessSpaces } from '@/lib/utils/spaces-access';
import type { UserRole } from '@/types/auth';
import { useMounted } from '@/v2/shell/use-mounted';
import { HomeGreeting } from './HomeGreeting';
import { HomeComposer } from './HomeComposer';
import { HomePrompts } from './HomePrompts';
import { QuizModule } from './study/QuizModule';
import { StudySpaces } from './study/StudySpaces';
import { RecentlyViewed } from './study/RecentlyViewed';
import { RecentBookmarks } from './study/RecentBookmarks';
import { RecentConversations } from './study/RecentConversations';
import { StudyModeCard, StudyModeChip } from './study/StudyMode';
import { REVEAL } from './study/parts';

/**
 * StudyHome — the Study tab's home surface (owner #34). The shared greeting +
 * composer + suggested prompts stay the primary action; a deliberate workspace of
 * learning modules gathers around them for signed-in users:
 *
 *  - Quiz (role-gated to the quiz soft-launch audience, mirroring v1's
 *    `canAccessQuizPlayer` from the threaded role): continue an open session,
 *    a stats strip, recent topics — all to the real v1 quiz routes.
 *  - Study spaces (`type: 'study'`) with the §17 unread/mention badges.
 *  - A study-mode CTA — student-gated exactly like v1 (`profile.profession ===
 *    'student'`), read client-side from the sanctioned authStore. It flips a
 *    LOCAL study-mode state that marks the composer with a quiet status chip
 *    (HomeComposer is shared + boundary-frozen, so the marker rides adjacent to
 *    it — the same split v1 uses for confidential mode). The real
 *    `study_mode: true`-on-submit wiring lands with the chat wave.
 *  - Recent bookmarks and a recent-conversations strip (the shared recents peek).
 *
 * LAYOUT (Design B's proven DNA). DESKTOP = a two-column workspace: the compose
 * cluster + learning modules in the wide left column, a rail of spaces / bookmarks
 * / chats on the right. MOBILE = the modules scroll above a composer that DOCKS at
 * the thumb (`sticky bottom-0`, floating alone with a soft bottom fade,
 * `md:static`) so it never sinks below the fold (the hard-won B2 lesson). ONE
 * subtle staggered entrance (`REVEAL`, `fill-mode-both`, instant under reduced
 * motion). The greeting is v1's REAL smart engine (skeleton-first + the symmetric
 * confidential swap); confidential is owned here so greeting + composer stay in
 * lockstep. Suggested prompts are v1's ACTUAL four (owner #21), shared via
 * `HomePrompts`.
 *
 * GUESTS get the honest-minimum surface (greeting + composer + prompts, no
 * modules) — nothing to load, so no scaffolding and no skeletons. Both paths carry
 * `data-home-tab="study"` + the server-renderable `data-v2-marker="V2-HOME"`
 * marker the curl matrix greps for.
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
  const [input, setInput] = useState('');
  const [confidential, setConfidential] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const composerAreaRef = useRef<HTMLDivElement>(null);

  // v1 parity: filling a prompt stub also focuses the textarea (places the
  // cursor / opens the mobile keyboard) so the user can complete the stub.
  const fillPrompt = (prompt: string) => {
    setInput(prompt);
    composerAreaRef.current?.querySelector('textarea')?.focus();
  };

  // Study-mode is v1's STUDENT gate (`profile.profession === 'student'`), which is
  // client-only (not in the server-threaded props) — read from the sanctioned
  // authStore. `mounted` keeps the first client render identical to the server
  // (which can't know the profession), so the CTA fades in post-hydration instead
  // of causing a mismatch. Quiz uses the server-stable role, so it needs no guard.
  const mounted = useMounted();
  const profession = useAuthStore((s) => s.user?.profile?.profession);
  const isStudent = mounted && profession === 'student';
  const showQuiz = signedIn && canAccessQuizPlayer(role);

  // GUEST / signed-out — the honest minimum, mirroring the Chat/Work tabs: greeting
  // rides the top, the compose cluster is thumb-docked via `mt-auto` on mobile and
  // folded near the top-anchored greeting on desktop. No modules, no skeletons.
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
            <HomeComposer
              value={input}
              onValueChange={setInput}
              signedIn={signedIn}
              role={role}
              confidential={confidential}
              onConfidentialChange={setConfidential}
              className="p-2.5 shadow-lg"
              textareaClassName="text-base md:text-lg"
              sendButtonClassName="md:size-10"
            />
          </div>
          <div className="mt-3 hidden md:block">
            <HomePrompts variant="desktop" onSelect={fillPrompt} />
          </div>
        </div>
      </div>
    );
  }

  // SIGNED-IN — the workspace. A single flex column on mobile (custom `order` per
  // block); a two-column grid on desktop (`md:grid` overrides the flex). The rail
  // spans the left column's rows so it top-aligns beside the compose cluster
  // regardless of how many left modules are present (`md:items-start`).
  const hasLearningColumn = showQuiz || isStudent;

  return (
    <div
      data-v2-marker="V2-HOME"
      data-home-tab="study"
      className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 pb-8 pt-8 sm:px-6 md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:items-start md:gap-x-8 md:gap-y-6 md:pb-12 md:pt-12"
    >
      {/* Greeting — top of both breakpoints, full width on desktop. Left-aligned
          for the workspace feel; the confidential swap + skeleton-first live inside
          HomeGreeting. */}
      <div
        className={cn(REVEAL, 'order-1 duration-500 md:col-span-2 md:row-start-1')}
        style={{ animationDelay: '0ms' }}
      >
        <HomeGreeting
          name={name}
          confidential={confidential}
          align="left"
          subline="Your quizzes, spaces, and saved research."
          headingClassName="font-comfortaa text-[26px] font-semibold leading-tight md:text-[32px]"
        />
      </div>

      {/* Learning column — Quiz + the study-mode CTA. MOBILE: rides just under the
          greeting (order-2). DESKTOP: left column, below the compose cluster
          (row 4). Rendered only when it has content, so its grid cell never leaves
          a gap. */}
      {hasLearningColumn ? (
        <div
          className={cn(
            REVEAL,
            'order-2 flex flex-col gap-3 duration-500 md:order-none md:col-start-1 md:row-start-4 md:max-w-2xl',
          )}
          style={{ animationDelay: '180ms' }}
        >
          {showQuiz ? <QuizModule /> : null}
          {/* Student gate resolves post-hydration (client-only profession read), so
              the card is faded in on mount rather than popping in. */}
          {isStudent ? (
            <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300">
              <StudyModeCard checked={studyMode} onCheckedChange={setStudyMode} />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Rail — spaces / bookmarks / chats. MOBILE: after the learning column
          (order-3). DESKTOP: the right column, spanning the left column's rows so
          it top-aligns beside the composer. */}
      <div
        className={cn(
          REVEAL,
          'order-3 flex flex-col gap-4 duration-500 md:order-none md:col-start-2 md:row-start-2 md:row-end-5',
        )}
        style={{ animationDelay: '300ms' }}
      >
        {/* Recently viewed — backend Ask A, LIVE. The merged { type, viewed_at,
            item } feed of the user's last-opened cases / notes / statutes, top of
            the rail (above Study spaces). Available to every signed-in user (not
            spaces-gated), like the Bookmarks / Recent chats modules below it. */}
        <RecentlyViewed />

        {/* Spaces are soft-launch role-gated in v1 (canAccessSpaces — same rule
            as WorkHome; reviewer HIGH finding). Rail geometry is safe: it is one
            spanning cell, so dropping this module just shortens the column. */}
        {canAccessSpaces(role) ? <StudySpaces /> : null}
        <RecentBookmarks />
        <RecentConversations />
      </div>

      {/* Suggested prompts — MOBILE: `mt-auto` sinks them toward the thumb, above
          the docked composer (v1's stacked list). DESKTOP: left column, under the
          composer, as a quiet ChatGPT-style list (owner #27). */}
      <div
        className={cn(
          REVEAL,
          'order-4 mt-auto pt-8 duration-500 md:order-none md:col-start-1 md:row-start-3 md:mt-0 md:max-w-2xl md:pt-0',
        )}
        style={{ animationDelay: '150ms' }}
      >
        <div className="md:hidden">
          <HomePrompts variant="mobile" onSelect={fillPrompt} />
        </div>
        <div className="hidden md:block">
          <HomePrompts variant="desktop" onSelect={fillPrompt} />
        </div>
      </div>

      {/* Composer dock — MOBILE: `sticky bottom-0`, floating alone with a soft
          bottom fade dissolving the scrolling content behind it. DESKTOP: static,
          left column under the greeting. The entrance transform lives on the inner
          wrapper so it never touches the sticky element. */}
      <div className="sticky bottom-0 z-10 order-5 -mx-4 px-4 pb-3 pt-6 sm:-mx-6 sm:px-6 md:static md:z-auto md:col-start-1 md:row-start-2 md:mx-0 md:max-w-2xl md:px-0 md:pb-0 md:pt-0">
        {/* Mobile-only bottom fade (decorative; desktop drops it). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full bg-gradient-to-t from-background via-background/85 to-transparent md:hidden"
        />
        <div
          ref={composerAreaRef}
          className={cn(REVEAL, 'duration-500')}
          style={{ animationDelay: '90ms' }}
        >
          {/* Study-mode marker — rides ABOVE the composer, animating symmetrically
              in/out (owner #24). Only mounted for students, matching the CTA gate. */}
          {isStudent ? (
            <StudyModeChip active={studyMode} onClear={() => setStudyMode(false)} />
          ) : null}
          <HomeComposer
            value={input}
            onValueChange={setInput}
            signedIn={signedIn}
            role={role}
            confidential={confidential}
            onConfidentialChange={setConfidential}
            className="p-2.5 shadow-lg"
            textareaClassName="text-base md:text-lg"
            sendButtonClassName="md:size-10"
          />
        </div>
      </div>
    </div>
  );
}
