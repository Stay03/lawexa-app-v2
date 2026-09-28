'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  BadgeCheck,
  Check,
  Copy,
  Link2,
  Loader2,
  RotateCw,
  Share2,
  Ticket,
  TriangleAlert,
  UserPlus,
  Wallet,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { extractApiError } from '@/lib/utils/api-error';
import type { AmbassadorCode, AmbassadorCodeTally } from '@/types/ambassador';
import { useMounted } from '@/v2/shell/use-mounted';
import { SETTINGS_COLUMN } from '../SettingsList';
import { SettingsFormGroup } from '../SettingsForm';
import { SettingsState } from '../SettingsState';
import { referralsQueries, useClaimCode } from './queries';
import { ReferralsFallback } from './states';

/** @arthur's wording, 2026-08-11, verbatim (as on the shared screen). */
const SHARE_TEXT =
  'I use Lawexa to research cases and laws, draft, study, and get legal work done faster.\n\nTry it with my link and get 10 FREE AI messages:';

function referralUrl(code: string): string {
  const origin = typeof window === 'undefined' ? 'https://lawexa.com' : window.location.origin;
  return `${origin}/?ref=${code}`;
}

const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' });

/**
 * ReferralsScreen — v2 `/settings/referrals`: an ambassador's link, what it
 * brought, their code, and every code they retired.
 *
 * The same states and rules as the shared screen at `/ambassadors/referrals`
 * (which stays, because its address is in the approval email): the door is
 * the APPLICATION, never a role; the three counts are three different
 * questions and are labelled apart; the code shown is always the one the
 * server returned; a retired code still works and the screen says so, with its
 * own count as proof. Only the design is v2's.
 */
export function ReferralsScreen() {
  const application = useQuery(referralsQueries.application());
  const approved = application.data?.status === 'approved';
  const code = useQuery(referralsQueries.code(approved));
  const performance = useQuery(referralsQueries.performance(approved));

  if (application.isPending) return <ReferralsFallback />;

  if (application.isError) {
    return (
      <Column>
        <SettingsState
          icon={TriangleAlert}
          tone="alarm"
          title="Your referrals did not load"
          description="Check your connection and try again."
          action={
            <Button
              size="sm"
              variant="outline"
              disabled={application.isFetching}
              onClick={() => void application.refetch()}
            >
              <RotateCw aria-hidden className={cn('size-4', application.isFetching && 'animate-spin')} />
              Try again
            </Button>
          }
        />
      </Column>
    );
  }

  const record = application.data;
  if (!record) {
    return (
      <Column>
        <SettingsState
          icon={Ticket}
          title="You're not an ambassador yet"
          description="Ambassadors get a link that credits them for everyone who joins through it. Applications are open."
          action={
            <Button asChild size="sm">
              <Link href="/ambassadors">Read about it</Link>
            </Button>
          }
        />
      </Column>
    );
  }
  if (record.status === 'pending') {
    return (
      <Column>
        <SettingsState
          icon={Ticket}
          title="Your application is with us"
          description="We'll email you when it has been looked at. Your code and your link appear here once you're approved."
        />
      </Column>
    );
  }
  if (!approved) {
    return (
      <Column>
        <SettingsState
          icon={Ticket}
          title="This isn't open to you yet"
          description="Your application wasn't approved this time."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/ambassadors">About the programme</Link>
            </Button>
          }
        />
      </Column>
    );
  }

  if (code.isPending) return <ReferralsFallback />;

  const current = code.data?.current ?? null;
  const history = code.data?.history ?? [];
  const numbers = performance.data ?? null;
  // Prefer the per-code tallies, and fall back to the plain history whenever
  // they are EMPTY (the two lists come from different endpoints and can
  // disagree); a heading over nothing is the worst of the three outcomes.
  const retired: Array<AmbassadorCode | AmbassadorCodeTally> =
    numbers && numbers.by_code.length > 0
      ? numbers.by_code.filter((entry) => !entry.is_current)
      : history.filter((entry) => !entry.is_current);

  return (
    <Column>
      <p className="mb-5 px-1 text-[13px] leading-snug text-muted-foreground">
        Anyone who joins Lawexa through your link is credited to you, and gets 10 free messages once
        their email is confirmed.
      </p>
      <div className="flex flex-col gap-5">
        {current ? (
          <>
            <LinkGroup code={current.code} />
            {numbers ? (
              <div>
                <SettingsFormGroup id="referrals-results" label="What your link brought">
                  <TallyRow icon={UserPlus} label="Signed up" hint="Made an account" value={numbers.referred_count} />
                  <TallyRow icon={BadgeCheck} label="Got the gift" hint="Confirmed their email" value={numbers.confirmed_count} />
                  <TallyRow icon={Wallet} label="Ever paid" hint="Not counting the gift" value={numbers.paid_count} />
                </SettingsFormGroup>
                {numbers.last_referral_at ? (
                  <p className="px-1 pt-2 text-[13px] leading-snug text-muted-foreground">
                    Last one arrived {DAY_MONTH.format(Date.parse(numbers.last_referral_at))}.
                  </p>
                ) : null}
              </div>
            ) : null}
            <CodeForm current={current.code} />
            {retired.length > 0 ? (
              <SettingsFormGroup
                id="referrals-retired"
                label="Codes you've used before"
                description="These still work. Anything you printed or posted with them keeps counting for you."
              >
                {retired.map((entry) => (
                  <RetiredRow key={entry.code} entry={entry} />
                ))}
              </SettingsFormGroup>
            ) : null}
          </>
        ) : (
          <CodeForm current={null} />
        )}
      </div>
    </Column>
  );
}

