'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Check, Copy, Loader2, Share2, Ticket } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useMounted } from '@/lib/hooks/useMounted';
import { ambassadorsApi } from '@/lib/api/ambassadors';
import type { AmbassadorCode } from '@/types/ambassador';

/**
 * ReferralScreen — an ambassador's code, the link that carries it, and every
 * code they have retired.
 *
 * ── THE DOOR IS THE APPLICATION, NOT A ROLE ────────────────────────────────
 * There is no ambassador user role and there will not be one: roles are a
 * priority ladder where every check asks "at least X", so inserting one in the
 * middle silently changes the meaning of every existing check, for somebody
 * whose abilities do not change at all. An ambassador is an ordinary user with
 * an APPROVED application.
 *
 * Measured against production before this was written, which is what made the
 * door simple: `GET /ambassadors/my-application` answers `200` with `data:
 * null` for somebody who never applied — so the four audiences separate on one
 * call and nothing here has to catch a refusal to find out who it is talking
 * to. (`/ambassadors/code` does answer `403` for a non-ambassador, but reaching
 * for that would mean asking a question we already have the answer to.)
 *
 * ── WHAT IS DELIBERATELY NOT ON THIS SCREEN YET ────────────────────────────
 * Their numbers. `GET /ambassadors/performance` is being reshaped tonight after
 * our audit found that `referred_count` counted almost everybody twice — once
 * as a guest, again at registration — so the number is about to change meaning
 * and go down. A screen that shows somebody a count of their own work must not
 * show one that is about to be corrected under them. It lands when the shape
 * is settled and somebody has actually seen it render.
 */

/* ── Small parts ─────────────────────────────────────────────────────────── */

function referralUrl(code: string): string {
  const origin =
    typeof window === 'undefined' ? 'https://lawexa.com' : window.location.origin;
  return `${origin}/?ref=${code}`;
}

function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-6 py-16 text-center">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground"
      >
        <Ticket className="size-6" />
      </span>
      <div className="space-y-1.5">
        <h1 className="text-base font-semibold">{title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
      {action}
    </div>
  );
}

/** Copy, confirming itself. The clipboard write happens INSIDE the click and
 *  never after an `await` — iOS refuses one that has lost the user gesture. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      className="shrink-0"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? (
        <>
          <Check aria-hidden className="size-4" /> Copied
        </>
      ) : (
        <>
          <Copy aria-hidden className="size-4" /> {label}
        </>
      )}
    </Button>
  );
}

/* ── The claim / change form ─────────────────────────────────────────────── */

/**
 * One form claims a code and changes it — there is no separate change call, and
 * re-claiming a code they previously retired simply makes it current again.
 *
 * THE REFUSAL IS THE CHECK. Nothing can tell whether a code is free until it is
 * submitted, so the form asks and reports what it is told: `409` taken, `422`
 * the server's own sentence about why the code is not allowed, `429` slow down.
 * Inventing a client-side rule here would only be a second, weaker copy of the
 * server's grammar that drifts the first time it changes.
 */
