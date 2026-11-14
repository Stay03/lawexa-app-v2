'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, Loader2, Lock, Trophy, Users } from 'lucide-react';
import { isAxiosError } from 'axios';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { inviteLinksApi } from '@/lib/api/collab';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/authStore';
import type { InvitePreview } from '@/types/collab';
import { isInviteCode, joinActionLabel, joinedDestination } from './join-model';
import {
  forgetPendingInvite,
  rememberPendingInvite,
  signInToJoinHref,
  signUpToJoinHref,
  usePendingInvite,
} from './pending-invite';

/**
 * JoinScreen — what somebody sees when they open an invite link.
 *
 * ── THE BUTTON IS DECIDED BY THE SERVER, NOT BY US ─────────────────────────
 * Everything hangs off `viewer_action`. The rule the contract exists to
 * enforce is: NOBODY PRESSES JOIN AND IS THEN REFUSED. We cannot work the
 * answer out here, because the obvious test — "is there a token?" — is wrong
 * for the case this page is mostly for. A GUEST CARRIES A REAL TOKEN and
 * passes authentication, so "signed in" is true and Join would be offered,
 * and the server would refuse it. The server folds guest-ness, email
 * confirmation and existing membership into one word. We read the word.
 *
 * ── FOUR REFUSALS THAT MEAN FOUR DIFFERENT THINGS ──────────────────────────
 * `404` no such code, `410` it existed and has expired or been used up, `429`
 * too many tries. A lapsed invite is not a wrong one, and telling somebody
 * "this link doesn't exist" when their friend sent it an hour ago makes them
 * think we are broken or they are being lied to. Each gets its own sentence.
 *
 * ── WHY THE CODE IS REMEMBERED BEFORE WE SEND THEM AWAY ────────────────────
 * `sign_up` and `verify_email` both leave this page. They come back on a fresh
 * page load, and the code has to survive that. `pending-invite.ts` holds it and
 * is read at RENDER rather than in an effect — see its docblock for why that
 * distinction is the difference between this working and silently dropping the
 * invite of a brand new user.
 *
 * ── SIGN IN FIRST, AND THE JOIN FINISHES ITSELF (10 November 2026) ─────────
 * `sign_up` is what a signed-out viewer gets, and many of them already have an
 * account: they were sent to /register. Sign-in comes first now, with sign-up
 * beside it, and both carry `?redirect=` back here. The held code was never
 * read again (Backend's study), so a new person who signed up never joined:
 * `PendingInviteReturn` brings them back once they can join, and here a held
 * code that is this invite's finishes the join without a second tap.
 *
 * ── A GAME LINK LANDS IN THE GAME (live quiz in Spaces, 10 November 2026) ──
 * A live quiz's link names its `game` in the preview and answers its
 * `game_uuid` on accept (Backend's shapes 7a007a8c): the screen names the
 * quiz, and every way through, joining, already a member, or back from
 * sign-in, ends on the Space's page in the game (`joinedDestination`). A game
 * link never waits for approval, except for someone who was removed from the
 * Space or left it: they ask, as on any link that needs approval.
 */

/** One sentence per refusal. */
function refusalFor(status: number | undefined): { title: string; body: string } {
  if (status === 410) {
    return {
      title: 'This invite has expired',
      body: 'It may have run out of uses, been turned off, or been for a game that has ended. Ask whoever sent it for a new one.',
    };
  }
  if (status === 429) {
    return {
      title: 'Too many attempts',
      body: 'Wait a minute and open the link again.',
    };
  }
  if (status === 404) {
    return {
      title: "This invite link doesn't exist",
      body: 'Check the link is complete — they are easy to cut short when copied.',
    };
  }
  return {
    title: "We couldn't open this invite",
    body: 'Something went wrong at our end. Try again in a moment.',
  };
}

/** A refused invite: its sentence, and the way home. */
function Refusal({ status }: { status: number | undefined }) {
  const { title, body } = refusalFor(status);
  return (
    <div className="mx-auto w-full max-w-md px-5 py-16 text-center">
      <AlertCircle aria-hidden className="mx-auto size-8 text-muted-foreground" />
      <h1 className="mt-4 text-xl font-semibold text-foreground">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/">Go to Lawexa</Link>
      </Button>
    </div>
  );
}

/**
 * The line under the name. The description when there is one; otherwise a
 * sentence built from what we know.
 *
 * @arthur chose the made-up line over showing nothing (2026-08-10). I had argued
 * for nothing, on the grounds that a shorter page beats a page with a hole in
 * it. His reasoning is better for the case that matters: the spaces with no
 * description are exactly the ones whose owners are about to send this link to
 * a stranger, and "Bar Finals Study Group" alone tells that stranger nothing
 * about what they are being invited into.
 *
 * The channel line NAMES THE SPACE rather than saying "a channel", for the same
 * reason — somebody who has never heard of us needs to know what the room is in.
 */
