import Link from 'next/link';
import { RotateCw, TriangleAlert, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { SETTINGS_COLUMN } from '../SettingsList';

/**
 * The `/settings/profile` states: the silhouette, the two refusals, and the
 * failure. The standards' three-state contract, with the refusals kept apart
 * because a guest and a signed-out visitor are asking different questions.
 */

/** One block-shaped placeholder at the live row height (`min-h-14`). */
function BlockSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3.5 w-24 rounded" />
      <Skeleton
        className="w-full rounded-2xl"
        style={{ height: `${rows * 3.5}rem` }}
      />
    </div>
  );
}

/**
 * The screen's resting silhouette, drawn by `app/v2/settings/profile/loading.tsx`
 * while the route segment resolves AND by the screen itself while the account
 * is being read. One shape for both waits, because a reader cannot tell an RSC
 * payload from a query and should not be shown two different answers to the
 * same question.
 *
 * The block heights are the SIGNED-IN, no-account-type shape: a person with a
 * type sees more rows arrive than were reserved, which settles downward under
 * the fold rather than moving anything already read.
 */
export function ProfileFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your profile
      </span>
      <div aria-hidden inert className={SETTINGS_COLUMN}>
        <Skeleton className="mb-5 hidden h-8 w-28 rounded-lg md:block" />
        <div className="flex flex-col items-center gap-3 pb-6">
          <Skeleton className="size-24 rounded-full" />
          <Skeleton className="h-5 w-40 rounded" />
          <Skeleton className="h-3.5 w-52 rounded" />
        </div>
        <div className="flex flex-col gap-5">
          <BlockSkeleton rows={5} />
          <BlockSkeleton rows={3} />
          <BlockSkeleton rows={4} />
          <BlockSkeleton rows={4} />
        </div>
      </div>
    </>
  );
}

function ProfileState({
  icon: Icon,
  title,
  description,
  action,
  tone = 'quiet',
}: {
  icon: typeof TriangleAlert;
  title: string;
  description: string;
  action?: React.ReactNode;
  tone?: 'quiet' | 'alarm';
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <span
        aria-hidden
        className={cn(
          'flex size-12 items-center justify-center rounded-2xl',
          tone === 'alarm'
            ? 'bg-destructive/10 text-destructive'
            : 'bg-secondary text-muted-foreground',
        )}
      >
        <Icon className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

/**
 * A guest has no profile to edit. Guest accounts are view-only until the person
 * registers, so this is not a permission refusal: there is genuinely nothing
 * behind the door yet, and the only useful thing to offer is the door that
 * makes one.
 */
export function ProfileGuestState() {
  return (
    <ProfileState
      icon={UserPlus}
      title="A guest has no profile yet"
      description="Create an account and this becomes your name, your handle and everything people see about you."
      action={
        <Button asChild size="sm">
          <Link href="/register">Create account</Link>
        </Button>
      }
    />
  );
}

export function ProfileSignedOutState() {
  return (
    <ProfileState
      icon={UserPlus}
      title="Sign in to edit your profile"
      description="Your name, handle and details live with your account."
      action={
        <Button asChild size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      }
    />
  );
}

/** The read failed. Visually distinct from a refusal, with a live retry: the
 *  form cannot be shown at all until we know what is in it. */
export function ProfileErrorState({
  message,
  onRetry,
  isRetrying,
}: {
  message: string;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <ProfileState
      icon={TriangleAlert}
      tone="alarm"
      title="Your profile did not load"
      description={message}
      action={
        <Button size="sm" variant="outline" onClick={onRetry} disabled={isRetrying}>
          <RotateCw
            aria-hidden
            className={cn('size-4', isRetrying && 'animate-spin')}
          />
          Try again
        </Button>
      }
    />
  );
}
