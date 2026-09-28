'use client';

import { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Loader2, MessageSquarePlus, Package, RotateCw, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { formatMoneyMajor } from '@/lib/utils/payment-format';
import type { IMessagePack } from '@/types/message-pack';
import { useCurrency } from '@/v2/runtime/currency';
import { SETTINGS_COLUMN } from '../SettingsList';
import { SettingsFormGroup } from '../SettingsForm';
import { SettingsState } from '../SettingsState';
import { BuyPanel } from './BuyPanel';
import { messagePacksQueries } from './queries';
import { MessagePacksFallback } from './states';

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function packDate(pack: IMessagePack): string {
  const time = Date.parse(pack.paid_at ?? pack.created_at);
  return Number.isNaN(time) ? '' : DATE.format(time);
}

/**
 * MessagePacksScreen — v2 `/settings/message-packs`: how many pack messages
 * are left, a way to buy more, every pack bought, and how packs are spent.
 *
 * ── THE EXPLANATION SAYS ONLY WHAT THE SERVER DOES ─────────────────────────
 * v1's "How it works" made three claims that lived only in its component. The
 * backend checked each against the spending code on 28 September 2026
 * (7d2b3176): plan messages are used before pack messages
 * (LimitService::consumeAndResolve), the oldest pack is used first
 * (MessagePackService::consumeMessage, by id ascending), and a BOUGHT pack
 * never expires. A sponsor-granted pack can end with its sponsorship, so the
 * no-expiry line names bought messages only. Pack size and price are read from
 * `/message-packs/pricing`, never written here.
 */
export function MessagePacksScreen() {
  const balance = useQuery(messagePacksQueries.balance());
  const pricing = useQuery(messagePacksQueries.pricing());
  const history = useInfiniteQuery(messagePacksQueries.history());
  const { currency } = useCurrency();
  const [buyOpen, setBuyOpen] = useState(false);

  if (balance.isPending || history.isPending) return <MessagePacksFallback />;

  if (balance.isError || history.isError) {
    const retrying = balance.isFetching || history.isFetching;
    return (
      <div className={SETTINGS_COLUMN}>
        <Heading />
        <SettingsState
          icon={TriangleAlert}
          tone="alarm"
          title="Your message packs did not load"
          description="Check your connection and try again."
          action={
            <Button
              size="sm"
              variant="outline"
              disabled={retrying}
              onClick={() => {
                void balance.refetch();
                void history.refetch();
              }}
            >
              <RotateCw aria-hidden className={cn('size-4', retrying && 'animate-spin')} />
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  const packs = history.data.pages.flatMap((page) => page.data);
  const perPack = pricing.data?.messages_per_pack ?? null;
  const priceRow = pricing.data?.prices.find((row) => row.currency === currency) ?? null;

  return (
    <div className={SETTINGS_COLUMN}>
      <Heading />
      <div className="flex flex-col gap-5">
        <SettingsFormGroup id="packs-balance" label="Balance">
          <li className="flex min-h-14 items-center gap-3.5 px-4 py-2.5">
            <MessageSquarePlus aria-hidden className="size-5 shrink-0 text-muted-foreground" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] leading-snug font-medium text-foreground tabular-nums">
                {balance.data} {balance.data === 1 ? 'message' : 'messages'} left
              </span>
              <span className="text-[13px] leading-snug text-muted-foreground">
                From message packs, used after your plan&apos;s messages.
              </span>
            </span>
            <Button size="sm" onClick={() => setBuyOpen(true)} className="shrink-0">
              Buy
            </Button>
          </li>
        </SettingsFormGroup>

        <SettingsFormGroup id="packs-history" label="Purchase history">
          {packs.length === 0 ? (
            <li className="flex min-h-14 items-center px-4 py-2.5 text-[15px] leading-snug text-muted-foreground">
              No packs bought yet.
            </li>
          ) : (
            packs.map((pack) => <PackRow key={pack.id} pack={pack} />)
          )}
          {history.hasNextPage ? (
            <li>
              <button
                type="button"
                onClick={() => void history.fetchNextPage()}
                disabled={history.isFetchingNextPage}
                className={cn(
                  'v2-interactive flex min-h-12 w-full items-center justify-center gap-2 px-4 py-2 text-[15px] font-medium text-primary',
                  'transition-colors duration-150 hover:bg-foreground/[0.04] motion-reduce:transition-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                )}
              >
                {history.isFetchingNextPage ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : null}
                Show more
              </button>
            </li>
          ) : null}
        </SettingsFormGroup>

        <section aria-labelledby="packs-how" className="px-1">
          <h2 id="packs-how" className="text-[13px] leading-snug font-medium text-muted-foreground">
            How message packs work
          </h2>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[13px] leading-snug text-muted-foreground">
            {perPack ? (
              <li>
                Each pack adds {perPack} AI messages
                {priceRow ? ` for ${formatMoneyMajor(priceRow.price_major, currency)}` : ''}.
              </li>
            ) : null}
            <li>Your plan&apos;s messages are always used first.</li>
            <li>When your plan runs out, the oldest pack is used first.</li>
            <li>Messages you buy never expire and carry over between billing periods.</li>
          </ul>
        </section>
      </div>

      <BuyPanel open={buyOpen} onOpenChange={setBuyOpen} pricing={pricing.data ?? null} />
    </div>
  );
}

function Heading() {
  return (
    <h1 className="sr-only md:not-sr-only md:mb-5 md:text-2xl md:font-semibold md:tracking-tight md:text-foreground">
      Message packs
    </h1>
  );
}

function PackRow({ pack }: { pack: IMessagePack }) {
  const packs = `${pack.quantity} ${pack.quantity === 1 ? 'pack' : 'packs'}`;
  const detail = [pack.formatted_amount, packDate(pack)].filter(Boolean).join(' · ');
  const done = pack.status === 'completed';
  return (
    <li className="flex min-h-14 items-center gap-3.5 px-4 py-2.5">
      <Package aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] leading-snug font-medium text-foreground">
          {packs} · {pack.messages_total} messages
        </span>
        <span className="truncate text-[13px] leading-snug text-muted-foreground">{detail}</span>
      </span>
      <span
        className={cn(
          'shrink-0 text-[13px] leading-snug tabular-nums',
          done ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {done ? `${pack.messages_remaining} left` : pack.status_label}
      </span>
    </li>
  );
}
