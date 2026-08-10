'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, Loader2, Lock, Users } from 'lucide-react';
import { isAxiosError } from 'axios';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { inviteLinksApi } from '@/lib/api/collab';
import type { InvitePreview, InviteViewerAction } from '@/types/collab';
import { forgetPendingInvite, rememberPendingInvite } from './pending-invite';

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
 */

/** One sentence per refusal. */
function refusalFor(status: number | undefined): { title: string; body: string } {
  if (status === 410) {
    return {
      title: 'This invite has expired',
      body: 'It may have run out of uses, or been turned off. Ask whoever sent it for a new one.',
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

/** The one control, per the server's answer about this viewer. */
const ACTION_LABEL: Record<InviteViewerAction, string> = {
  sign_up: 'Sign up to join',
  verify_email: 'Confirm your email to join',
  join: 'Join',
  request: 'Ask to join',
  already_member: 'Open the space',
};

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

export function JoinScreen({ code }: { code: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState<string | null>(null);

  const preview = useQuery({
    queryKey: ['invite-preview', code],
    queryFn: () => inviteLinksApi.preview(code),
    retry: false, // 404/410 are answers, not blips
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
      router.push(
        data.channel_uuid
          ? `/channels/${data.channel_uuid}`
          : `/spaces/${data.space_uuid}`,
      );
    },
    onError: (error) => {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      setFailed(refusalFor(status).title);
    },
  });

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
    const status = isAxiosError(preview.error)
      ? preview.error.response?.status
      : undefined;
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

  const invite = preview.data.data;
  const action = invite.viewer_action;
  const waiting =
    accept.isSuccess &&
    (accept.data.data.status === 'request' ||
      accept.data.data.status === 'already_waiting');

  // Landing on the waiting list is an OUTCOME, not a failure — it is what the
  // link promised when it requires approval, so it gets the whole screen.
  if (waiting) {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-16 text-center">
        <Users aria-hidden className="mx-auto size-8 text-primary" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">
          Your request has been sent
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          An admin of {invite.space_name} will let you know. You do not need to
          do anything else.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/">Go to Lawexa</Link>
        </Button>
      </div>
    );
  }

  const press = () => {
    setFailed(null);
    if (action === 'already_member') {
      router.push(`/spaces/${invite.space_uuid}`);
      return;
    }
    if (action === 'sign_up' || action === 'verify_email') {
      // Hold it BEFORE leaving, so coming back finishes the join.
      rememberPendingInvite(code);
      router.push(action === 'sign_up' ? '/register' : '/check-email');
      return;
    }
    accept.mutate();
  };

  return (
    <div className="mx-auto w-full max-w-md px-5 py-14">
      <div className="flex flex-col items-center text-center">
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
          className="mt-7 w-full"
          onClick={press}
          disabled={accept.isPending}
        >
          {accept.isPending ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : null}
          {ACTION_LABEL[action]}
        </Button>

        {failed ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {failed}
          </p>
        ) : null}
      </div>
    </div>
  );
}