function subtitleFor(invite: InvitePreview): string {
  const written = invite.channel_name
    ? invite.channel_description?.trim()
    : invite.space_description?.trim();
  if (written) return written;

  if (invite.channel_name) return `A channel in ${invite.space_name}`;
  return invite.space_type === 'study'
    ? 'A study space on Lawexa'
    : 'A work space on Lawexa';
}

/*
 * A GAME LINK WEARS THE QUIZ'S LOOK (Stay, f730f71c, 11 November 2026:
 * "everything around the quiz should have the quiz based designs"). The
 * raised gold button, the outlined cards and the Comfortaa title are v2's solo
 * quiz kit (`v2/features/quiz/solo/ui.tsx`, `solo-quiz.css`); this page is
 * outside v2 and may not import it, so the few classes are restated here with
 * the kit's values. An ordinary invite keeps the house look.
 */
const QUIZ_LIP =
  'transition-[transform,box-shadow] duration-100 ease-out shadow-[0_4px_0_0_var(--lip)] enabled:active:translate-y-1 enabled:active:shadow-none motion-reduce:transition-none';
const QUIZ_BUTTON = `h-14 rounded-2xl text-base font-bold hover:bg-primary [--lip:oklch(0.47_0.11_85)] dark:[--lip:oklch(0.52_0.11_82)] ${QUIZ_LIP}`;
const QUIZ_QUIET_BUTTON = `h-14 rounded-2xl border-2 border-border bg-card text-base font-bold text-foreground hover:bg-card [--lip:oklch(0.86_0_0)] dark:[--lip:oklch(0.36_0_0)] ${QUIZ_LIP}`;
const QUIZ_CARD = 'rounded-2xl border-2 border-border bg-card';
const QUIZ_TILE =
  'flex size-20 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-[0_5px_0_0_oklch(0.47_0.11_85)] dark:shadow-[0_5px_0_0_oklch(0.52_0.11_82)]';

