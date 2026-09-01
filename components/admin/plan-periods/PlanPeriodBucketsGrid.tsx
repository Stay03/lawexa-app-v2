'use client';

import { cn } from '@/lib/utils';
import { formatCost } from '@/lib/utils/currency';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { useExchangeRate } from '@/lib/hooks/useExchangeRate';
import type {
  PlanPeriodBucket,
  PlanPeriodBucketName,
} from '@/types/admin-plan-periods';
import type { PlanPeriodSlotSelection } from './PlanPeriodConversationsSheet';

interface PlanPeriodBucketsGridProps {
  buckets: Record<PlanPeriodBucketName, PlanPeriodBucket>;
  onSelect: (slot: PlanPeriodSlotSelection) => void;
}

interface BucketMeta {
  name: PlanPeriodBucketName;
  label: string;
  description: string;
  /** Highlighted as the bucket admins should investigate. */
  watch?: boolean;
}

// Fixed display order, mirroring the API's documented bucket set.
const BUCKETS: BucketMeta[] = [
  { name: 'free', label: 'Free tier', description: 'Free-tier turns, no subscription' },
  { name: 'pack', label: 'PAYG packs', description: 'Message-pack turns' },
  { name: 'staff', label: 'Staff / bypass', description: 'admin · researcher tiers' },
  { name: 'system', label: 'System', description: 'System-generated turns' },
  { name: 'legacy', label: 'Legacy', description: 'Before attribution tagging' },
  {
    name: 'unattributed',
    label: 'Unattributed',
    description: "Plan turns that couldn't be placed",
    watch: true,
  },
];

export function PlanPeriodBucketsGrid({ buckets, onSelect }: PlanPeriodBucketsGridProps) {
  /* showNGN is this browser's preference; the RATE is the server setting,
     with a per-browser override on top. Different sources on purpose. */
  const showNGN = useCurrencyStore((s) => s.showNGN);
  const { rate: exchangeRate } = useExchangeRate();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {BUCKETS.map((meta) => {
        const bucket = buckets[meta.name];
        const isEmpty = bucket.messages === 0 && bucket.conversations === 0;
        const highlight = meta.watch && !isEmpty;

        return (
          <button
            key={meta.name}
            type="button"
            disabled={isEmpty}
            onClick={() =>
              onSelect({
                key: bucket.key,
                title: meta.label,
                subtitle: meta.description,
              })
            }
            className={cn(
              'rounded-lg border p-4 text-left transition-colors',
              isEmpty
                ? 'cursor-default opacity-60'
                : 'cursor-pointer hover:bg-muted/40',
              highlight && 'border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  'font-medium',
                  highlight && 'text-amber-900 dark:text-amber-300'
                )}
              >
                {meta.label}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {bucket.key}
              </span>
            </div>
            <p
              className={cn(
                'mt-0.5 text-xs text-muted-foreground',
                highlight && 'text-amber-700/80 dark:text-amber-400/80'
              )}
            >
              {meta.description}
            </p>
            <div className="mt-3 flex items-center gap-4 text-sm">
              <span className="tabular-nums">
                <span className="font-semibold">{bucket.messages}</span>{' '}
                <span className="text-muted-foreground">msg</span>
              </span>
              <span className="tabular-nums">
                <span className="font-semibold">{bucket.tokens.toLocaleString()}</span>{' '}
                <span className="text-muted-foreground">tok</span>
              </span>
              <span
                className={cn(
                  'font-mono text-xs tabular-nums',
                  bucket.cost === 0 ? 'text-muted-foreground' : 'font-semibold'
                )}
              >
                {formatCost(bucket.cost, { showNGN, exchangeRate, decimals: 4 })}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
