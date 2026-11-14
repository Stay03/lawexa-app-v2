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
import { formatCost } from '@/lib/utils/currency';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { useExchangeRate } from '@/lib/hooks/useExchangeRate';
import type { UserDailyCostPoint, ViewAnalyticsGranularity } from '@/types/admin';
import { bucketsSpanDays, formatDateTick, formatDateTooltipLabel, hourlyTicks } from '@/lib/utils/analytics';

interface DailyCostChartProps {
  data: UserDailyCostPoint[];
  granularity: ViewAnalyticsGranularity;
}

const chartConfig = {
  cost: {
    label: 'Cost',
    color: 'var(--chart-4)',
  },
} satisfies ChartConfig;

export function DailyCostChart({ data, granularity }: DailyCostChartProps) {
  /* showNGN is this browser's preference; the RATE is the server setting,
     with a per-browser override on top. Different sources on purpose. */
  const showNGN = useCurrencyStore((s) => s.showNGN);
  const { rate: exchangeRate } = useExchangeRate();
  const maxCost = Math.max(...data.map((d) => d.cost), 0);
  const domainMax = Math.ceil(maxCost * 1.25) || 1;

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost</CardTitle>
          <CardDescription>Estimated API cost</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }

  const isHourly = granularity === 'hour';
  // Hourly points cross midnight in "last 24 hours": the midnight tick then names its day.
  const spansDays = isHourly && bucketsSpanDays(data.map((point) => point.date));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost</CardTitle>
        <CardDescription>Estimated API cost</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
          <AreaChart data={data} accessibilityLayer margin={{ top: 20 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              ticks={hourlyTicks(data.map((point) => point.date), spansDays)}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => formatDateTick(String(v), granularity, spansDays)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
              domain={[0, domainMax]}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_v, payload) =>
                    formatDateTooltipLabel(String(payload?.[0]?.payload?.date ?? _v), granularity)
                  }
                  formatter={(value) => [
                    formatCost(Number(value), { showNGN, exchangeRate, decimals: 6 }),
                    'Cost',
                  ]}
                />
              }
            />
            <defs>
              <linearGradient id="fillDailyCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-cost)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-cost)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              dataKey="cost"
              type="monotone"
              fill="url(#fillDailyCost)"
              stroke="var(--color-cost)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
