'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BarChart3, ChevronRight, Loader2, Play, RotateCcw } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { extractApiError } from '@/lib/utils/api-error';
import type { QuizSession } from '@/types/quiz';
import { useV2Session } from '@/v2/runtime/session-context';
import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import {
  isVerificationBlocked,
  needsEmailVerification,
} from '../model';
import { useStartQuizSession } from '../mutations';
import { quizQueries } from '../queries';
import { SessionRow } from '../ui/SessionRow';
import { QuizErrorState, SessionListSkeleton } from '../ui/states';
import { VerifyEmailState } from '../ui/VerifyEmailState';
import { TopicChips } from './TopicChips';

/**
 * QuizHubScreen — `/quiz`, the feature's front door.
 *
 * ── ONE REQUEST ANSWERS TWO QUESTIONS ───────────────────────────────────────
 * "Do I have a session open?" and "what have I played lately?" are the same
 * page-1 read: the backend allows exactly ONE active session per user, so the
 * hero simply SCANS the rows it already fetched for it. `recentSessions()` gets
 * five rows and both answers come out of them — where v1 spent a separate
 * `per_page: 1` request for the first answer alone.
 *
 * The scan is deliberate: list ORDER is the server's business and we have never
 * observed it (every captured response was empty). See the read below.
 *
 * ── THE HERO IS THE SAME BUTTON EITHER WAY ──────────────────────────────────
 * `POST /quizzes` is start-OR-resume, so the action never depends on getting
 * the answer right; only the WORDING does. That is why the hero waits for the
 * list rather than guessing: a button that says "Start practising" and then
 * silently resumes a half-finished session is a small lie, and a label that
 * flips under the reader's cursor is worse. Resume is a plain `<Link>` (a
 * navigation, not a write) so it is prefetchable and right-clickable.
 *
 * ── VERIFY-EMAIL IS A STATE, NOT AN ERROR ───────────────────────────────────
 * Every `/quizzes/*` endpoint 403s for a registered account with an unverified
 * address — the ONE gate the backend actually enforces. The panel renders from
 * the session SNAPSHOT on the first frame, and ALSO whenever a real 403 comes
 * back (the snapshot can be stale — it is resolved once per full page load).
 * Both paths land on the same designed panel.
 *
 * The AUDIENCE gate is not here: `app/v2/quiz/layout.tsx` decides that once,
 * above every quiz surface.
 */

/** The hero action's geometry — shared with the route fallback so the reserved
 *  shape and the real button are the same size by construction. */
const HERO_ACTION = 'h-11 w-full rounded-full sm:w-64';

export function QuizHubScreen() {
  const router = useRouter();
  const session = useV2Session();
  const { userId: viewerId } = session;
  const [topic, setTopic] = useState<string | null>(null);

  useEffect(() => {
    setHeaderContext({ title: 'Quiz', confidential: false });
    return () => clearHeaderContext();
  }, []);

  // The snapshot's verdict, computed BEFORE the query so a doomed request is
  // never sent: an unverified registered account 403s on every `/quizzes/*`
  // endpoint, so fetching would only spend a round trip to be told what we
  // already know and would leave the query permanently in `error`.
  const snapshotUnverified = needsEmailVerification(session);

  const recentQuery = useQuery({
    ...quizQueries.recentSessions({ viewerId }),
    enabled: !snapshotUnverified,
  });
  const startSession = useStartQuizSession();

  const sessions = recentQuery.data?.data;
  // SCAN for the open session; never assume it is row zero. The backend allows
  // at most one active session, but nothing we can verify guarantees the list's
  // ORDER — every captured response was empty, and no contract states it. If it
  // ever came back oldest-first, an index-based read would hide the Resume hero
  // and "Start practising" would silently resume a half-finished session, which
  // is exactly the small lie this screen is built to avoid. A scan of five rows
  // costs nothing and cannot be wrong. (v1's `QuizStart` scanned too.)
  const activeSession: QuizSession | null =
    sessions?.find((item) => item.status === 'active') ?? null;

  // Snapshot-first, 403-covered. The snapshot is resolved once per full page
  // load, so it can be STALE in the other direction (verified in another tab,
  // or never verified but the layout ran before a sign-in) — hence the 403
  // clauses, which catch that case from the live responses. Either path renders
  // the same panel.
  const verificationBlocked =
    snapshotUnverified ||
    isVerificationBlocked(recentQuery.error) ||
    isVerificationBlocked(startSession.error);

  const handleStart = () => {
    startSession.mutate(
      { topic: topic ?? undefined },
      {
        onSuccess: (response) =>
          router.push(`/quiz/${response.data.session.uuid}`),
        onError: (error) => {
          // A 403 flips `verificationBlocked` above and the panel takes over —
          // a toast on top of it would report the same thing twice. Everything
          // else needs saying, because this mutation opted out of the global
          // error channel (`meta.silentError`).
          if (isVerificationBlocked(error)) return;
          toast.error("Couldn't start a session", {
            description: extractApiError(error).message,
          });
        },
      },
    );
  };

  return (
    <div className={LIST_COLUMN}>
      <header className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Practise what you have been studying
        </h1>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          Multiple-choice questions drawn from your own study conversations.
          Answers stay hidden until you end the session — then you get the full
          breakdown.
        </p>
      </header>

      <section aria-label="Start a session" className="mt-6">
        {verificationBlocked ? (
          <VerifyEmailState />
        ) : recentQuery.isPending ? (
          <HeroReservation />
        ) : (
          <div className="space-y-5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
            {activeSession ? (
              <ResumeAction session={activeSession} />
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={startSession.isPending}
                  className={cn(
                    'v2-interactive inline-flex items-center justify-center gap-2 bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70',
                    HERO_ACTION,
                    FOCUS_RING,
                  )}
                >
                  {startSession.isPending ? (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  ) : (
                    <Play aria-hidden className="size-4" />
                  )}
                  Start practising
                </button>
                <TopicChips selected={topic} onSelect={setTopic} />
              </>
            )}
          </div>
        )}
      </section>

      {verificationBlocked ? null : (
        <RecentSessions
          sessions={sessions}
          isPending={recentQuery.isPending}
          isError={recentQuery.isError}
          onRetry={() => void recentQuery.refetch()}
        />
      )}
    </div>
  );
}

