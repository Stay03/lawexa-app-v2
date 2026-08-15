import Link from 'next/link';
import { Flag, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { QuizMessage } from '../ui/QuizMessage';

/**
 * The play surface's own states. The shared ones (verify email, load failure)
 * live in `../ui/states.tsx`; these three exist only here.
 */

/**
 * The PLAY column — `LIST_COLUMN`'s width and horizontal padding, with the top
 * padding removed.
 *
 * That one difference is load-bearing: the play surface leads with a STICKY
 * header, and a sticky element pins to the top of the scroll container, not to
 * the top of its padded parent. With `pt-5` the bar would float below a gap on
 * arrival and then jump flush on the first scroll. Dropping the padding here is
 * the honest fix; negative margins on the bar would achieve the same pixels
 * while silently coupling the header to a number defined in another file.
 *
 * Only the PLAY state uses it — the message states (cold start, ended, error)
 * use `LIST_COLUMN`, because they have no sticky bar and do want the top air.
 */
export const PLAYER_COLUMN = 'mx-auto w-full max-w-3xl px-4 pb-16';

/**
 * The play skeleton — the header bar, the question, and four option rows at
 * their REAL geometry (`p-3.5 sm:p-4` on a `rounded-xl` card, so ~62px), which
 * is what makes the hand-off to the live question move nothing.
 *
 * The question reserves TWO lines: one is optimistic for a legal MCQ stem and
 * three over-reserves for most, so the middle absorbs a small settle either way
 * (standards §8iv — reserve near the median, never at the cap).
 *
 * It pulses in both callers, the route fallback included (standards §8i). The
 * reader cannot tell an RSC payload from a request for the next question, so
 * both waits look the same rather than changing appearance mid-load.
 */
export function PlayerSkeleton() {
  return (
    <div aria-hidden>
      <div className="-mx-4 flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="hidden h-5 w-28 rounded-full sm:block" />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      </div>

      <div className="pt-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-full rounded" />
          <Skeleton className="h-6 w-2/3 rounded" />
        </div>
        <div className="mt-6 flex flex-col gap-2.5">
          {[1, 0.85, 0.65, 0.45].map((opacity, index) => (
            <Skeleton
              key={index}
              className="h-[62px] w-full rounded-xl"
              style={{ opacity }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * COLD START — the session is open but the bank has nothing to serve
 * (`question: null`). Not an error, and deliberately not over-invested in: a
 * brand-new account got a real question immediately in the live probe, because
 * the difficulty ladder widens into the shared bank. It is rare, but it is real,
 * so it gets an honest sentence rather than an error screen.
 */
export function ColdStartState() {
  return (
    <QuizMessage
      icon={Sparkles}
      tone="accent"
      title="Your question bank is warming up"
      description="We turn study conversations into practice questions overnight. There is nothing to answer just yet — check back soon."
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/">Back to home</Link>
        </Button>
      }
      footnote="Your session stays open in the meantime."
    />
  );
}

/**
 * The session this URL points at is finished — ended by the reader, or
 * auto-abandoned after about a day of silence. Both offer the same two ways on,
 * because both leave the same two things worth doing.
 */
export function SessionEndedState({ sessionUuid }: { sessionUuid: string }) {
  return (
    <QuizMessage
      icon={Flag}
      title="This session has ended"
      description="Sessions close when you end them, or on their own after about a day. Your answers and explanations are all still here."
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button asChild size="sm">
            <Link href={`/quiz/${sessionUuid}/results`}>See your answers</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/quiz">Start a new session</Link>
          </Button>
        </div>
      }
    />
  );
}

/**
 * The play route's fallback (`app/v2/quiz/[sessionUuid]/(play)/loading.tsx`) —
 * the skeleton, in the play column. This boundary covers an RSC payload rather
 * than an API request, but it wears the same pulse: the reader is waiting
 * either way, and two appearances for one load would only read as the loading
 * starting over.
 */
export function PlayerFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your question
      </span>
      {/* `aria-hidden` + `inert` (standards §8ii): a Suspense fallback is
          DELETED when content arrives, so nothing in it may hold focus. */}
      <div aria-hidden inert className={PLAYER_COLUMN}>
        <PlayerSkeleton />
      </div>
    </>
  );
}
