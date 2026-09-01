'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
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
import { Receipt } from 'lucide-react';
import { formatNaira } from '@/lib/utils/currency';
import { formatDateTick, formatDateTooltipLabel } from '@/lib/utils/analytics';
import {
  compactMoney,
  fullMoney,
  seriesByCurrency,
} from '@/components/admin/analytics/money';
import type { RevenueOverTimePoint } from '@/types/admin';

/******************************************************************************
                                 Constants
******************************************************************************/

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

/******************************************************************************
                                 Types
******************************************************************************/

/**
 * Either the old single series, or one series PER CURRENCY.
 *
 * Each currency gets its own chart and its own axis rather than a second bar on
 * this one — see `seriesByCurrency` for why sharing an axis is the blended
 * total drawn as a picture.
 */
interface RevenueOverTimeChartProps {
  data: RevenueOverTimePoint[] | Record<string, RevenueOverTimePoint[]>;
  granularity: 'hour' | 'day';
}

/******************************************************************************
                                 Component
******************************************************************************/

export function RevenueOverTimeChart({
  data,
  granularity,
}: RevenueOverTimeChartProps) {
  const groups = seriesByCurrency(data);
  const cadence = granularity === 'hour' ? 'Hourly' : 'Daily';

  if (groups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue Over Time</CardTitle>
          <CardDescription>{cadence} paid invoice revenue</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] flex-col items-center justify-center gap-2 text-muted-foreground">
          <Receipt aria-hidden className="h-8 w-8 opacity-40" />
          <p className="text-sm">No data for this period</p>
        </CardContent>
      </Card>
    );
  }

  const labelled = groups.length > 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Over Time</CardTitle>
        <CardDescription>
          {cadence} paid invoice revenue
          {labelled ? ', each currency on its own scale' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {groups.map((group) => {
          const currency = group.currency;
          return (
            <div key={currency ?? 'legacy'} className="space-y-2">
              {labelled ? (
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {currency}
                </p>
              ) : null}
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={group.items} accessibilityLayer>
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
                            : formatNaira(Number(value)),
                          'Revenue',
                        ]}
                      />
                    }
                  />
                  <Bar
                    dataKey="revenue"
                    fill="var(--color-revenue)"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                  />
                </BarChart>
              </ChartContainer>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