/** The resume path — a navigation, so a real link, not a mutation. */
function ResumeAction({ session }: { session: QuizSession }) {
  return (
    <div className="space-y-2">
      <Link
        href={`/quiz/${session.uuid}`}
        className={cn(
          'v2-interactive inline-flex items-center justify-center gap-2 bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
          HERO_ACTION,
          FOCUS_RING,
        )}
      >
        <RotateCcw aria-hidden className="size-4" />
        Resume your session
      </Link>
      <p className="text-xs text-muted-foreground">
        {session.answered_count > 0
          ? `${session.answered_count} answered so far. Sessions close on their own after about a day.`
          : 'You have a session open. Sessions close on their own after about a day.'}
      </p>
    </div>
  );
}

/**
 * The hero's PENDING shape. It pulses in both of its callers: the live wait on
 * the active-session answer, and the route fallback below. A wait is a wait,
 * and a reader cannot tell an RSC payload from a query.
 */
function HeroReservation() {
  return (
    <div aria-hidden className="space-y-2">
      <Skeleton className={HERO_ACTION} />
      <Skeleton className="h-3 w-64 max-w-full rounded" />
    </div>
  );
}

/** The recent-sessions block — the hub's one list, capped at the page it read. */
function RecentSessions({
  sessions,
  isPending,
  isError,
  onRetry,
}: {
  sessions: QuizSession[] | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const hasRows = !!sessions && sessions.length > 0;

  return (
    <section aria-label="Recent sessions" className="mt-9">
      <header className="flex items-center justify-between gap-2 px-1 pb-1">
        <h2 className="text-xs font-medium text-muted-foreground">
          Recent sessions
        </h2>
        <div className="flex items-center gap-1">
          <HubLink href="/quiz/stats" icon={BarChart3}>
            Your progress
          </HubLink>
          {hasRows ? <HubLink href="/quiz/history">View all</HubLink> : null}
        </div>
      </header>

      {isPending ? (
        <SessionListSkeleton rows={3} />
      ) : isError ? (
        <QuizErrorState
          title="Couldn't load your sessions"
          description="Your practice history is still there — the list just didn't load."
          onRetry={onRetry}
        />
      ) : hasRows ? (
        <ul className="flex flex-col divide-y divide-border/60 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
          {sessions.map((item, index) => (
            <SessionRow key={item.uuid} session={item} index={index} />
          ))}
        </ul>
      ) : (
        <p className="px-2 py-2.5 text-sm text-muted-foreground">
          No sessions yet — your first one will show up here.
        </p>
      )}
    </section>
  );
}

function HubLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon?: typeof BarChart3;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'v2-interactive inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-xs text-muted-foreground/80 transition-colors hover:text-foreground',
        FOCUS_RING,
      )}
    >
      {Icon ? <Icon aria-hidden className="size-3.5" /> : null}
      {children}
      {Icon ? null : <ChevronRight aria-hidden className="size-3.5" />}
    </Link>
  );
}

/**
 * The hub's route fallback (`app/v2/quiz/(hub)/loading.tsx`) — the SAME frame
 * and the SAME hero geometry as the live screen, so route boundary → live hub
 * moves nothing.
 *
 * The heading and its description are STATIC CHROME: fixed strings that wait on
 * no request, so per standards §8i they render FOR REAL rather than as grey
 * bars. Only the two genuinely data-blocked regions — the hero (which is
 * waiting on the active-session answer) and the recent list — are reserved, and
 * they pulse here exactly as they do in the live screen. The reader is waiting
 * either way, so the wait keeps one appearance from the first frame to the
 * last.
 */
export function QuizHubFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading quiz
      </span>
      {/* `aria-hidden` + `inert` (standards §8ii): a Suspense fallback is
          DELETED when content arrives, so nothing in it may hold focus. */}
      <div aria-hidden inert className={LIST_COLUMN}>
        <header className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Practise what you have been studying
          </h1>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            Multiple-choice questions drawn from your own study conversations.
            Answers stay hidden until you end the session — then you get the
            full breakdown.
          </p>
        </header>

        <div className="mt-6">
          <HeroReservation />
        </div>

        <div className="mt-9">
          <div className="flex items-center justify-between gap-2 px-1 pb-1">
            <p className="text-xs font-medium text-muted-foreground">
              Recent sessions
            </p>
          </div>
          <SessionListSkeleton rows={3} />
        </div>
      </div>
    </>
  );
}
