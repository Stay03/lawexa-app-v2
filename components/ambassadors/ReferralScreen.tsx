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
 * ── THE THREE NUMBERS ARE THREE DIFFERENT QUESTIONS ────────────────────────
 * Signed up, got their free messages, ever paid. They are shown together and
 * labelled apart, because the middle one is the promise this person personally
 * made when they handed out their code, and it is the only one that tells them
 * whether it was kept. `paid_count` deliberately excludes the welcome pack, so
 * our own giveaway can never inflate it.
 *
 * They arrived late and on purpose: an audit found `referred_count` counted
 * almost everybody twice — once as a guest, again at registration — and the
 * screen waited until that was corrected. Showing somebody a count of their own
 * work that is about to be revised downwards is worse than showing nothing.
 */

/* ── Small parts ─────────────────────────────────────────────────────────── */

/** @arthur's wording, 2026-08-11, verbatim. */
const SHARE_TEXT =
  'I use Lawexa to research cases and laws, draft, study, and get legal work done faster.\n\nTry it with my link and get 10 FREE AI messages:';

function referralUrl(code: string): string {
  const origin =
    typeof window === 'undefined' ? 'https://lawexa.com' : window.location.origin;
  return `${origin}/?ref=${code}`;
}

function Panel({
  title,
  children,
  action,
  /** `h1` standing alone on its own page; `h2` inside settings, which already
   *  has one. Two `h1`s is not a style question — it announces two documents. */
  heading = 'h1',
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  heading?: 'h1' | 'h2';
}) {
  const Heading = heading;
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-6 py-16 text-center">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground"
      >
        <Ticket className="size-6" />
      </span>
      <div className="space-y-1.5">
        <Heading className="text-base font-semibold">{title}</Heading>
        <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
      {action}
    </div>
  );
}

/**
 * One number and what it actually means.
 *
 * THE LABEL IS DOING REAL WORK HERE. "12" under the word "Referrals" invites
 * every reading the API spent tonight ruling out — clicks, visitors, people who
 * looked. The words say what was counted.
 */