export function JoinScreen({ code }: { code: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState<string | null>(null);

  // The answer is about WHO is asking (`viewer_action`), so it is cached per
  // viewer: the "sign up" answer a signed-out visitor got must not be reused
  // once they come back signed in, or the join never finishes (fixture run,
  // 10 November 2026: back from sign-in, the screen still said "Sign in").
  const viewer = useAuthStore((state) =>
    state.isAuthenticated ? `${state.isGuest ? 'guest' : 'user'}:${state.user?.id ?? ''}` : 'signed-out',
  );
  // A value that cannot be a code is never asked about: it does not exist.
  const wellFormed = isInviteCode(code);
  const preview = useQuery({
    queryKey: ['invite-preview', code, viewer],
    queryFn: () => inviteLinksApi.preview(code),
    retry: false, // 404/410 are answers, not blips
    enabled: wellFormed,
  });

  const accept = useMutation({
    mutationFn: () => inviteLinksApi.accept(code),
    onSuccess: (response) => {
      // `already_member` and `already_waiting` are SUCCESSES. Pressing twice —
      // or coming back to a link you already used — must never draw an error.
      forgetPendingInvite();
      const data = response.data;
      if (data.status === 'request' || data.status === 'already_waiting') {
        setFailed(null);
        return;
      }
      router.push(joinedDestination(data));
    },
    onError: (error) => {
      // A refused join lets the held code go: it would otherwise bring the
      // person back here on every page. The button still tries again.
      forgetPendingInvite();
      const status = isAxiosError(error) ? error.response?.status : undefined;
      setFailed(refusalFor(status).title);
    },
  });

  // Back with the code they arrived with (`PendingInviteReturn`, or the sign-in
  // `?redirect=`): the join finishes without another tap. Only for this
  // invite's own code, and only once; a member already in goes straight in.
  const held = usePendingInvite() === code;
  const heldAction = held ? preview.data?.data.viewer_action : undefined;
  const heldSpace = preview.data?.data.space_uuid;
  const heldGame = preview.data?.data.game?.uuid ?? null;
  useEffect(() => {
    if ((heldAction === 'join' || heldAction === 'request') && accept.isIdle) accept.mutate();
    if (heldAction === 'already_member' && heldSpace) {
      forgetPendingInvite();
      router.replace(joinedDestination({ space_uuid: heldSpace, game_uuid: heldGame }));
    }
  }, [heldAction, heldSpace, heldGame, accept, router]);

  if (!wellFormed) return <Refusal status={404} />;

  if (preview.isPending) {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-16">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="size-16 rounded-2xl" />
          <Skeleton className="h-6 w-48 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="mt-4 h-11 w-full rounded-full" />
        </div>
      </div>
    );
  }

  if (preview.isError) {
    return <Refusal status={isAxiosError(preview.error) ? preview.error.response?.status : undefined} />;
  }

  const invite = preview.data.data;
  const action = invite.viewer_action;
  const game = invite.game ?? null;
  const waiting =
    accept.isSuccess &&
    (accept.data.data.status === 'request' ||
      accept.data.data.status === 'already_waiting');

  // Landing on the waiting list is an OUTCOME, not a failure — it is what the
  // link promised when it requires approval, so it gets the whole screen.
  if (waiting) {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-16 text-center">
        {game ? (
          <span aria-hidden className={cn(QUIZ_TILE, 'mx-auto')}>
            <Users className="size-9" />
          </span>
        ) : (
          <Users aria-hidden className="mx-auto size-8 text-primary" />
        )}
        <h1
          className={cn(
            'text-foreground',
            game ? 'mt-6 font-comfortaa text-2xl font-bold' : 'mt-4 text-xl font-semibold',
          )}
        >
          Your request has been sent
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          An admin of {invite.space_name} will let you know. You do not need to
          do anything else.
        </p>
        <Button
          asChild
          variant="outline"
          className={cn('mt-6', game && cn(QUIZ_QUIET_BUTTON, 'w-full'))}
        >
          <Link href="/">Go to Lawexa</Link>
        </Button>
      </div>
    );
  }

  const press = () => {
    setFailed(null);
    if (action === 'already_member') {
      router.push(joinedDestination({ space_uuid: invite.space_uuid, game_uuid: game?.uuid ?? null }));
      return;
    }
    if (action === 'sign_up' || action === 'verify_email') {
      // Hold it BEFORE leaving, so coming back finishes the join. Sign-in
      // comes back here by its `?redirect=`; its form's Sign up link too.
      rememberPendingInvite(code);
      router.push(action === 'sign_up' ? signInToJoinHref(code) : '/check-email');
      return;
    }
    accept.mutate();
  };

  const spaceLines = (
    <>
      {invite.channel_name ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Lock aria-hidden className="size-3.5" />#{invite.channel_name}
        </p>
      ) : null}

      {/* Never blank: see `subtitleFor`. */}
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {subtitleFor(invite)}
      </p>

      <p className="mt-3 text-sm text-muted-foreground">
        {invite.member_count}{' '}
        {invite.member_count === 1 ? 'person is' : 'people are'} already here
      </p>
    </>
  );

  return (
    <div className="mx-auto w-full max-w-md px-5 py-14">
      <div className="flex flex-col items-center text-center">
        {/* A game link leads with the quiz it opens, and the Space it sits in
            is the card under it. An ordinary invite leads with the Space. */}
        {game ? (
          <>
            <span aria-hidden className={QUIZ_TILE}>
              <Trophy className="size-9" />
            </span>
            <p className="mt-6 text-xs font-bold tracking-[0.14em] text-[oklch(0.47_0.11_85)] uppercase dark:text-primary">
              Live quiz
            </p>
            <h1 className="mt-1 font-comfortaa text-2xl leading-tight font-bold text-balance text-foreground">
              {game.quiz_title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {invite.inviter_name
                ? `${invite.inviter_name} invited you to play in`
                : 'You have been invited to play in'}
            </p>
            <div className={cn(QUIZ_CARD, 'mt-4 flex w-full flex-col items-center p-4')}>
              <p className="flex items-center gap-2.5 text-base font-bold text-foreground">
                <span
                  aria-hidden
                  className="flex size-8 items-center justify-center rounded-xl bg-secondary font-comfortaa text-xs font-bold text-foreground"
                >
                  {invite.space_name.slice(0, 2).toUpperCase()}
                </span>
                {invite.space_name}
              </p>
              {spaceLines}
            </div>
          </>
        ) : (
          <>
            <span
              aria-hidden
              className="flex size-16 items-center justify-center rounded-2xl bg-secondary text-xl font-semibold text-foreground"
            >
              {invite.space_name.slice(0, 2).toUpperCase()}
            </span>

            <p className="mt-5 text-sm text-muted-foreground">
              {invite.inviter_name
                ? `${invite.inviter_name} invited you to`
                : 'You have been invited to'}
            </p>
            <h1 className="mt-1 text-2xl leading-tight font-semibold text-foreground">
              {invite.space_name}
            </h1>
            {spaceLines}
          </>
        )}

        {/* WHAT WILL HAPPEN, BEFORE THEY PRESS. An approval queue is not a
            refusal, but finding out about it afterwards feels like one. */}
        {invite.requires_approval && action !== 'already_member' ? (
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            An admin approves who joins, so you will be let in once somebody
            says yes.
          </p>
        ) : null}

        <Button
          size="lg"
          className={cn('mt-7 w-full', game && QUIZ_BUTTON)}
          onClick={press}
          disabled={accept.isPending}
        >
          {accept.isPending ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : null}
          {joinActionLabel(action, game !== null)}
        </Button>

        {/* A new person signs up instead, and comes back here the same way. */}
        {action === 'sign_up' ? (
          <p className="mt-3 text-sm text-muted-foreground">
            New to Lawexa?{' '}
            <Link
              href={signUpToJoinHref(code)}
              onClick={() => rememberPendingInvite(code)}
              className="font-medium text-primary hover:underline"
            >
              Create an account
            </Link>
          </p>
        ) : null}

        {failed ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {failed}
          </p>
        ) : null}
      </div>
    </div>
  );
}