function ClaimForm({
  current,
  onDone,
}: {
  current: string | null;
  onDone: (state: { current: AmbassadorCode | null; history: AmbassadorCode[] }) => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const claim = useMutation({
    mutationFn: (code: string) => ambassadorsApi.claimCode(code),
    onSuccess: (response) => {
      setValue('');
      setError(null);
      if (response.data) onDone(response.data);
    },
    onError: (failure) => {
      const status = isAxiosError(failure) ? failure.response?.status : undefined;
      const said = isAxiosError(failure)
        ? (failure.response?.data as { message?: string } | undefined)?.message
        : undefined;
      if (status === 409) setError('That code is taken. Try another.');
      else if (status === 429) setError('Slow down a moment, then try again.');
      else setError(said ?? 'That did not work. Try again.');
    },
  });

  const trimmed = value.trim();
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!trimmed || claim.isPending) return;
        claim.mutate(trimmed);
      }}
    >
      <Label htmlFor="referral-code">
        {current ? 'Change your code' : 'Choose your code'}
      </Label>
      <div className="flex gap-2">
        <Input
          id="referral-code"
          value={value}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={current ?? 'adaobi'}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
        />
        <Button type="submit" disabled={!trimmed || claim.isPending}>
          {claim.isPending && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {current ? 'Change' : 'Claim'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Letters, numbers, dashes and underscores. It must start with a letter.
        {current
          ? ' Your old code keeps working, so anything already printed still counts.'
          : ' Saved in small letters, whatever you type.'}
      </p>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

/* ── The screen ──────────────────────────────────────────────────────────── */

export function ReferralScreen() {
  const client = useQueryClient();
  /**
   * `navigator.share` EXISTS ON THE CLIENT AND NOT ON THE SERVER, so reading it
   * during render is a hydration mismatch waiting to happen: the server sends
   * markup with no Share button and the first client render wants one. Gated on
   * mount instead — `useMounted` is a `useSyncExternalStore` whose server
   * snapshot is `false`, so both first renders agree and the button appears on
   * the pass after.
   */
  const mounted = useMounted();
  const canShare =
    mounted && typeof navigator !== 'undefined' && 'share' in navigator;

  const application = useQuery({
    queryKey: ['ambassador-application'],
    queryFn: () => ambassadorsApi.getMyApplication(),
  });

  const approved = application.data?.data?.status === 'approved';

  const codeState = useQuery({
    queryKey: ['ambassador-code'],
    queryFn: () => ambassadorsApi.getCode(),
    enabled: approved,
  });

  if (application.isPending) {
    return (
      <div aria-hidden className="mx-auto w-full max-w-md space-y-4 px-6 py-16">
        <Skeleton className="h-12 w-12 rounded-2xl" />
        <Skeleton className="h-5 w-2/3 rounded" />
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    );
  }

  if (application.isError) {
    return (
      <Panel
        title="We couldn't open this"
        action={
          <Button onClick={() => void application.refetch()}>Try again</Button>
        }
      >
        Something went wrong at our end. Try again in a moment.
      </Panel>
    );
  }

  const record = application.data?.data ?? null;

  // Never applied — including a guest, who is told the same true thing and sent
  // to the page that knows how to ask them to sign up.
  if (!record) {
    return (
      <Panel
        title="You're not an ambassador yet"
        action={
          <Button asChild>
            <Link href="/ambassadors">Read about it</Link>
          </Button>
        }
      >
        Ambassadors get a link that credits them for everyone who joins through
        it. Applications are open.
      </Panel>
    );
  }

  if (record.status === 'pending') {
    return (
      <Panel title="Your application is with us">
        We&rsquo;ll email you when it has been looked at. Your code and your link
        appear here once you&rsquo;re approved.
      </Panel>
    );
  }

  if (record.status !== 'approved') {
    return (
      <Panel
        title="This isn't open to you yet"
        action={
          <Button asChild variant="outline">
            <Link href="/ambassadors">About the programme</Link>
          </Button>
        }
      >
        Your application wasn&rsquo;t approved this time.
      </Panel>
    );
  }

  /* ── Approved ──────────────────────────────────────────────────────────── */

  const current = codeState.data?.data?.current ?? null;
  const history = codeState.data?.data?.history ?? [];
  const retired = history.filter((entry) => !entry.is_current);

  const onClaimed = (next: {
    current: AmbassadorCode | null;
    history: AmbassadorCode[];
  }) => {
    client.setQueryData(['ambassador-code'], {
      success: true,
      message: '',
      data: next,
    });
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-8 px-6 py-12">
      <header className="space-y-1.5">
        <h1 className="text-xl font-semibold">Your referral link</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Anyone who joins Lawexa through your link is credited to you, and gets
          10 free messages once their email is confirmed.
        </p>
      </header>

      {codeState.isPending ? (
        <div aria-hidden className="space-y-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ) : current ? (
        <>
          <section className="space-y-3">
            {/* THE CODE THE SERVER RETURNED, never what was typed. Codes are
                stored lowercase, and this one gets printed on a face card — a
                code that reads differently from how it resolves is a bug report
                waiting to happen. */}
            <div className="space-y-2">
              <Label htmlFor="referral-link">Your link</Label>
              <div className="flex gap-2">
                <code
                  id="referral-link"
                  className="min-w-0 flex-1 truncate rounded-lg bg-secondary px-3 py-2 text-sm"
                >
                  {referralUrl(current.code)}
                </code>
                <CopyButton value={referralUrl(current.code)} label="Copy" />
              </div>
            </div>

            {canShare && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  void navigator
                    .share({
                      title: 'Join me on Lawexa',
                      text: 'Sign up with my link and get 10 free messages to start:',
                      url: referralUrl(current.code),
                    })
                    .catch(() => {
                      // A dismissed share sheet rejects. Not a failure.
                    });
                }}
              >
                <Share2 aria-hidden className="size-4" />
                Share it
              </Button>
            )}
          </section>

          <section className="space-y-3 border-t pt-6">
            <ClaimForm current={current.code} onDone={onClaimed} />
          </section>

          {retired.length > 0 && (
            <section className="space-y-2 border-t pt-6">
              <h2 className="text-sm font-medium">Codes you&rsquo;ve used before</h2>
              {/* THE REASSURANCE IS THE POINT OF THIS LIST. A code goes on a
                  printed card and into somebody's Instagram post, and neither
                  can be edited afterwards — so an ambassador who changes their
                  code needs to see, in as many words, that the old one still
                  brings people. */}
              <p className="text-xs leading-relaxed text-muted-foreground">
                These still work. Anything you printed or posted with them keeps
                counting for you.
              </p>
              <ul className="space-y-1.5 pt-1">
                {retired.map((entry) => (
                  <li key={entry.code} className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded bg-secondary px-2 py-1 text-xs text-muted-foreground">
                      {entry.code}
                    </code>
                    <CopyButton value={referralUrl(entry.code)} label="Link" />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <section className="space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Pick a code and it becomes your link. Choose something people can
            read out and type — your name usually works.
          </p>
          <ClaimForm current={null} onDone={onClaimed} />
        </section>
      )}
    </div>
  );
}