function Tally({ value, label, note }: { value: number; label: string; note: string }) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <p className="text-2xl leading-none font-semibold tabular-nums">{value}</p>
      <p className="mt-1.5 text-sm font-medium">{label}</p>
      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{note}</p>
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
  /** Refetches. Awaited, so the button stays busy until the screen is right. */
  onDone: () => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const claim = useMutation({
    mutationFn: (code: string) => ambassadorsApi.claimCode(code),
    /**
     * ── THE RESPONSE BODY IS NOT READ, AND THAT IS THE FIX ─────────────────
     * This first shipped writing the POST's body straight into the cache, on
     * the assumption that claiming returns the same `{current, history}` shape
     * as fetching. Nobody had measured that, and it does not. So the cache took
     * a shape with no `current` in it, the screen decided the ambassador still
     * had no code, and claiming appeared to do NOTHING — @arthur claimed one,
     * saw the same form, and only found out it had worked by reloading the page
     * himself. His words: an unsuspecting ambassador enters it again, or worse
     * enters a different one.
     *
     * Refetching instead is correct whatever the server returns, which is the
     * point: the screen now depends on the shape the GET is documented to have,
     * and on nothing about the POST at all.
     */
    onSuccess: async (_response, code) => {
      setValue('');
      setError(null);
      await onDone();
      setSaved(code.trim().toLowerCase());
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
            if (saved) setSaved(null);
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
      {/* SAYING SO IS THE POINT. Changing a code leaves this form looking
          exactly as it did, so without a word here the only difference is a
          line of text further up the page that the reader is not looking at. */}
      {saved && !error && (
        <p role="status" className="text-sm font-medium text-primary">
          Saved. Your code is now {saved}.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

/* ── The screen ──────────────────────────────────────────────────────────── */

/**
 * `standalone` is its own page at `/ambassadors/referrals` — it brings the
 * heading and the column, because nothing around it does. `settings` is the
 * same screen inside the settings shell, which already supplies the page
 * container, the "Settings" heading and the sidebar; there it wears a Card like
 * its siblings and brings no second `h1`.
 */
export type ReferralFraming = 'standalone' | 'settings';

export function ReferralScreen({
  framing = 'standalone',
}: {
  framing?: ReferralFraming;
} = {}) {
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

  const performance = useQuery({
    queryKey: ['ambassador-performance'],
    queryFn: () => ambassadorsApi.getPerformance(),
    enabled: approved,
  });

  const inSettings = framing === 'settings';
  /** Settings already owns the page's `h1`. Derived here rather than at each
   *  panel so the refusals and the real screen cannot disagree. */
  const panelHeading = inSettings ? 'h2' : 'h1';

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
        heading={panelHeading}
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
        heading={panelHeading}
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
      <Panel heading={panelHeading} title="Your application is with us">
        We&rsquo;ll email you when it has been looked at. Your code and your link
        appear here once you&rsquo;re approved.
      </Panel>
    );
  }

  if (record.status !== 'approved') {
    return (
      <Panel
        heading={panelHeading}
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
  const numbers = performance.data?.data ?? null;
  const retired = history.filter((entry) => !entry.is_current);
  /**
   * Prefer the per-code tallies — a retired code that can show it brought nine
   * people answers the question far better than one that only proves it still
   * exists.
   *
   * FALL BACK WHENEVER THEY ARE EMPTY, not merely when they have not loaded.
   * The two lists come from different endpoints and can disagree: caught with a
   * fixture where the tallies were empty while the history had two retired
   * codes, which rendered the heading and the reassuring sentence above an
   * empty space. Showing the codes without their counts is worse than showing
   * counts; showing neither, under a heading promising them, is worst.
   */
  const retiredRows =
    numbers && numbers.by_code.length > 0
      ? numbers.by_code.filter((entry) => !entry.is_current)
      : retired;

  /** Refetch both — the code list, and the tallies that are keyed by code.
   *  Awaited by the form so its button stays busy until this screen actually
   *  shows the new code, rather than going quiet while the old one is still up. */
  const onClaimed = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['ambassador-code'] }),
      client.invalidateQueries({ queryKey: ['ambassador-performance'] }),
    ]);
  };

  return (
    <div
      className={
        inSettings
          ? 'space-y-8 rounded-xl border bg-card p-6'
          : 'mx-auto w-full max-w-md space-y-8 px-6 py-12'
      }
    >
      {/* In settings the page already has an `h1` above the sidebar, so this
          one steps down to an `h2`. Two `h1`s on a page is not a style
          preference — it is what makes a screen reader announce two documents. */}
      <header className="space-y-1.5">
        {inSettings ? (
          <h2 className="text-lg font-semibold">Your referral link</h2>
        ) : (
          <h1 className="text-xl font-semibold">Your referral link</h1>
        )}
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
                      // @arthur's words, 2026-08-11, used verbatim. It leads
                      // with what Lawexa is FOR rather than with the giveaway —
                      // somebody reading it in WhatsApp needs to know why they
                      // would want it before they are told it is free.
                      text: SHARE_TEXT,
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

          {/* THE NUMBERS. Absent rather than zeroed while they load — a zero
              somebody's work has not earned is worse than a gap. */}
          {performance.isPending ? (
            <div aria-hidden className="grid grid-cols-3 gap-2">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          ) : numbers ? (
            <section className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <Tally
                  value={numbers.referred_count}
                  label="Signed up"
                  note="Made an account"
                />
                <Tally
                  value={numbers.confirmed_count}
                  label="Got the gift"
                  note="Confirmed their email"
                />
                <Tally
                  value={numbers.paid_count}
                  label="Ever paid"
                  note="Not counting the gift"
                />
              </div>
              {numbers.last_referral_at && (
                <p className="text-xs text-muted-foreground">
                  Last one arrived{' '}
                  {new Date(numbers.last_referral_at).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'long',
                  })}
                  .
                </p>
              )}
            </section>
          ) : null}

          <section className="space-y-3 border-t pt-6">
            <ClaimForm current={current.code} onDone={onClaimed} />
          </section>

          {/* Guarded on the rows it will ACTUALLY draw, not on a sibling list —
              otherwise the heading can appear over nothing. */}
          {retiredRows.length > 0 && (
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
                {retiredRows.map((entry) => (
                  <li key={entry.code} className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded bg-secondary px-2 py-1 text-xs text-muted-foreground">
                      {entry.code}
                    </code>
                    {/* THE PROOF, not just the promise. "Still works" is a
                        claim; "brought 3 people" is the thing they actually
                        wanted to know when they changed their code. */}
                    {'referred_count' in entry && (
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {entry.referred_count === 1
                          ? '1 person'
                          : `${entry.referred_count} people`}
                      </span>
                    )}
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
