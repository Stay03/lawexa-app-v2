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
import {
  DOCK_FADE,
  HOME_GREETING_HEADING_FOCUSED,
  HOME_GREETING_HEADING_WORKSPACE,
  HOME_SURFACE_FOCUSED,
  HOME_SURFACE_WORKSPACE,
  WORKSPACE_COMPOSER_DOCK,
  WORKSPACE_GREETING,
  WORKSPACE_LEFT_COLUMN,
  WORKSPACE_PRIMARY_MODULE,
  WORKSPACE_PROMPTS,
  WORKSPACE_RAIL,
  WORKSPACE_SECONDARY_MODULE,
} from './home-frame';
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
 * modules). Both paths carry `data-home-tab="study"` + the server-renderable
 * `data-v2-marker="V2-HOME"` marker.
 *
 * ── THE ENTRANCE RULE: A BLOCK THE FALLBACK PRE-DRAWS GETS NO ENTRANCE ──────
 * `REVEAL` is `fill-mode-both` over a `from`-only enter keyframe, so a block
 * carrying it is held fully INVISIBLE for its whole `animationDelay` and only
 * then fades up — right for something arriving from nowhere, actively wrong for
 * something `HomeFallback` has already painted, which visibly BLANKS at the
 * hand-off before fading back in. The greeting, composer, prompts and rail
 * therefore render plainly. Quiz KEEPS `REVEAL` (role-gated, omitted by the
 * fallback, genuinely late), minus its stagger delay. The study-mode CTA keeps
 * its own softer fade: it is student-gated on a CLIENT-only profession read, so
 * it really does resolve after hydration. See `WorkHome` for the full rationale.
 *
 * FRAME: every container class below comes from `home-frame.ts` — the ONE
 * definition the route-level fallback (`HomeFallback`) also consumes, so the
 * loading shape and this surface cannot drift apart. That module also documents
 * the `contents md:flex` left column and the shared mobile `order` scale, both of
 * which this layout depends on. Study already sat on that scale, so the
 * extraction changed no `order` value here.
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
        className={HOME_SURFACE_FOCUSED}
      >
        <HomeGreeting
          name={name}
          confidential={confidential}
          align="center"
          subline="Quizzes, bookmarks, and everything you're learning."
          headingClassName={HOME_GREETING_HEADING_FOCUSED}
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
      className={HOME_SURFACE_WORKSPACE}
    >
      {/* Greeting — full-width, left-aligned (workspace feel). NO entrance: the
          route fallback already drew this block (see the ENTRANCE RULE above). */}
      <div className={WORKSPACE_GREETING}>
        <HomeGreeting
          name={name}
          confidential={confidential}
          align="left"
          subline="Your quizzes, spaces, and saved research."
          headingClassName={HOME_GREETING_HEADING_WORKSPACE}
        />
      </div>

      {/* LEFT COLUMN — `display:contents` on mobile so the composer hoists to the
          root scroll flex; a real flex column (grid col 1) on desktop. */}
      <div className={WORKSPACE_LEFT_COLUMN}>
        {/* Composer dock — MOBILE: `sticky bottom-0`, floating alone with a soft
            bottom fade. DESKTOP: static, top of the left column. NO entrance (the
            fallback pre-draws the composer's shape). The inner wrapper STAYS: it
            carries `composerAreaRef` for prompt-fill focus, and keeping the ref
            div free of transforms is what protects the sticky dock. */}
        <div className={WORKSPACE_COMPOSER_DOCK}>
          <div aria-hidden className={DOCK_FADE} />
          <div ref={composerAreaRef}>
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
        <div className={WORKSPACE_PROMPTS}>
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
          // KEEPS its entrance — the fallback deliberately does not draw this
          // role-gated module, so it genuinely arrives with the payload. The
          // stagger delay is gone: there is no sequence left to stagger against.
          <div className={cn(REVEAL, WORKSPACE_PRIMARY_MODULE, 'duration-500')}>
            <QuizModule />
          </div>
        ) : null}

        {/* Study-mode CTA — student-gated; resolves post-hydration (client-only
            profession read), so it fades in on mount rather than popping in.
            MOBILE order-3 (beside Quiz); DESKTOP below Quiz in the left column. */}
        {isStudent ? (
          <div
            className={cn(
              WORKSPACE_SECONDARY_MODULE,
              'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300',
            )}
          >
            <StudyModeCard checked={studyMode} onCheckedChange={setStudyMode} />
          </div>
        ) : null}
      </div>

      {/* RAIL — the glance modules. MOBILE: scrolls between the learning modules
          and the compose cluster (order-4). DESKTOP: the right column (grid col 2). */}
      <div className={WORKSPACE_RAIL}>
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
