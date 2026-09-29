'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Bookmark,
  Crown,
  MessageSquare,
  MessageSquarePlus,
  NotebookPen,
  RotateCw,
  Sparkles,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { IUserLimitsPlan } from '@/types/message-pack';
import { SETTINGS_COLUMN } from '../SettingsList';
import { SettingsFormGroup } from '../SettingsForm';
import { SettingsState } from '../SettingsState';
import { aiMessagesView, barTone, formatUsageDate, limitView, type LimitView } from './model';
import { usageQueries } from './queries';
import { UsageFallback } from './states';

/**
 * UsageScreen — v2 `/settings/usage`: the plan, what is left to send, and the
 * other limits, as the server counts them (Stay, 29 September 2026: "Do usage").
 *
 * ── WHAT IT SAYS THAT v1 DID NOT ───────────────────────────────────────────
 * v1 printed "Unlimited" for any limit whose PLAN limit was empty, which told
 * 63 paying accounts their notes were unlimited while a lifetime cap of 999
 * stopped them. This screen asks the server's own answer (`remaining`), so a
 * capped limit shows its count and a truly unlimited one says so. See
 * `model.ts`. And v1's headline added pack messages to a bar of the plan
 * alone; here the bar and its line are the plan, and packs have their own row.
 */
export function UsageScreen() {
  const limits = useQuery(usageQueries.limits());

  if (limits.isPending) return <UsageFallback />;

  if (limits.isError || !limits.data) {
    return (
      <div className={SETTINGS_COLUMN}>
        <Heading />
        <SettingsState
          icon={TriangleAlert}
          tone="alarm"
          title="Your usage did not load"
          description="Check your connection and try again."
          action={
            <Button size="sm" variant="outline" disabled={limits.isFetching} onClick={() => void limits.refetch()}>
              <RotateCw aria-hidden className={cn('size-4', limits.isFetching && 'animate-spin')} />
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  const data = limits.data;
  const ai = aiMessagesView(data.ai_messages, data.payg.balance);
  const blocked = data.ai_messages.blocked_reason;

  return (
    <div className={SETTINGS_COLUMN}>
      <Heading />
      <div className="flex flex-col gap-5">
        {blocked ? (
          <p role="status" className="rounded-2xl bg-destructive/10 px-4 py-3 text-[13px] leading-snug text-destructive">
            {blocked.message}
            {blocked.resets_at ? ` Your messages come back on ${formatUsageDate(blocked.resets_at)}.` : ''}
          </p>
        ) : null}

        <SettingsFormGroup id="usage-plan" label="Plan">
          <PlanRow plan={data.plan} />
        </SettingsFormGroup>

        <SettingsFormGroup id="usage-ai" label="AI messages">
          <li className="flex flex-col gap-2.5 px-4 py-3">
            <div className="flex items-center gap-3.5">
              <MessageSquare aria-hidden className="size-5 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] leading-snug font-medium text-foreground tabular-nums">
                  {ai.totalLeft === null ? 'Unlimited' : `${ai.totalLeft} ${ai.totalLeft === 1 ? 'message' : 'messages'} left`}
                </span>
                <span className="text-[13px] leading-snug text-muted-foreground tabular-nums">
                  {limitLine(ai.plan, 'on your plan')}
                </span>
              </span>
            </div>
            <LimitBar view={ai.plan} label="AI messages used on your plan" />
          </li>
          <li className="flex min-h-14 items-center gap-3.5 px-4 py-2.5">
            <MessageSquarePlus aria-hidden className="size-5 shrink-0 text-muted-foreground" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] leading-snug font-medium text-foreground tabular-nums">
                {ai.packs} from message packs
              </span>
              <span className="text-[13px] leading-snug text-muted-foreground">Used after your plan&apos;s messages.</span>
            </span>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href="/settings/message-packs">Buy</Link>
            </Button>
          </li>
        </SettingsFormGroup>

        <SettingsFormGroup id="usage-other" label="Other limits">
          <LimitRow icon={NotebookPen} label="Notes you create" view={limitView(data.note_creations)} />
          <LimitRow icon={Bookmark} label="Bookmarks" view={limitView(data.bookmarks)} />
        </SettingsFormGroup>

        {data.ai_messages.reset_message ? (
          <p className="px-1 text-[13px] leading-snug text-muted-foreground">{data.ai_messages.reset_message}</p>
        ) : null}
      </div>
    </div>
  );
}

function Heading() {
  return (
    <h1 className="sr-only md:not-sr-only md:mb-5 md:text-2xl md:font-semibold md:tracking-tight md:text-foreground">
      Usage
    </h1>
  );
}

const STATUS: Record<string, string> = {
  active: 'Active',
  trialing: 'Trial',
  past_due: 'Payment due',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

/** The plan, its state and its next date, and the way to a bigger one. */
function PlanRow({ plan }: { plan: IUserLimitsPlan }) {
  const sub = plan.subscription;
  const ends = formatUsageDate(sub?.ends_at);
  const renews = formatUsageDate(sub?.next_payment_date);
  const detail = [
    sub ? STATUS[sub.status] ?? sub.status : plan.is_free ? 'Free plan' : null,
    ends ? `Access ends ${ends}` : renews ? `Renews ${renews}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const Icon = plan.is_free ? Sparkles : Crown;
  return (
    <li className="flex min-h-14 items-center gap-3.5 px-4 py-2.5">
      <Icon aria-hidden className={cn('size-5 shrink-0', plan.is_free ? 'text-muted-foreground' : 'text-primary')} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] leading-snug font-medium text-foreground">{plan.name}</span>
        {detail ? <span className="truncate text-[13px] leading-snug text-muted-foreground">{detail}</span> : null}
      </span>
      <Button asChild size="sm" variant={plan.is_free ? 'default' : 'outline'} className="shrink-0">
        <Link href="/pricing">{plan.is_free ? 'Upgrade' : 'Change plan'}</Link>
      </Button>
    </li>
  );
}

function LimitRow({ icon: Icon, label, view }: { icon: LucideIcon; label: string; view: LimitView }) {
  return (
    <li className="flex flex-col gap-2.5 px-4 py-3">
      <div className="flex items-center gap-3.5">
        <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] leading-snug font-medium text-foreground">{label}</span>
          <span className="text-[13px] leading-snug text-muted-foreground tabular-nums">{limitLine(view, 'used')}</span>
        </span>
      </div>
      <LimitBar view={view} label={label} />
    </li>
  );
}

/**
 * "12 of 999 used, never resets" / "7 of 10 on your plan, resets 1 Oct 2026",
 * or "Unlimited · 40 used" for a limit the server does not count.
 */
function limitLine(view: LimitView, noun: string): string {
  if (view.kind === 'unlimited') return `Unlimited · ${view.used} used`;
  const reset = view.resetsAt ? `resets ${formatUsageDate(view.resetsAt)}` : 'never resets';
  return `${view.used} of ${view.total} ${noun} · ${reset}`;
}

const BAR_TONE = {
  calm: 'bg-primary',
  warn: 'bg-amber-500',
  alarm: 'bg-destructive',
} as const;

/** The count as a bar; nothing is drawn for an unlimited limit. */
function LimitBar({ view, label }: { view: LimitView; label: string }) {
  if (view.kind === 'unlimited') return null;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={view.total}
      aria-valuenow={view.used}
      className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10"
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none', BAR_TONE[barTone(view.percent)])}
        style={{ width: `${view.percent}%` }}
      />
    </div>
  );
}
