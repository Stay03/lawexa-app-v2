'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { formatNaira } from '@/lib/utils/currency';
import { formatDateTick, formatDateTooltipLabel } from '@/lib/utils/analytics';
import {
  compactMoney,
  fullMoney,
  seriesByCurrency,
} from '@/components/admin/analytics/money';
import type { MrrTrendPoint } from '@/types/admin';

/******************************************************************************
                                 Constants
******************************************************************************/

const chartConfig = {
  mrr: {
    label: 'MRR',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig;

/******************************************************************************
                                 Types
******************************************************************************/

/**
 * Either the old single series, or one series PER CURRENCY.
 *
 * MRR is the figure this whole change was about: a naira MRR and a dollar MRR
 * added together is a number that means nothing, and it is what the card showed
 * for months. Each currency now trends on its own axis.
 */
interface MrrTrendChartProps {
  data: MrrTrendPoint[] | Record<string, MrrTrendPoint[]>;
  granularity: 'hour' | 'day';
}

/******************************************************************************
                                 Component
******************************************************************************/

export function MrrTrendChart({ data, granularity }: MrrTrendChartProps) {
  const groups = seriesByCurrency(data);

  if (groups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>MRR Trend</CardTitle>
          <CardDescription>Monthly Recurring Revenue over time</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] flex-col items-center justify-center gap-2 text-muted-foreground">
          <TrendingUp aria-hidden className="h-8 w-8 opacity-40" />
          <p className="text-sm">No data for this period</p>
        </CardContent>
      </Card>
    );
  }

  const labelled = groups.length > 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>MRR Trend</CardTitle>
        <CardDescription>
          Monthly Recurring Revenue over time
          {labelled ? ', each currency on its own scale' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {groups.map((group) => {
          const currency = group.currency;
          /* THE GRADIENT ID MUST DIFFER PER CHART. `url(#id)` resolves to the
             first match in the document, so a shared id would silently point
             every chart at the first one's fill — and two elements carrying one
             id is invalid besides. */
          const fillId = `fillMrr-${currency ?? 'legacy'}`;
          return (
            <div key={currency ?? 'legacy'} className="space-y-2">
              {labelled ? (
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {currency}
                </p>
              ) : null}
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <AreaChart data={group.items} accessibilityLayer>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(v) => formatDateTick(v, granularity)}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(v) =>
                      currency
                        ? compactMoney(currency, Number(v))
                        : formatNaira(Number(v), { compact: true })
                    }
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(v) =>
                          formatDateTooltipLabel(String(v), granularity)
                        }
                        formatter={(value) => [
                          currency
                            ? fullMoney(currency, Number(value))
                            : formatNaira(Number(value), { decimals: 2 }),
                          'MRR',
                        ]}
                      />
                    }
                  />
                  <defs>
                    <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-mrr)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-mrr)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <Area
                    dataKey="mrr"
                    type="monotone"
                    fill={`url(#${fillId})`}
                    stroke="var(--color-mrr)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
