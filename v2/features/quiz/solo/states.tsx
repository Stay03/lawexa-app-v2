import Link from 'next/link';
import { BookOpenCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { QuizMessage } from '../ui/QuizMessage';

/**
 * states.tsx — the solo quiz's SHARED panels: the two answers the access gate
 * gives on the account-only solo routes. Screen-specific states live beside
 * their screen.
 *
 * NEUTRAL WORDS, ON PURPOSE. The practice gate says "Sign in to practise",
 * which is true of the practice player and false of a quiz somebody wrote:
 * the reader on `/quiz/library` or `/quiz/attempts/{uuid}` is here for a
 * quiz, not for practice, so the door says what it opens and no more.
 */

/**
 * SIGNED OUT, and no guest pass could be had — the gate waits for the pass
 * before it shows this (`access.tsx`), so a visitor who will become a guest
 * never sees it flash. The way in returns to this very address.
 */
export function SoloSignedOutState({ signInHref }: { signInHref: string }) {
  return (
    <QuizMessage
      icon={BookOpenCheck}
      tone="accent"
      title="Sign in to continue"
      description="Quizzes you write and take are kept on your account. Sign in to open this page."
      action={
        <Button asChild size="sm">
          <Link href={signInHref}>Sign in</Link>
        </Button>
      }
    />
  );
}

/**
 * CREATE AN ACCOUNT — what a GUEST sees on an account-only solo route. A guest
 * pass reads the explore list and any quiz front; taking a quiz and keeping a
 * library are the registered experience (the server answers `403` to a guest
 * on every attempt route). Two real doors, the way the practice panel offers
 * them, in the solo surface's words.
 */
export function SoloCreateAccountState({ signInHref }: { signInHref: string }) {
  return (
    <QuizMessage
      icon={BookOpenCheck}
      tone="accent"
      title="Create a free account to take quizzes"
      description="Taking a quiz keeps your score, and writing one gives it a home. Both are part of the registered experience."
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button asChild size="sm">
            <Link href="/register">Create free account</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={signInHref}>Sign in</Link>
          </Button>
        </div>
      }
      footnote="Browsing quizzes stays open to everyone."
    />
  );
}