function Column({ children }: { children: React.ReactNode }) {
  return (
    <div className={SETTINGS_COLUMN}>
      <h1 className="sr-only md:not-sr-only md:mb-5 md:text-2xl md:font-semibold md:tracking-tight md:text-foreground">
        Referrals
      </h1>
      {children}
    </div>
  );
}

/** Copy, confirming itself. The write happens inside the click (iOS refuses
 *  one that has lost the user gesture). */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="shrink-0"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
      {copied ? 'Copied' : label}
    </Button>
  );
}

function LinkGroup({ code }: { code: string }) {
  // `navigator.share` exists only in the browser; gated on mount so the server
  // and the first client render agree.
  const mounted = useMounted();
  const canShare = mounted && typeof navigator !== 'undefined' && 'share' in navigator;
  const url = referralUrl(code);
  return (
    <SettingsFormGroup id="referrals-link" label="Your link">
      <li className="flex min-h-14 items-center gap-3.5 px-4 py-2.5">
        <Link2 aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-mono text-[14px] text-foreground" title={url}>
          {url}
        </span>
        <CopyButton value={url} label="Copy" />
      </li>
      {canShare ? (
        <li>
          <button
            type="button"
            onClick={() => {
              void navigator
                .share({ title: 'Join me on Lawexa', text: SHARE_TEXT, url })
                .catch(() => {
                  // A dismissed share sheet rejects; not a failure.
                });
            }}
            className={cn(
              'v2-interactive flex min-h-14 w-full items-center gap-3.5 px-4 py-2.5 text-left',
              'transition-colors duration-150 hover:bg-foreground/[0.04] motion-reduce:transition-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
            )}
          >
            <Share2 aria-hidden className="size-5 shrink-0 text-muted-foreground" />
            <span className="text-[15px] leading-snug font-medium text-foreground">Share your link</span>
          </button>
        </li>
      ) : null}
    </SettingsFormGroup>
  );
}

function TallyRow({
  icon: Icon,
  label,
  hint,
  value,
}: {
  icon: typeof UserPlus;
  label: string;
  hint: string;
  value: number;
}) {
  return (
    <li className="flex min-h-14 items-center gap-3.5 px-4 py-2.5">
      <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] leading-snug font-medium text-foreground">{label}</span>
        <span className="text-[13px] leading-snug text-muted-foreground">{hint}</span>
      </span>
      <span className="shrink-0 text-xl font-semibold tabular-nums text-foreground">{value}</span>
    </li>
  );
}

function RetiredRow({ entry }: { entry: AmbassadorCode | AmbassadorCodeTally }) {
  const count = 'referred_count' in entry ? entry.referred_count : null;
  return (
    <li className="flex min-h-14 items-center gap-3.5 px-4 py-2.5">
      <Ticket aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-mono text-[14px] text-foreground">{entry.code}</span>
        {count !== null ? (
          <span className="text-[13px] leading-snug text-muted-foreground tabular-nums">
            {count === 1 ? '1 person' : `${count} people`}
          </span>
        ) : null}
      </span>
      <CopyButton value={referralUrl(entry.code)} label="Link" />
    </li>
  );
}

/**
 * Claim or change the code. Nothing can tell whether a code is free until it is
 * submitted, so the form reports what the server says: 409 taken, 429 slow
 * down, anything else the server's own sentence.
 */
function CodeForm({ current }: { current: string | null }) {
  const claim = useClaimCode();
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const trimmed = value.trim();

  const apiError = claim.error ? extractApiError(claim.error) : null;
  const errorMessage = apiError
    ? apiError.status === 409
      ? 'That code is taken. Try another.'
      : apiError.status === 429
        ? 'Slow down a moment, then try again.'
        : apiError.message || 'That did not work. Try again.'
    : null;

  return (
    <SettingsFormGroup
      id="referrals-code"
      label={current ? 'Change your code' : 'Choose your code'}
      description={
        current
          ? 'Your old code keeps working, so anything already printed still counts.'
          : 'Pick a code and it becomes your link. Choose something people can read out and type; your name usually works.'
      }
    >
      <li className="px-4 py-3">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!trimmed || claim.isPending) return;
            claim.mutate(trimmed, {
              onSuccess: () => {
                setValue('');
                setSaved(trimmed.toLowerCase());
              },
            });
          }}
        >
          <Input
            aria-label={current ? 'New code' : 'Your code'}
            value={value}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={current ?? 'adaobi'}
            onChange={(event) => {
              setValue(event.target.value);
              if (claim.error) claim.reset();
              if (saved) setSaved(null);
            }}
            className="bg-background"
          />
          <Button type="submit" disabled={!trimmed || claim.isPending} className="shrink-0">
            {claim.isPending ? <Loader2 aria-hidden className="animate-spin" /> : null}
            {current ? 'Change' : 'Claim'}
          </Button>
        </form>
        <p className="pt-2 text-[12px] leading-snug text-muted-foreground">
          Letters, numbers, dashes and underscores, starting with a letter. Saved in small letters.
        </p>
        {saved && !errorMessage ? (
          <p role="status" className="pt-2 text-[13px] font-medium text-primary">
            Saved. Your code is now {saved}.
          </p>
        ) : null}
        {errorMessage ? (
          <p role="alert" className="pt-2 text-[13px] font-medium text-destructive">
            {errorMessage}
          </p>
        ) : null}
      </li>
    </SettingsFormGroup>
  );
}
